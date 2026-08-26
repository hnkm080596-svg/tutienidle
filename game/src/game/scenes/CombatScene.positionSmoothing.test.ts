// @vitest-environment jsdom
//
// electron-combat-timing-smoothing-plan.md mục 4/5/11 — BattleSystem có
// thể emit nhiều event 'positions' ĐỒNG BỘ trong 1 outer tick (fixed-step
// catch-up + snapshot-trước-attack/snapshot-cuối-update). Trước đây
// onPositions() gọi setInterpolationTarget() NGAY cho mọi event, khiến
// đoạn nội suy cuối cùng ghi đè các đoạn trước bằng cadence gần 0ms
// (this.time.now không đổi giữa các lệnh gọi đồng bộ trong cùng 1 frame
// Phaser). Test này gọi THẲNG method private thật (cùng pattern
// CombatScene.projectile.test.ts) để bug tương tự tái diễn sẽ bị bắt lại.
import { describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'
import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'

// Stub Phaser GameObject chainable API (setOrigin/setPosition/setSize/
// updateDisplayOrigin/setStrokeStyle/setDisplaySize/play...) mà không
// cần liệt kê từng method — mọi method trả về CHÍNH object đó (chainable),
// property gán/đọc được như object thường (width/height/x/y/active...).
function chainable(): any {
  const target: Record<string, unknown> = {}
  const proxy: any = new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as string]
      if (prop === 'destroy') return vi.fn()
      return (..._args: unknown[]) => proxy
    },
    set(obj, prop, value) {
      obj[prop as string] = value
      return true
    },
  })
  return proxy
}

function createScene() {
  const scene = Object.create(CombatScene.prototype) as any

  scene.sprites = new Map()
  scene.interpolations = new Map()
  scene.castBars = new Map()
  scene.statuses = new Map()
  scene.spawnVfxHandles = new Map()
  scene.materializingIds = new Set()
  scene.playerSpawnHandle = undefined
  scene.playerMaterialized = true
  scene.renderMode = 'flat'
  scene.lastKnownScreenPositions = new Map()
  scene.lastKnownGridPositions = new Map()
  scene.maxTrackedSourcePositions = 64
  scene.playerProfileId = 'mortal'
  scene.gridLeft = 0
  scene.gridTop = 0
  scene.cellSize = 50
  scene.dyingIds = new Set()
  scene.canvasWidth = 1000
  scene.canvasHeight = 600
  scene.characterWidth = 40
  scene.characterHeight = 50
  scene.laneRowCenterY = []
  scene.time = { now: 0 }

  scene.physics = {
    moveToObject: vi.fn(),
    overlap: vi.fn(() => false),
    add: { existing: vi.fn() },
  }

  scene.add = {
    text: vi.fn(() => chainable()),
    rectangle: vi.fn(() => chainable()),
    sprite: vi.fn(() => chainable()),
    circle: vi.fn(() => chainable()),
  }

  scene.eventBus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() }

  return { scene }
}

function positionsEvent(overrides: Partial<BattlePositionsEvent> = {}): BattlePositionsEvent {
  return {
    type: 'positions',
    playerX: 0,
    playerRow: 4,
    playerMaterialized: true,
    playerCurrentHp: 100,
    playerMaxHp: 100,
    enemies: [],
    ...overrides,
  }
}

