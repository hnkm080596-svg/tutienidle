// CombatScene reconcile spawn telegraph (2026-08-24): snapshot
// spawningEnemies â†’ ÄÃšNG Má»˜T VFX handle má»—i id; id rá»i snapshot â†’
// complete + fade-in sprite; battle reset/shutdown dá»n sáº¡ch.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import {
  createBattleGridProjection,
  type BattleGridProjection,
} from '../support/BattleGridProjection'
import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'

const PROJECTION = createBattleGridProjection('perspective', {
  width: 1600,
  height: 900,
  topInset: 60,
  bottomInset: 52,
})

function chainableRecorder() {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_obj, prop: string) {
        if (prop === '__calls') {
          return calls
        }

        return (...args: unknown[]) => {
          calls.push({ method: prop, args })
          return proxy
        }
      },
    },
  )

  return proxy as Record<string, unknown> & { __calls: Array<{ method: string; args: unknown[] }> }
}

function createScene() {
  const scene = createTestScene()

  const graphicsCreated: Array<
    Record<string, unknown> & { __calls: Array<{ method: string; args: unknown[] }> }
  > = []
  const tweenConfigs: Array<Record<string, unknown>> = []

  scene.renderMode = 'perspective'
  scene.projection = PROJECTION
  scene.entityFootMinY = PROJECTION.bounds().top
  scene.entityFootMaxY = PROJECTION.bounds().bottom
  scene.sprites = new Map()
  scene.interpolations = new Map()
  scene.castBars = new Map()
  scene.statuses = new Map()
  scene.materializingIds = new Set()
  scene.spawnVfxHandles = new Map()
  scene.tweens = { add: (config: Record<string, unknown>) => tweenConfigs.push(config) }
  scene.add = new Proxy(
    {},
    {
      get: () => () => {
        const gfx = chainableRecorder()

        graphicsCreated.push(gfx)

        return gfx
      },
    },
  )
  scene.physics = { add: { existing: vi.fn() } }
  scene.time = { now: 0, delayedCall: vi.fn() }
  scene.characterWidth = 40
  scene.characterHeight = 50

  return { scene, graphicsCreated, tweenConfigs }
}

function positionsEvent(
  spawningEnemies: BattlePositionsEvent['spawningEnemies'],
  enemies: BattlePositionsEvent['enemies'] = [],
): BattlePositionsEvent {
  return {
    type: 'positions',
    playerX: 1,
    playerRow: 4,
    playerMaterialized: true,
    playerCurrentHp: 100,
    playerMaxHp: 100,
    enemies,
    spawningEnemies,
  }
}

