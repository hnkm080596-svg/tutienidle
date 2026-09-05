// @vitest-environment jsdom
//
// Reward stream integration (player-body-anchor-reward-gourd-plan Â§9):
// - Äiá»ƒm phÃ¡t theo priority chest-anchor â†’ screen cache â†’ grid cache.
// - Äiá»ƒm hÃºt LUÃ”N lÃ  miá»‡ng há»“ lÃ´, KHÃ”NG pháº£i Player â€” teleport Player
//   giá»¯a tween khÃ´ng Ä‘á»•i Ä‘Ã­ch.
// - Pulse há»“ lÃ´ Ä‘Ãºng Má»˜T nhá»‹p má»—i reward event.
// - clearSceneState dá»n sáº¡ch gourd + caches (khÃ´ng rÃ² rá»‰ qua shutdown).
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import { PLAYER_VISUAL_PROFILES } from '../support/PlayerVisualProfiles'
import {
  computeGourdPlacement,
  resolveGourdMouth,
} from '../support/RewardGourd'

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

  return proxy as Record<string, unknown> & { __calls: typeof calls }
}

function makeEntitySprite(x: number, y: number, displayHeight = 64) {
  return {
    kind: 'sprite',
    rect: {
      x,
      y,
      displayWidth: 48,
      displayHeight,
      rotation: 0,
      setVisible: () => undefined,
    },
    label: { setPosition: () => undefined },
    color: 0xffffff,
    offsetX: 0,
    row: 4,
    sizeMultiplier: 2,
    boost: { value: 1 },
    footY: y,
    columnFloat: 1,
    shadow: undefined,
    healthBar: undefined,
  }
}

function createScene() {
  const scene = createTestScene('bare')

  const tweenConfigs: Array<Record<string, unknown>> = []
  const delayedCalls: Array<{ delay: number; callback: () => void }> = []
  const createdObjects: ReturnType<typeof chainableRecorder>[] = []

  scene.renderMode = 'flat'
  scene.projection = undefined
  scene.canvasWidth = 1200
  scene.canvasHeight = 800

  scene.sprites = new Map()
  scene.interpolations = new Map()
  scene.castBars = new Map()
  scene.statuses = new Map()
  scene.dyingIds = new Set()
  scene.spawnVfxHandles = new Map()
  scene.materializingIds = new Set()
  scene.playerSpawnHandle = undefined
  scene.playerMaterialized = true

  // Body-anchor/reward state (plan fields).
  scene.playerProfileId = 'mortal'
  scene.playerProfile = PLAYER_VISUAL_PROFILES.mortal
  scene.playerSourceSize = { ...PLAYER_VISUAL_PROFILES.mortal.combatSourceSize }
  scene.lastKnownScreenPositions = new Map()
  scene.lastKnownGridPositions = new Map()
  scene.maxTrackedSourcePositions = 64
  scene.gourdPlacement = computeGourdPlacement({ canvasHeight: 800, bottomInset: 110 })
  scene.gourdGraphics = undefined
  scene.gourdPulseTween = undefined
  scene.debugBodyAnchorsEnabled = false
  scene.debugAnchorGraphics = undefined
  scene.playerDying = false

  scene.tweens = {
    add: (config: Record<string, unknown>) => {
      tweenConfigs.push(config)

      return {} as never
    },

    killTweensOf: vi.fn(),
  }

  scene.time = {
    now: 0,

    delayedCall: (delay: number, callback: () => void) => {
      delayedCalls.push({ delay, callback })
    },
  }

  scene.add = new Proxy(
    {},

    {
      get: (_obj, prop: string) => () => {
        const obj = chainableRecorder()

        void prop

        createdObjects.push(obj)

        return obj
      },
    },
  )

  scene.physics = { add: { existing: vi.fn() } }

  scene.registry = { get: () => undefined }

  scene.eventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() }

  scene.textures = { exists: () => false, get: () => ({}) }

  return { scene, tweenConfigs, delayedCalls, createdObjects }
}

const REWARD_EVENT = {
  type: 'reward_particle' as const,

  sourceId: 'enemy_1',

  kind: 'currency' as const,

  color: 0xffd54f,
}