describe('CombatScene — coalesce positions event (Phaser-driven)', () => {
  it('nhiều event positions đồng bộ trước 1 frame chỉ áp target cuối cùng, đúng 1 lần', () => {
    const { scene } = createScene()
    const reconcileSpy = vi.spyOn(scene, 'reconcileEnemySprites')

    scene.onPositions(positionsEvent({ playerX: 1 }))
    scene.onPositions(positionsEvent({ playerX: 2 }))
    scene.onPositions(positionsEvent({ playerX: 3 }))

    scene.update()

    expect(reconcileSpy).toHaveBeenCalledTimes(1)
    expect(scene.interpolations.get('player').toX).toBe(3)
  })

  it('không có event mới thì update() không áp gì cả (reconcile không chạy)', () => {
    const { scene } = createScene()
    const reconcileSpy = vi.spyOn(scene, 'reconcileEnemySprites')

    scene.update()

    expect(reconcileSpy).not.toHaveBeenCalled()
  })

  it('cadence đo bằng lastSnapshotAt, không phải segmentStart — 2 event trong cùng millisecond không tạo đoạn nội suy gần 0ms', () => {
    const { scene } = createScene()

    scene.time.now = 0
    scene.onPositions(positionsEvent({ playerX: 0 }))
    scene.update() // snap ban đầu

    scene.time.now = 100
    scene.onPositions(positionsEvent({ playerX: 10 }))
    scene.update()

    const entry = scene.interpolations.get('player')
    expect(entry.toX).toBe(10)
    expect(entry.segmentDuration).toBe(100)
    expect(entry.lastSnapshotAt).toBe(100)
  })

  it('cadence bị clamp sàn 50ms', () => {
    const { scene } = createScene()

    scene.time.now = 0
    scene.onPositions(positionsEvent({ playerX: 0 }))
    scene.update()

    scene.time.now = 10
    scene.onPositions(positionsEvent({ playerX: 5 }))
    scene.update()

    expect(scene.interpolations.get('player').segmentDuration).toBe(50)
  })

  it('cadence bị clamp trần 200ms (catch-up sau khi trễ lâu không tạo đoạn nội suy dài bất thường)', () => {
    const { scene } = createScene()

    scene.time.now = 0
    scene.onPositions(positionsEvent({ playerX: 0 }))
    scene.update()

    scene.time.now = 5000
    scene.onPositions(positionsEvent({ playerX: 5 }))
    scene.update()

    expect(scene.interpolations.get('player').segmentDuration).toBe(200)
  })

  it('entity mới (enemy chưa từng thấy) snap đúng vị trí spawn — fromX === toX', () => {
    const { scene } = createScene()

    scene.onPositions(
      positionsEvent({
        enemies: [
          { id: 'enemy_a', name: 'Quái', x: 42, row: 2, currentHp: 10, maxHp: 10, isBoss: false },
        ],
      }),
    )

    scene.update()

    const entry = scene.interpolations.get('enemy_a')
    expect(entry.fromX).toBe(42)
    expect(entry.toX).toBe(42)
    expect(scene.sprites.has('enemy_a')).toBe(true)
  })

  it('entity đang di chuyển không teleport — vẫn nội suy dần từ fromX cũ, không nhảy thẳng tới toX', () => {
    const { scene } = createScene()

    scene.time.now = 0
    scene.onPositions(
      positionsEvent({
        enemies: [
          { id: 'enemy_a', name: 'Quái', x: 0, row: 2, currentHp: 10, maxHp: 10, isBoss: false },
        ],
      }),
    )
    scene.update()

    scene.time.now = 100
    scene.onPositions(
      positionsEvent({
        enemies: [
          { id: 'enemy_a', name: 'Quái', x: 100, row: 2, currentHp: 10, maxHp: 10, isBoss: false },
        ],
      }),
    )
    scene.update()

    // Ngay tại thời điểm áp snapshot mới — visual X bắt đầu từ vị trí
    // CŨ (0, chưa nhảy tới 100), tiến dần theo interpolate() ở update() sau.
    scene.time.now = 100
    const entry = scene.interpolations.get('enemy_a')
    expect(entry.fromX).toBe(0)
    expect(entry.toX).toBe(100)
  })

  it('entity dừng lại (snapshot kế tiếp cùng x) — không tạo đoạn nội suy mới, giữ nguyên target', () => {
    const { scene } = createScene()

    scene.time.now = 0
    scene.onPositions(positionsEvent({ playerX: 50 }))
    scene.update()

    const beforeEntry = scene.interpolations.get('player')

    scene.time.now = 100
    scene.onPositions(positionsEvent({ playerX: 50 }))
    scene.update()

    const afterEntry = scene.interpolations.get('player')
    expect(afterEntry.toX).toBe(50)
    expect(afterEntry.segmentStart).toBe(beforeEntry.segmentStart)
  })

  it('death/removal — enemy vắng mặt trong snapshot mới bị dọn khỏi sprites/interpolations, không hồi sinh', () => {
    const { scene } = createScene()

    scene.onPositions(
      positionsEvent({
        enemies: [
          { id: 'enemy_a', name: 'Quái', x: 10, row: 2, currentHp: 10, maxHp: 10, isBoss: false },
        ],
      }),
    )
    scene.update()

    expect(scene.sprites.has('enemy_a')).toBe(true)

    // Quái chết — emitPositions() của core CHỈ liệt kê quái còn alive,
    // nên snapshot kế tiếp không còn 'enemy_a' trong mảng enemies.
    scene.onPositions(positionsEvent({ enemies: [] }))
    scene.update()

    expect(scene.sprites.has('enemy_a')).toBe(false)
    expect(scene.interpolations.has('enemy_a')).toBe(false)
  })
})