describe('CombatScene reconcileSpawnVfx', () => {
  it('má»™t pending spawn â†’ Ä‘Ãºng 2 Graphics (ground + cá»™t), snapshot láº·p khÃ´ng nhÃ¢n báº£n', () => {
    const { scene, graphicsCreated } = createScene()

    const spawning = [
      {
        id: 'enemy_1',
        name: 'QuÃ¡i',
        row: 4 as const,
        column: 8,
        progress: 0,
        isBoss: false,
        presetId: 'enemy_spawn' as const,
      },
    ]

    scene.applyPendingPositions(positionsEvent(spawning))
    scene.applyPendingPositions(
      positionsEvent(spawning.map((entry) => ({ ...entry, progress: 0.4 }))),
    )
    scene.update()

    expect(graphicsCreated).toHaveLength(2)
    expect(scene.spawnVfxHandles.get('enemy_1')!.progress).toBeCloseTo(0.4, 5)
  })

  it('id rá»i snapshot â†’ complete (flash tween) + enemy má»›i táº¡o Ä‘Æ°á»£c fade-in scale 0.7â†’1', () => {
    const { scene, tweenConfigs } = createScene()

    const spawning = [
      {
        id: 'enemy_1',
        name: 'QuÃ¡i',
        row: 4 as const,
        column: 8,
        progress: 0,
        isBoss: false,
        presetId: 'enemy_spawn' as const,
      },
    ]

    scene.applyPendingPositions(positionsEvent(spawning))
    scene.update()

    // Snapshot káº¿: telegraph xong â†’ enemy materialize.
    scene.applyPendingPositions(
      positionsEvent(
        [],
        [{ id: 'enemy_1', name: 'QuÃ¡i', x: 8, row: 4, currentHp: 100, maxHp: 100, isBoss: false }],
      ),
    )

    // Fade-in gá»“m 2 tween: boost scale 0.7â†’1 + alpha proxy 0â†’1 (setAlpha
    // per-target). Flash tween cá»§a handle lÃ  tween thá»© 3 (target {fade}).
    const boostTween = tweenConfigs.find(
      (config) => (config.targets as { value?: number }).value !== undefined,
    )

    expect(boostTween).toBeDefined()
    expect(boostTween!.duration).toBe(200)

    const alphaTween = tweenConfigs.find(
      (config) => (config.targets as { t?: number }).t !== undefined,
    )

    expect(alphaTween).toBeDefined()

    const sprite = scene.sprites.get('enemy_1')

    expect(sprite).toBeDefined()
    expect(sprite.boost.value).toBe(0.7)
    expect(scene.materializingIds.has('enemy_1')).toBe(false)
    expect(scene.spawnVfxHandles.has('enemy_1')).toBe(false)

    // Cháº¡y alpha tween tá»›i cuá»‘i â†’ má»i target vá» alpha cuá»‘i (rect=1,
    // shadow=SHADOW_ALPHA).
    // Cháº¡y alpha tween tá»›i cuá»‘i â€” onUpdate Ä‘á»c state.t tá»« targets object
    // (giá»‘ng Phaser tween ghi giÃ¡ trá»‹ vÃ o targets khi cháº¡y).
    ;(alphaTween!.targets as { t: number }).t = 1

    const alphaOnUpdate = alphaTween!.onUpdate as () => void

    alphaOnUpdate()

    const rectAlpha = sprite.rect.__calls.filter(
      (call: { method: string }) => call.method === 'setAlpha',
    ).at(-1)!.args[0]

    expect(rectAlpha).toBe(1)
  })

  it('battle reset (onBattleStart) dá»n sáº¡ch handle + materializingIds, khÃ´ng Ä‘á»ƒ telegraph cÅ© sang tráº­n má»›i', () => {
    const { scene, graphicsCreated } = createScene()

    scene.applyPendingPositions(
      positionsEvent([
        {
          id: 'enemy_1',
          name: 'QuÃ¡i',
          row: 4 as const,
          column: 8,
          progress: 0,
          isBoss: false,
          presetId: 'enemy_spawn' as const,
        },
      ]),
    )

    expect(scene.spawnVfxHandles.size).toBe(1)

    scene.onBattleStart()

    expect(scene.spawnVfxHandles.size).toBe(0)
    expect(scene.materializingIds.size).toBe(0)

    // Tráº­n má»›i snapshot pending má»›i â†’ táº¡o handle Má»šI (khÃ´ng dÃ¹ng láº¡i cÅ©).
    scene.applyPendingPositions(
      positionsEvent([
        {
          id: 'enemy_2',
          name: 'QuÃ¡i Má»›i',
          row: 2 as const,
          column: 5,
          progress: 0,
          isBoss: false,
          presetId: 'enemy_spawn' as const,
        },
      ]),
    )

    expect(scene.spawnVfxHandles.has('enemy_2')).toBe(true)
    expect(graphicsCreated.length).toBeGreaterThanOrEqual(4) // 2 cÅ© (destroyed) + 2 má»›i
  })

  it('flat mode: khÃ´ng táº¡o telegraph VFX (renderer legacy giá»¯ hÃ nh vi cÅ©)', () => {
    const { scene, graphicsCreated } = createScene()

    scene.renderMode = 'flat'

    scene.applyPendingPositions(
      positionsEvent([
        {
          id: 'enemy_1',
          name: 'QuÃ¡i',
          row: 4 as const,
          column: 8,
          progress: 0,
          isBoss: false,
          presetId: 'enemy_spawn' as const,
        },
      ]),
    )

    expect(graphicsCreated).toHaveLength(0)
    expect(scene.spawnVfxHandles.size).toBe(0)
  })
})
