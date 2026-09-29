// @vitest-environment jsdom
// combat-player-visual.test.ts - headless coverage for applyPlayerVisualProfile
// (clean-A F2: the swap path carried zero direct tests while guarding five
// historical defect classes). Fake sprite + listener map, no live Phaser.
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combatTestHarness'
import { CombatPlayerVisual } from './combat-player-visual'
import { PLAYER_ID } from './combatConstants'
import type { CombatScene } from '../CombatScene'

function fakeGameSprite() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  return {
    playCalls: [] as string[],
    textureCalls: [] as string[],
    offCalls: [] as [string, unknown][],
    texture: undefined as { key: string } | undefined,
    play(key: string) {
      this.playCalls.push(key)
      return this
    },
    setTexture(key: string, frame?: string) {
      this.textureCalls.push(frame ? `${key}:${frame}` : key)
      this.texture = { key }
      return this
    },
    once(event: string, handler: (...args: unknown[]) => void) {
      const s = listeners.get(event) ?? new Set()
      s.add(handler)
      listeners.set(event, s)
      return this
    },
    off(event: string, handler: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(handler)
      this.offCalls.push([event, handler])
      return this
    },
    emit(event: string, ...args: unknown[]) {
      for (const h of [...(listeners.get(event) ?? [])]) h(...args)
    },
    anims: { stop: vi.fn() },
  }
}

function makeSprite(rect = fakeGameSprite()) {
  return {
    kind: 'sprite' as const,
    rect,
    label: { destroy: vi.fn() },
    color: 0,
    offsetX: 0,
    row: 4,
    sizeMultiplier: 1,
    boost: { value: 1 },
    footY: 0,
    columnFloat: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function createScene(loadedTextures: Set<string>) {
  const scene = createTestScene('bare')
  scene.playerDying = false
  scene.sprites = new Map()
  scene.textures = { exists: (k: string) => loadedTextures.has(k) }
  scene.playCombatAnimation = vi.fn()
  scene.applySpriteSize = vi.fn()
  return scene
}

describe('CombatPlayerVisual.applyPlayerVisualProfile', () => {
  it('animated swap removes exactly the armed transition listener and clears pending state', () => {
    const gs = fakeGameSprite()
    const sprite = makeSprite(gs)
    const staleListener = () => {}
    sprite.pendingTransitionListener = staleListener
    sprite.deferredLoopRequest = 'idle'
    sprite.pendingBaseTextureKey = 'pham_nhan-avatar'

    // pham_nhan atlas sheets loaded
    const scene = createScene(new Set(['pham_nhan-sheet-1', 'pham_nhan-sheet-2', 'pham_nhan-sheet-3']))
    scene.sprites.set(PLAYER_ID, sprite)
    const visual = new CombatPlayerVisual(scene as unknown as CombatScene)

    visual.applyPlayerVisualProfile('mortal')

    expect(gs.anims.stop).toHaveBeenCalled()
    expect(gs.offCalls).toEqual([['animationcomplete', staleListener]])
    expect(sprite.pendingTransitionListener).toBeUndefined()
    expect(sprite.deferredLoopRequest).toBeUndefined()
    expect(sprite.pendingBaseTextureKey).toBeUndefined()
    expect(gs.textureCalls[0]).toContain('pham_nhan-sheet-1')
    expect(scene.playCombatAnimation).toHaveBeenCalledWith(sprite, PLAYER_ID, 'idle')
    expect(sprite.sourceSize).toEqual({ w: 495, h: 512 })
  })

  it('dying player early-returns: corpse keeps its frame, no swap side-effects', () => {
    const gs = fakeGameSprite()
    const sprite = makeSprite(gs)
    sprite.pendingTransitionListener = () => {}
    sprite.deferredLoopRequest = 'standby'

    const scene = createScene(new Set(['pham_nhan-sheet-1']))
    scene.playerDying = true
    scene.sprites.set(PLAYER_ID, sprite)
    const visual = new CombatPlayerVisual(scene as unknown as CombatScene)

    visual.applyPlayerVisualProfile('mortal')

    expect(gs.anims.stop).not.toHaveBeenCalled()
    expect(gs.offCalls).toEqual([])
    expect(sprite.pendingTransitionListener).toBeDefined()
    expect(scene.playCombatAnimation).not.toHaveBeenCalled()
  })

  it('atlas-miss + avatar drawn: sprite keeps the avatar box, not atlas metrics', () => {
    const gs = fakeGameSprite()
    gs.texture = { key: 'pham_nhan-avatar' }
    const sprite = makeSprite(gs)

    const scene = createScene(new Set(['pham_nhan-avatar'])) // no sheets
    scene.sprites.set(PLAYER_ID, sprite)
    const visual = new CombatPlayerVisual(scene as unknown as CombatScene)

    visual.applyPlayerVisualProfile('mortal')

    expect(gs.anims.stop).not.toHaveBeenCalled()
    expect(scene.playCombatAnimation).not.toHaveBeenCalled()
    expect(sprite.sourceSize).toEqual({ w: 512, h: 512 })
    expect(scene.applySpriteSize).toHaveBeenCalledWith(sprite)
  })

  it('atlas-miss + profile PNG drawn: sizing follows the surviving texture, not atlas dims', () => {
    const gs = fakeGameSprite()
    gs.texture = { key: 'player-mortal-ink-sword-concept-v2' }
    const sprite = makeSprite(gs)

    const scene = createScene(new Set(['player-mortal-ink-sword-concept-v2'])) // no sheets, no avatar
    scene.sprites.set(PLAYER_ID, sprite)
    const visual = new CombatPlayerVisual(scene as unknown as CombatScene)

    visual.applyPlayerVisualProfile('mortal')

    // mortal profile combat PNG sourceSize - must NOT be pham_nhan's atlas box
    expect(sprite.sourceSize).not.toEqual({ w: 495, h: 512 })
    expect(sprite.sourceSize.w).toBeGreaterThan(0)
  })
})