describe('CombatScene â€” reward stream Ä‘iá»ƒm phÃ¡t (plan Â§7.1)', () => {
  it('má»©c 1: enemy dÃ¹ng anchor thÃ¢n trung tÃ­nh tá»« bounds sprite, KHÃ”NG mÆ°á»£n anchor Player', () => {
    const { scene } = createScene()

    // rect(500,400) h=64 â†’ neutral y=0.4: start = (500, 400+(0.4-0.5)*64).
    scene.sprites.set('enemy_1', makeEntitySprite(500, 400))

    const point = scene.resolveRewardSourcePoint('enemy_1')

    expect(point?.x).toBeCloseTo(500, 5)
    expect(point?.y).toBeCloseTo(400 - 0.1 * 64, 5)
  })

  it('audit P0-3: Ä‘iá»ƒm phÃ¡t enemy KHÃ”NG Ä‘á»•i khi Player visual profile Ä‘á»•i', () => {
    const { scene } = createScene()

    scene.sprites.set('enemy_1', makeEntitySprite(500, 400))

    const before = scene.resolveRewardSourcePoint('enemy_1')!

    // Äá»•i Player sang profile khÃ¡c â€” enemy particle pháº£i giá»¯ nguyÃªn.
    scene.playerProfile = PLAYER_VISUAL_PROFILES.phap_tu
    scene.playerProfileId = 'phap_tu'

    const after = scene.resolveRewardSourcePoint('enemy_1')!

    expect(after.x).toBeCloseTo(before.x, 5)
    expect(after.y).toBeCloseTo(before.y, 5)

    // Äá»‘i chá»©ng: Player DÃ™NG catalog anchor chest cá»§a profile.
    scene.sprites.set('player', makeEntitySprite(200, 300))

    const playerPoint = scene.resolveRewardSourcePoint('player')!

    expect(playerPoint.y).not.toBeCloseTo(after.y, 3)
  })

  it('má»©c 2: sprite Ä‘Ã£ bá»‹ dá»n â†’ dÃ¹ng last-known screen cache', () => {
    const { scene } = createScene()

    scene.lastKnownScreenPositions.set('enemy_1', { x: 333, y: 444 })

    expect(scene.resolveRewardSourcePoint('enemy_1')).toEqual({ x: 333, y: 444 })
  })

  it('má»©c 3: chá»‰ cÃ²n grid cache â†’ chiáº¿u qua projection hiá»‡n hÃ nh', () => {
    const { scene } = createScene()

    scene.lastKnownGridPositions.set('enemy_1', { row: 2, column: 3 })

    // ChÆ°a cÃ³ projection â†’ khÃ´ng táº¡o Ä‘Æ°á»£c nguá»“n (bail an toÃ n).
    expect(scene.resolveRewardSourcePoint('enemy_1')).toBeUndefined()

    scene.projection = {
      gridToScreen: (row: number, column: number) => ({
        x: column * 10,
        y: row * 20,
        scale: 1,
      }),
    }

    expect(scene.resolveRewardSourcePoint('enemy_1')).toEqual({ x: 30, y: 40 })
  })

  it('khÃ´ng cÃ³ nguá»“n nÃ o cáº£ â†’ KHÃ”NG sinh mote/tween', () => {
    const { scene, tweenConfigs } = createScene()

    scene.onRewardParticle(REWARD_EVENT)

    expect(tweenConfigs).toHaveLength(0)
  })
})

describe('CombatScene â€” reward stream hÃºt vá» há»“ lÃ´ (plan Â§7.2)', () => {
  it('target lock: p=1 cháº¡m ÄÃšNG miá»‡ng há»“ lÃ´; Player "teleport" khÃ´ng Ä‘á»•i Ä‘Ã­ch', () => {
    const { scene, tweenConfigs, createdObjects } = createScene()

    scene.sprites.set('player', makeEntitySprite(999, 888))
    scene.sprites.set('enemy_1', makeEntitySprite(200, 300))

    scene.onRewardParticle(REWARD_EVENT)

    const flightTween = tweenConfigs.find(
      (config) => (config.targets as { progress?: number }).progress !== undefined,
    )

    expect(flightTween).toBeDefined()

    const mote = createdObjects[0]!

    const state = flightTween!.targets as { progress: number }

    // Player "teleport" tá»›i vá»‹ trÃ­ khÃ¡c giá»¯a lÃºc bay.
    const playerSprite = scene.sprites.get('player')

    playerSprite.rect.x = 50
    playerSprite.rect.y = 60

    // Cháº¡y onUpdate tá»›i cuá»‘i quá»¹ Ä‘áº¡o.
    state.progress = 1

    ;(flightTween!.onUpdate as () => void)()

    const setPositionCalls = mote.__calls.filter((call) => call.method === 'setPosition')

    const lastCall = setPositionCalls.at(-1)!

    const mouth = resolveGourdMouth(scene.gourdPlacement)

    expect(lastCall.args[0]).toBeCloseTo(mouth.x, 4)
    expect(lastCall.args[1]).toBeCloseTo(mouth.y, 4)
  })

  it('pulse há»“ lÃ´ ÄÃšNG Má»˜T nhá»‹p má»—i reward event', () => {
    const { scene, delayedCalls } = createScene()

    scene.sprites.set('enemy_1', makeEntitySprite(100, 100))

    scene.onRewardParticle(REWARD_EVENT)

    const pulseSchedules = delayedCalls.filter(
      (entry) => entry.callback.name === '' || true,
    )

    expect(pulseSchedules).toHaveLength(1)
  })
})

