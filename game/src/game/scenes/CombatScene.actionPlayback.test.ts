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
  scene.interpolations = new Map()
  scene.castBars = new Map()
  scene.statuses = new Map()
  scene.materializingIds = new Set()
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

describe('CombatScene.onActionImpact â€” VFX completion owns ack (Remediation Task 2)', () => {
  it('KHÃ”NG cÃ²n delayedCall tá»± tÃ­nh duration (bá» duplicate duration calc)', () => {
    const { scene } = createScene()

    scene.onActionImpact(impactEvent())

    expect(scene.time.delayedCall).not.toHaveBeenCalled()
  })

  it('tween onComplete â†’ acknowledgeActionComplete Ä‘Ãºng 1 láº§n', () => {
    const { scene, tweenConfigs, acks } = createScene()

    scene.onActionImpact(impactEvent())

    expect(acks).toHaveLength(0)

    // MÃ´ phá»ng Phaser tween xong.
    const onComplete = tweenConfigs
      .at(-1)
      ?.onComplete as (() => void) | undefined

    expect(onComplete).toBeDefined()
    onComplete!()

    expect(acks).toHaveLength(1)
    expect(acks[0]!.token).toBe('playback-7')
  })

  it('projection miss (spawner tráº£ undefined) â†’ ack ngay fallback', () => {
    const { scene, acks } = createScene()

    scene.projection = undefined
    scene.onActionImpact(impactEvent())

    expect(acks).toHaveLength(1)
    expect(acks[0]!.token).toBe('playback-7')
    expect(scene.time.delayedCall).not.toHaveBeenCalled()
  })

  it('handle.complete() thá»§ cÃ´ng trÆ°á»›c tween xong â†’ tween xong sau KHÃ”NG ack láº¡i (idempotent)', () => {
    const { scene, tweenConfigs, acks } = createScene()

    // Báº¯t handle qua spawner (callback token-captured do CombatScene truyá»n).
    const handle = scene.vfxSpawner.onActionImpact(impactEvent(), () => {
      const token = scene.gameManagerRef.getPendingPlaybackToken()

      if (token !== null) {
        scene.gameManagerRef.acknowledgeActionComplete(token)
      }
    })

    handle.complete()
    expect(acks).toHaveLength(1)

    // Tween xong sau Ä‘Ã³ â€” khÃ´ng ack láº§n 2.
    ;(tweenConfigs.at(-1)?.onComplete as () => void)()
    expect(acks).toHaveLength(1)
  })

  it('token capture Táº I SPAWN: token Ä‘á»•i giá»¯a chá»«ng â†’ completion cÅ© KHÃ”NG ack nháº§m phase má»›i', () => {
    const { scene, tweenConfigs, acks } = createScene()

    let currentToken: string | null = 'playback-7'
    scene.gameManagerRef.getPendingPlaybackToken = vi.fn(() => currentToken)

    scene.onActionImpact(impactEvent())

    // Battle má»›i báº¯t Ä‘áº§u giá»¯a chá»«ng â€” token mint má»›i.
    currentToken = 'playback-8'

    // Completion cÅ© bÃ¢y giá» má»›i cháº¡y.
    ;(tweenConfigs.at(-1)?.onComplete as () => void)()

    // Completion cÅ© ack vá»›i token CÅ¨ (playback-7) â€” GameManager sáº½ tá»« chá»‘i.
    expect(acks).toHaveLength(1)
    expect(acks[0]!.token).toBe('playback-7')
  })

  it('khÃ´ng cÃ³ phase pending (token null) â†’ KHÃ”NG ack (stale-guard)', () => {
    const { scene, tweenConfigs, acks } = createScene()

    scene.gameManagerRef.getPendingPlaybackToken = vi.fn(() => null)

    scene.onActionImpact(impactEvent())
    ;(tweenConfigs.at(-1)?.onComplete as () => void)()

    expect(acks).toHaveLength(0)
  })
})
