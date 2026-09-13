// CombatEntityVisualLifecycle — the one owner of per-combatant sprite
// visibility state (roadmap "CombatScene rule" mechanism). The fake scene
// exposes only the three surface points the lifecycle uses:
// gridView.setSpriteVisible, sprites, playMaterializeFadeIn.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { CombatScene } from '../CombatScene'
import { CombatEntityVisualLifecycle } from './combat-entity-visual-lifecycle'
import type { EntitySprite } from './combatTypes'

function makeLifecycle() {
  const scene = {
    gridView: { setSpriteVisible: vi.fn() },
    sprites: new Map<string, EntitySprite>(),
    playMaterializeFadeIn: vi.fn(),
  }

  return {
    scene,
    lifecycle: new CombatEntityVisualLifecycle(scene as unknown as CombatScene),
  }
}

function fakeSprite(): EntitySprite {
  return {} as EntitySprite
}

describe('CombatEntityVisualLifecycle', () => {
  it('applyGating hides a pending id and shows a non-pending id', () => {
    const { scene, lifecycle } = makeLifecycle()

    lifecycle.markPending(['player'])

    const pendingSprite = fakeSprite()
    const freeSprite = fakeSprite()

    lifecycle.applyGating('player', pendingSprite)
    lifecycle.applyGating('companion_1', freeSprite)

    expect(scene.gridView.setSpriteVisible).toHaveBeenCalledWith(pendingSprite, false)
    expect(scene.gridView.setSpriteVisible).toHaveBeenCalledWith(freeSprite, true)
  })

  it('revealPending reveals the union of pending and alive ids that have sprites, then clears pending', () => {
    const { scene, lifecycle } = makeLifecycle()

    const pendingSprite = fakeSprite()
    const aliveSprite = fakeSprite()

    scene.sprites.set('p', pendingSprite)
    scene.sprites.set('c', aliveSprite)
    lifecycle.markPending(['p', 'q'])

    lifecycle.revealPending(['c'])

    // 'q' is pending but has no sprite — untouched, and not an error.
    expect(scene.gridView.setSpriteVisible).toHaveBeenCalledTimes(2)
    expect(scene.gridView.setSpriteVisible).toHaveBeenCalledWith(pendingSprite, true)
    expect(scene.gridView.setSpriteVisible).toHaveBeenCalledWith(aliveSprite, true)
    expect(lifecycle.pending.size).toBe(0)
  })

  it('consumeMaterializing consumes the mark once and plays the fade-in', () => {
    const { scene, lifecycle } = makeLifecycle()
    const sprite = fakeSprite()

    lifecycle.markMaterializing('enemy_1')

    expect(lifecycle.consumeMaterializing('enemy_1', sprite)).toBe(true)
    expect(scene.playMaterializeFadeIn).toHaveBeenCalledTimes(1)
    expect(scene.playMaterializeFadeIn).toHaveBeenCalledWith(sprite)

    expect(lifecycle.consumeMaterializing('enemy_1', sprite)).toBe(false)
    expect(lifecycle.consumeMaterializing('enemy_2', sprite)).toBe(false)
    expect(scene.playMaterializeFadeIn).toHaveBeenCalledTimes(1)
  })

  it('hidePlayer/materializePlayer drive the legacy real-time flag and fade-in exactly once', () => {
    const { scene, lifecycle } = makeLifecycle()
    const sprite = fakeSprite()

    lifecycle.hidePlayer(sprite)
    expect(scene.gridView.setSpriteVisible).toHaveBeenCalledWith(sprite, false)
    expect(lifecycle.playerMaterialized).toBe(false)

    lifecycle.materializePlayer(sprite)
    expect(scene.gridView.setSpriteVisible).toHaveBeenCalledWith(sprite, true)
    expect(scene.playMaterializeFadeIn).toHaveBeenCalledTimes(1)
    expect(lifecycle.playerMaterialized).toBe(true)

    // Already materialized — no second fade-in.
    lifecycle.materializePlayer(sprite)
    expect(scene.playMaterializeFadeIn).toHaveBeenCalledTimes(1)
  })

  it('hidePlayer/materializePlayer tolerate a missing sprite', () => {
    const { scene, lifecycle } = makeLifecycle()

    lifecycle.hidePlayer(undefined)
    expect(lifecycle.playerMaterialized).toBe(false)

    lifecycle.materializePlayer(undefined)
    expect(lifecycle.playerMaterialized).toBe(true)
    expect(scene.gridView.setSpriteVisible).not.toHaveBeenCalled()
    expect(scene.playMaterializeFadeIn).not.toHaveBeenCalled()
  })

  it('clear() drops pending and materializing marks but leaves the player flag', () => {
    const { lifecycle } = makeLifecycle()

    lifecycle.markPending(['p'])
    lifecycle.markMaterializing('e')
    lifecycle.hidePlayer(undefined)

    lifecycle.clear()

    expect(lifecycle.pending.size).toBe(0)
    expect(lifecycle.materializing.size).toBe(0)
    expect(lifecycle.playerMaterialized).toBe(false)
  })
})