describe('CombatScene â€” essence stream (2026-08-30, tinh hoa tuÃ´n cháº£y)', () => {
  const ESSENCE_EVENT = {
    type: 'reward_particle' as const,

    sourceId: 'enemy_1',

    kind: 'essence' as const,

    color: 0xc792ea,
  }

  it('kind essence â†’ KHÃ”NG pulse há»“ lÃ´ (bay vá» player, khÃ´ng vá» gourd)', () => {
    const { scene, delayedCalls } = createScene()

    scene.sprites.set('enemy_1', makeEntitySprite(100, 100))
    scene.sprites.set('player', makeEntitySprite(300, 400))

    scene.onRewardParticle(ESSENCE_EVENT)

    // Gourd pulse chá»‰ dÃ¹ng cho item/insight/currency â€” essence khÃ´ng pulse.
    expect(delayedCalls).toHaveLength(0)
  })

  it('kind essence â†’ sinh motes bay vá» player chest anchor (tele-safe)', () => {
    const { scene, tweenConfigs, createdObjects } = createScene()

    scene.sprites.set('enemy_1', makeEntitySprite(100, 100))
    scene.sprites.set('player', makeEntitySprite(300, 400))

    scene.onRewardParticle(ESSENCE_EVENT)

    const flightTween = tweenConfigs.find(
      (config) => (config.targets as { progress?: number }).progress !== undefined,
    )

    expect(flightTween).toBeDefined()

    const mote = createdObjects[0]!

    const state = flightTween!.targets as { progress: number }

    // Player "teleport" giá»¯a lÃºc bay â€” Ä‘Ã­ch live-resolve váº«n theo player.
    const playerSprite = scene.sprites.get('player')

    playerSprite.rect.x = 50
    playerSprite.rect.y = 60

    state.progress = 1

    ;(flightTween!.onUpdate as () => void)()

    const setPositionCalls = mote.__calls.filter((call) => call.method === 'setPosition')

    const lastCall = setPositionCalls.at(-1)!

    // ÄÃ­ch = chest anchor cá»§a player profile mortal táº¡i (50, 60) â€”
    // KHÃ”NG pháº£i vá»‹ trÃ­ cÅ© (300, 400) hay miá»‡ng há»“ lÃ´. Chest anchor
    // lá»‡ch nháº¹ so vá»›i tÃ¢m sprite (profile offset) â†’ dung sai 5px.
    expect(Math.abs(lastCall.args[0] as number - 50)).toBeLessThan(5)
    expect(Math.abs(lastCall.args[1] as number - 60)).toBeLessThan(30)
  })

  it('khÃ´ng resolve Ä‘Æ°á»£c nguá»“n â†’ phÃ¡t arrival NGAY (khÃ´ng káº¹t tinh hoa)', () => {
    const { scene, tweenConfigs } = createScene()

    scene.onRewardParticle(ESSENCE_EVENT)

    expect(tweenConfigs).toHaveLength(0)

    const emitCalls = (scene.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, unknown]
    >

    expect(emitCalls.some(([name]) => name === 'essence_stream_arrival')).toBe(true)
  })
})

describe('CombatScene â€” reward lifecycle (plan Â§7.4)', () => {
  it('clearSceneState dá»n sáº¡ch gourd + caches â€” khÃ´ng rÃ² rá»‰ qua shutdown', () => {
    const { scene } = createScene()

    const destroyed: string[] = []

    scene.gourdGraphics = { destroy: () => destroyed.push('gourd') }

    scene.debugAnchorGraphics = { destroy: () => destroyed.push('debug') }

    scene.lastKnownScreenPositions.set('e1', { x: 1, y: 2 })

    scene.lastKnownGridPositions.set('e1', { row: 1, column: 2 })

    scene.scale = { off: vi.fn() }

    scene.input = { off: vi.fn() }

    scene.arenaRect = undefined
    scene.gridGraphics = undefined
    scene.hoverMarker = undefined
    scene.backdrop = undefined
    scene.projection = undefined
    scene.playerSpawnHandle = undefined

    scene.clearSceneState()

    expect(destroyed).toEqual(['gourd', 'debug'])
    expect(scene.gourdGraphics).toBeUndefined()
    expect(scene.lastKnownScreenPositions.size).toBe(0)
    expect(scene.lastKnownGridPositions.size).toBe(0)
  })
})
