// @vitest-environment jsdom
//
// Bug 2026-08-22: logic di chuyển + va chạm projectile từng bị đặt nhầm
// trong applySpriteSize() (chỉ chạy lúc tạo sprite/resize) thay vì
// update() (chạy mỗi frame thật) — đạn đứng yên vĩnh viễn, kéo theo
// TOÀN BỘ damage missile về 0 vì BattleSystem tắt hẳn fallback headless
// khi Phaser điều khiển va chạm (coreProjectileFallback=false). Test này
// gọi THẲNG các method private thật của CombatScene (update/onProjectileSpawned/
// onProjectileRetargeted) để bug tương tự tái diễn sẽ bị bắt lại, thay vì
// tái hiện logic ở nơi khác.
//
// Trước đây file này bị bỏ vì `phaser` đụng window/document/Image ngay
// lúc import trong môi trường 'node' thuần (vite.config.ts's mặc định) —
// cascade global thiếu không có điểm dừng nếu tự stub tay. Đã cài jsdom
// (2026-08-22, theo yêu cầu người dùng) làm devDependency RIÊNG cho việc
// này — chỉ đạo docblock `@vitest-environment jsdom` ở TRÊN áp dụng CHO
// FILE NÀY thôi (không đổi environment mặc định 'node' của toàn bộ suite,
// giữ các test khác nhanh/nhẹ như cũ). jsdom cấp đủ window/document/Image
// thật để import `phaser` sống sót — KHÔNG cần thêm `canvas` (WebGL/2D
// context) vì ta không thực sự dựng `new Phaser.Game()`/render gì cả, chỉ
// gọi thẳng method trên prototype (xem createScene() bên dưới).
import { describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'

// Không dựng Phaser.Scene thật (không cần WebGL/2D context, không muốn
// chờ boot lifecycle async của Phaser.Game) — Object.create(prototype)
// rồi tự set field private cần thiết + stub tối thiểu API Phaser thật sự
// được gọi (physics/add/eventBus), gọi thẳng method thật trên prototype.
function createScene() {
  const scene = Object.create(CombatScene.prototype) as any

  scene.sprites = new Map()
  scene.interpolations = new Map()
  scene.castBars = new Map()
  scene.projectiles = new Map()
  scene.dyingIds = new Set()
  scene.canvasWidth = 1000
  scene.canvasHeight = 600
  scene.time = { now: 0 }

  const moveToObject = vi.fn()
  const overlapState = { value: false }
  const overlap = vi.fn(() => overlapState.value)
  const emit = vi.fn()

  scene.physics = {
    moveToObject,
    overlap,
    add: {
      existing: vi.fn((obj: any) => {
        obj.body = { setAllowGravity: vi.fn() }
      }),
    },
  }

  scene.add = {
    circle: vi.fn(() => ({ x: 0, y: 0, destroy: vi.fn() })),
  }

  scene.eventBus = { emit, on: vi.fn(), off: vi.fn() }

  return { scene, moveToObject, overlap, overlapState, emit }
}

function fakeSprite(x: number, y: number) {
  return {
    kind: 'rect' as const,
    rect: { x, y, active: true, setPosition: vi.fn() },
    label: { setPosition: vi.fn() },
    color: 0,
    offsetX: 0,
    lane: 2 as const,
  }
}

const SPAWN_PAYLOAD = { projectileId: 'p1', sourceId: 'player', targetId: 'enemy_a', speed: 500, homing: false }

describe('CombatScene — projectile movement/collision (Phaser-driven)', () => {
  it('update() thật sự di chuyển đạn homing mỗi frame — không chỉ lúc spawn/resize', () => {
    const { scene, moveToObject } = createScene()

    scene.sprites.set('player', fakeSprite(0, 0))
    scene.sprites.set('enemy_a', fakeSprite(200, 0))

    scene.onProjectileSpawned({ ...SPAWN_PAYLOAD, homing: true })
    moveToObject.mockClear()

    scene.update()
    scene.update()
    scene.update()

    expect(moveToObject).toHaveBeenCalledTimes(3)
  })

  it('đạn KHÔNG homing chỉ set velocity 1 lần lúc spawn — update() không gọi lại moveToObject', () => {
    const { scene, moveToObject } = createScene()

    scene.sprites.set('player', fakeSprite(0, 0))
    scene.sprites.set('enemy_a', fakeSprite(200, 0))

    scene.onProjectileSpawned({ ...SPAWN_PAYLOAD, homing: false })

    expect(moveToObject).toHaveBeenCalledTimes(1)

    scene.update()
    scene.update()

    expect(moveToObject).toHaveBeenCalledTimes(1)
  })

  it('overlap trúng đích → update() emit đúng 1 sự kiện projectile_impact với đúng id', () => {
    const { scene, overlapState, emit } = createScene()

    scene.sprites.set('player', fakeSprite(0, 0))
    scene.sprites.set('enemy_a', fakeSprite(200, 0))

    scene.onProjectileSpawned(SPAWN_PAYLOAD)
    overlapState.value = true

    scene.update()

    expect(emit).toHaveBeenCalledWith('projectile_impact', { projectileId: 'p1', targetId: 'enemy_a' })
  })

  it('chưa overlap thì KHÔNG emit projectile_impact', () => {
    const { scene, emit } = createScene()

    scene.sprites.set('player', fakeSprite(0, 0))
    scene.sprites.set('enemy_a', fakeSprite(200, 0))

    scene.onProjectileSpawned(SPAWN_PAYLOAD)
    scene.update()

    expect(emit).not.toHaveBeenCalledWith('projectile_impact', expect.anything())
  })

  it('mục tiêu không còn active (đã bị huỷ sprite) — tự dọn projectile, không emit impact', () => {
    const { scene, emit } = createScene()
    const target = fakeSprite(200, 0)

    scene.sprites.set('player', fakeSprite(0, 0))
    scene.sprites.set('enemy_a', target)

    scene.onProjectileSpawned(SPAWN_PAYLOAD)
    target.rect.active = false

    scene.update()

    expect(scene.projectiles.has('p1')).toBe(false)
    expect(emit).not.toHaveBeenCalledWith('projectile_impact', expect.anything())
  })

  it('Pierce/Bounce retarget: đạn không-homing recompute velocity NGAY, không đợi frame sau', () => {
    const { scene, moveToObject } = createScene()

    scene.sprites.set('player', fakeSprite(0, 0))
    scene.sprites.set('enemy_a', fakeSprite(200, 0))
    scene.sprites.set('enemy_b', fakeSprite(300, 0))

    scene.onProjectileSpawned(SPAWN_PAYLOAD)
    moveToObject.mockClear()

    scene.onProjectileRetargeted({ projectileId: 'p1', targetId: 'enemy_b' })

    expect(moveToObject).toHaveBeenCalledTimes(1)
    expect(scene.projectiles.get('p1').targetId).toBe('enemy_b')
  })

  it('Pierce/Bounce retarget: đạn homing KHÔNG cần recompute ngay (đã tự bám mỗi frame)', () => {
    const { scene, moveToObject } = createScene()

    scene.sprites.set('player', fakeSprite(0, 0))
    scene.sprites.set('enemy_a', fakeSprite(200, 0))
    scene.sprites.set('enemy_b', fakeSprite(300, 0))

    scene.onProjectileSpawned({ ...SPAWN_PAYLOAD, homing: true })
    moveToObject.mockClear()

    scene.onProjectileRetargeted({ projectileId: 'p1', targetId: 'enemy_b' })

    expect(moveToObject).not.toHaveBeenCalled()
    expect(scene.projectiles.get('p1').targetId).toBe('enemy_b')
  })
})
