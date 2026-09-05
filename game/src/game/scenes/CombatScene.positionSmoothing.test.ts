// @vitest-environment jsdom
//
// electron-combat-timing-smoothing-plan.md má»¥c 4/5/11 â€” BattleSystem cÃ³
// thá»ƒ emit nhiá»u event 'positions' Äá»’NG Bá»˜ trong 1 outer tick (fixed-step
// catch-up + snapshot-trÆ°á»›c-attack/snapshot-cuá»‘i-update). TrÆ°á»›c Ä‘Ã¢y
// onPositions() gá»i setInterpolationTarget() NGAY cho má»i event, khiáº¿n
// Ä‘oáº¡n ná»™i suy cuá»‘i cÃ¹ng ghi Ä‘Ã¨ cÃ¡c Ä‘oáº¡n trÆ°á»›c báº±ng cadence gáº§n 0ms
// (this.time.now khÃ´ng Ä‘á»•i giá»¯a cÃ¡c lá»‡nh gá»i Ä‘á»“ng bá»™ trong cÃ¹ng 1 frame
// Phaser). Test nÃ y gá»i THáº²NG method private tháº­t (cÃ¹ng pattern
// CombatScene.projectile.test.ts) Ä‘á»ƒ bug tÆ°Æ¡ng tá»± tÃ¡i diá»…n sáº½ bá»‹ báº¯t láº¡i.
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'

// Stub Phaser GameObject chainable API (setOrigin/setPosition/setSize/
// updateDisplayOrigin/setStrokeStyle/setDisplaySize/play...) mÃ  khÃ´ng
// cáº§n liá»‡t kÃª tá»«ng method â€” má»i method tráº£ vá» CHÃNH object Ä‘Ã³ (chainable),
// property gÃ¡n/Ä‘á»c Ä‘Æ°á»£c nhÆ° object thÆ°á»ng (width/height/x/y/active...).
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
  const scene = createTestScene('bare')

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

