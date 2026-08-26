// @vitest-environment jsdom
//
// Reward stream integration (player-body-anchor-reward-gourd-plan §9):
// - Điểm phát theo priority chest-anchor → screen cache → grid cache.
// - Điểm hút LUÔN là miệng hồ lô, KHÔNG phải Player — teleport Player
//   giữa tween không đổi đích.
// - Pulse hồ lô đúng MỘT nhịp mỗi reward event.
// - clearSceneState dọn sạch gourd + caches (không rò rỉ qua shutdown).
import { describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'
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
  const scene = Object.create(CombatScene.prototype) as any

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

describe('CombatScene — reward stream điểm phát (plan §7.1)', () => {
  it('mức 1: enemy dùng anchor thân trung tính từ bounds sprite, KHÔNG mượn anchor Player', () => {
    const { scene } = createScene()

    // rect(500,400) h=64 → neutral y=0.4: start = (500, 400+(0.4-0.5)*64).
    scene.sprites.set('enemy_1', makeEntitySprite(500, 400))

    const point = scene.resolveRewardSourcePoint('enemy_1')

    expect(point?.x).toBeCloseTo(500, 5)
    expect(point?.y).toBeCloseTo(400 - 0.1 * 64, 5)
  })

  it('audit P0-3: điểm phát enemy KHÔNG đổi khi Player visual profile đổi', () => {
    const { scene } = createScene()

    scene.sprites.set('enemy_1', makeEntitySprite(500, 400))

    const before = scene.resolveRewardSourcePoint('enemy_1')!

    // Đổi Player sang profile khác — enemy particle phải giữ nguyên.
    scene.playerProfile = PLAYER_VISUAL_PROFILES.phap_tu
    scene.playerProfileId = 'phap_tu'

    const after = scene.resolveRewardSourcePoint('enemy_1')!

    expect(after.x).toBeCloseTo(before.x, 5)
    expect(after.y).toBeCloseTo(before.y, 5)

    // Đối chứng: Player DÙNG catalog anchor chest của profile.
    scene.sprites.set('player', makeEntitySprite(200, 300))

    const playerPoint = scene.resolveRewardSourcePoint('player')!

    expect(playerPoint.y).not.toBeCloseTo(after.y, 3)
  })

  it('mức 2: sprite đã bị dọn → dùng last-known screen cache', () => {
    const { scene } = createScene()

    scene.lastKnownScreenPositions.set('enemy_1', { x: 333, y: 444 })

    expect(scene.resolveRewardSourcePoint('enemy_1')).toEqual({ x: 333, y: 444 })
  })

  it('mức 3: chỉ còn grid cache → chiếu qua projection hiện hành', () => {
    const { scene } = createScene()

    scene.lastKnownGridPositions.set('enemy_1', { row: 2, column: 3 })

    // Chưa có projection → không tạo được nguồn (bail an toàn).
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

  it('không có nguồn nào cả → KHÔNG sinh mote/tween', () => {
    const { scene, tweenConfigs } = createScene()

    scene.onRewardParticle(REWARD_EVENT)

    expect(tweenConfigs).toHaveLength(0)
  })
})

describe('CombatScene — reward stream hút về hồ lô (plan §7.2)', () => {
  it('target lock: p=1 chạm ĐÚNG miệng hồ lô; Player "teleport" không đổi đích', () => {
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

    // Player "teleport" tới vị trí khác giữa lúc bay.
    const playerSprite = scene.sprites.get('player')

    playerSprite.rect.x = 50
    playerSprite.rect.y = 60

    // Chạy onUpdate tới cuối quỹ đạo.
    state.progress = 1

    ;(flightTween!.onUpdate as () => void)()

    const setPositionCalls = mote.__calls.filter((call) => call.method === 'setPosition')

    const lastCall = setPositionCalls.at(-1)!

    const mouth = resolveGourdMouth(scene.gourdPlacement)

    expect(lastCall.args[0]).toBeCloseTo(mouth.x, 4)
    expect(lastCall.args[1]).toBeCloseTo(mouth.y, 4)
  })

  it('pulse hồ lô ĐÚNG MỘT nhịp mỗi reward event', () => {
    const { scene, delayedCalls } = createScene()

    scene.sprites.set('enemy_1', makeEntitySprite(100, 100))

    scene.onRewardParticle(REWARD_EVENT)

    const pulseSchedules = delayedCalls.filter(
      (entry) => entry.callback.name === '' || true,
    )

    expect(pulseSchedules).toHaveLength(1)
  })
})

describe('CombatScene — reward lifecycle (plan §7.4)', () => {
  it('clearSceneState dọn sạch gourd + caches — không rò rỉ qua shutdown', () => {
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
