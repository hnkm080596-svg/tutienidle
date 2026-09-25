// Remediation Task 2 (2026-09-05) â€” completion handle tá»« VFX tween lÃ  nguá»“n
// duy nháº¥t cá»§a acknowledgeActionComplete (bá» delayedCall tá»± tÃ­nh duration).
// Contract:
// 1. onActionImpact() KHÃ”NG cÃ²n schedule delayedCall duration tá»± tÃ­nh.
// 2. Tween onComplete â†’ ack Ä‘Ãºng 1 láº§n qua spawner callback.
// 3. Projection miss (khÃ´ng spawn Ä‘Æ°á»£c VFX) â†’ ack ngay (fallback path).
// 4. handle.complete() cÅ©ng ack (idempotent â€” tween xong sau khÃ´ng ack láº¡i).
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'

function createScene() {
  // new CombatScene() Ä‘á»ƒ class fields cÃ³ identity tháº­t (pattern lifecycle test).
  const scene = createTestScene()

  const tweenConfigs: Array<Record<string, unknown>> = []
  const graphics: Array<{ destroyed: boolean }> = []

  scene.renderMode = 'perspective' // isPerspective getter Ä‘á»c tá»« renderMode.
  scene.sprites = new Map()
  scene.statuses = new Map()
  scene.spawnVfxHandles = new Map()
  scene.projection = {
    footprintPolygon: () => [],
    gridToScreen: () => ({ x: 0, y: 0 }),
    cellSizeAt: () => ({ width: 64, height: 64 }),
  }
  scene.entityFootMinY = 0
  scene.entityFootMaxY = 900
  scene.tweens = { add: (config: Record<string, unknown>) => tweenConfigs.push(config) }
  scene.add = {
    graphics: () => {
      // Chainable graphics stub: má»i method váº½ (clear/lineStyle/â€¦) lÃ 
      // no-op tráº£ chÃ­nh nÃ³; destroy() flag + Ä‘áº¿m qua destroyed.
      const gfx = { destroyed: false, destroy: () => (gfx.destroyed = true) }

      graphics.push(gfx)

      const chain = () => new Proxy(gfx, {
        get: (obj, prop: string) =>
          prop in obj ? (obj as unknown as Record<string, unknown>)[prop] : chain,
      })

      return chain()
    },
  }
  scene.cameras = { main: { shake: vi.fn() } }
  scene.time = { now: 0, delayedCall: vi.fn() }

  // gameManagerRef bridge â€” Ä‘áº¿m ack kÃ¨m token.
  const acks: Array<{ token?: string }> = []
  scene.gameManagerRef = {
    setPresentationActive: vi.fn(),
    acknowledgeTurnReady: vi.fn(),
    acknowledgeActionImpact: vi.fn(),
    acknowledgeActionComplete: (token?: string) => acks.push({ token }),
    getPendingPlaybackToken: vi.fn(() => 'playback-7'),
  }

  return { scene, tweenConfigs, graphics, acks }
}

function impactEvent() {
  return {
    type: 'action_impact' as const,
    actionId: 'player-0',
    actionInstanceId: 'player-0#1',
    sourceId: 'player',
    primaryTargetId: 'enemy_1',
    anchorCell: { row: 4 as const, column: 5 },
    affectedTargetIds: ['enemy_1'],
    landedTargetIds: ['enemy_1'],
    dodgedTargetIds: [],
    affectedArea: { shape: 'single' as const, rowStart: 4, rowEnd: 4, colStart: 5, colEnd: 5 },
    hitCount: 1,
    presetId: 'slash' as const,
  }
}

describe('legacy action feedback is non-authoritative', () => {
  it('visual completion never acknowledges the shared skill playback', () => {
    const { scene, tweenConfigs, acks } = createScene()
    scene.onActionImpact(impactEvent())
    expect(scene.time.delayedCall).not.toHaveBeenCalled()
    ;(tweenConfigs.at(-1)?.onComplete as (() => void) | undefined)?.()
    expect(acks).toHaveLength(0)
  })
  it('projection miss cannot acknowledge a pending action', () => {
    const { scene, acks } = createScene()
    scene.projection = undefined
    scene.onActionImpact(impactEvent())
    expect(acks).toHaveLength(0)
  })
  it('an obsolete legacy callback cannot acknowledge a replacement command port', () => {
    const { scene, tweenConfigs, acks } = createScene()
    scene.onActionImpact(impactEvent())
    const next = vi.fn()
    scene.gameManagerRef = { acknowledgeActionComplete: next }
    ;(tweenConfigs.at(-1)?.onComplete as (() => void) | undefined)?.()
    expect(next).not.toHaveBeenCalled()
    expect(acks).toHaveLength(0)
  })
  it('standalone spawner completion remains idempotent for visual consumers', () => {
    const { scene, tweenConfigs } = createScene()
    const complete = vi.fn()
    const handle = scene.vfxSpawner.onActionImpact(impactEvent(), complete)
    handle.complete()
    ;(tweenConfigs.at(-1)?.onComplete as () => void)()
    expect(complete).toHaveBeenCalledTimes(1)
  })
  it('legacy attack lunge cannot acknowledge impact', () => {
    const { scene } = createScene()
    scene.onAttack({ sourceId: 'missing' })
    expect(scene.gameManagerRef.acknowledgeActionImpact).not.toHaveBeenCalled()
  })
})