describe('CombatScene â€” coalesce positions event (Phaser-driven)', () => {
  it('nhiá»u event positions Ä‘á»“ng bá»™ trÆ°á»›c 1 frame chá»‰ Ã¡p target cuá»‘i cÃ¹ng, Ä‘Ãºng 1 láº§n', () => {
    const { scene } = createScene()
    const reconcileSpy = vi.spyOn(scene, 'reconcileEnemySprites')

    scene.onPositions(positionsEvent({ playerX: 1 }))
    scene.onPositions(positionsEvent({ playerX: 2 }))
    scene.onPositions(positionsEvent({ playerX: 3 }))

    scene.update()

    expect(reconcileSpy).toHaveBeenCalledTimes(1)
    expect(scene.interpolations.get('player').toX).toBe(3)
  })

  it('khÃ´ng cÃ³ event má»›i thÃ¬ update() khÃ´ng Ã¡p gÃ¬ cáº£ (reconcile khÃ´ng cháº¡y)', () => {
    const { scene } = createScene()
    const reconcileSpy = vi.spyOn(scene, 'reconcileEnemySprites')

    scene.update()

    expect(reconcileSpy).not.toHaveBeenCalled()
  })

  it('cadence Ä‘o báº±ng lastSnapshotAt, khÃ´ng pháº£i segmentStart â€” 2 event trong cÃ¹ng millisecond khÃ´ng táº¡o Ä‘oáº¡n ná»™i suy gáº§n 0ms', () => {
    const { scene } = createScene()

    scene.time.now = 0
    scene.onPositions(positionsEvent({ playerX: 0 }))
    scene.update() // snap ban Ä‘áº§u

    scene.time.now = 100
    scene.onPositions(positionsEvent({ playerX: 10 }))
    scene.update()

    const entry = scene.interpolations.get('player')
    expect(entry.toX).toBe(10)
    expect(entry.segmentDuration).toBe(100)
    expect(entry.lastSnapshotAt).toBe(100)
  })

  it('cadence bá»‹ clamp sÃ n 50ms', () => {
    const { scene } = createScene()

    scene.time.now = 0
    scene.onPositions(positionsEvent({ playerX: 0 }))
    scene.update()

    scene.time.now = 10
    scene.onPositions(positionsEvent({ playerX: 5 }))
    scene.update()

    expect(scene.interpolations.get('player').segmentDuration).toBe(50)
  })

  it('cadence bá»‹ clamp tráº§n 200ms (catch-up sau khi trá»… lÃ¢u khÃ´ng táº¡o Ä‘oáº¡n ná»™i suy dÃ i báº¥t thÆ°á»ng)', () => {
    const { scene } = createScene()

    scene.time.now = 0
    scene.onPositions(positionsEvent({ playerX: 0 }))
    scene.update()

    scene.time.now = 5000
    scene.onPositions(positionsEvent({ playerX: 5 }))
    scene.update()

    expect(scene.interpolations.get('player').segmentDuration).toBe(200)
  })

  it('entity má»›i (enemy chÆ°a tá»«ng tháº¥y) snap Ä‘Ãºng vá»‹ trÃ­ spawn â€” fromX === toX', () => {
    const { scene } = createScene()

    scene.onPositions(
      positionsEvent({
        enemies: [
          { id: 'enemy_a', name: 'QuÃ¡i', x: 42, row: 2, currentHp: 10, maxHp: 10, isBoss: false },
        ],
      }),
    )

    scene.update()

    const entry = scene.interpolations.get('enemy_a')
    expect(entry.fromX).toBe(42)
    expect(entry.toX).toBe(42)
    expect(scene.sprites.has('enemy_a')).toBe(true)
  })

  it('entity Ä‘ang di chuyá»ƒn khÃ´ng teleport â€” váº«n ná»™i suy dáº§n tá»« fromX cÅ©, khÃ´ng nháº£y tháº³ng tá»›i toX', () => {
    const { scene } = createScene()

    scene.time.now = 0
    scene.onPositions(
      positionsEvent({
        enemies: [
          { id: 'enemy_a', name: 'QuÃ¡i', x: 0, row: 2, currentHp: 10, maxHp: 10, isBoss: false },
        ],
      }),
    )
    scene.update()

    scene.time.now = 100
    scene.onPositions(
      positionsEvent({
        enemies: [
          { id: 'enemy_a', name: 'QuÃ¡i', x: 100, row: 2, currentHp: 10, maxHp: 10, isBoss: false },
        ],
      }),
    )
    scene.update()

    // Ngay táº¡i thá»i Ä‘iá»ƒm Ã¡p snapshot má»›i â€” visual X báº¯t Ä‘áº§u tá»« vá»‹ trÃ­
    // CÅ¨ (0, chÆ°a nháº£y tá»›i 100), tiáº¿n dáº§n theo interpolate() á»Ÿ update() sau.
    scene.time.now = 100
    const entry = scene.interpolations.get('enemy_a')
    expect(entry.fromX).toBe(0)
    expect(entry.toX).toBe(100)
  })

  it('entity dá»«ng láº¡i (snapshot káº¿ tiáº¿p cÃ¹ng x) â€” khÃ´ng táº¡o Ä‘oáº¡n ná»™i suy má»›i, giá»¯ nguyÃªn target', () => {
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

  it('death/removal â€” enemy váº¯ng máº·t trong snapshot má»›i bá»‹ dá»n khá»i sprites/interpolations, khÃ´ng há»“i sinh', () => {
    const { scene } = createScene()

    scene.onPositions(
      positionsEvent({
        enemies: [
          { id: 'enemy_a', name: 'QuÃ¡i', x: 10, row: 2, currentHp: 10, maxHp: 10, isBoss: false },
        ],
      }),
    )
    scene.update()

    expect(scene.sprites.has('enemy_a')).toBe(true)

    // QuÃ¡i cháº¿t â€” emitPositions() cá»§a core CHá»ˆ liá»‡t kÃª quÃ¡i cÃ²n alive,
    // nÃªn snapshot káº¿ tiáº¿p khÃ´ng cÃ²n 'enemy_a' trong máº£ng enemies.
    scene.onPositions(positionsEvent({ enemies: [] }))
    scene.update()

    expect(scene.sprites.has('enemy_a')).toBe(false)
    expect(scene.interpolations.has('enemy_a')).toBe(false)
  })
})
