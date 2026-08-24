// Hover 2.5D — onPointerMove phải: (1) được đăng ký qua input.on trong
// create() (regression: từng thiếu line đăng ký), (2) ẩn marker khi
// pointer ngoài road polygon (sky/bên ngoài cạnh) thay vì "kẹt" ở hàng
// biên do inverse projection clamp.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'
import { createBattleGridProjection } from '../support/BattleGridProjection'

const VIEWPORT = { width: 1600, height: 900, topInset: 60, bottomInset: 52 }
const PROJECTION = createBattleGridProjection('perspective', VIEWPORT)
const BOUNDS = PROJECTION.bounds()
const ROAD_Y = BOUNDS.top + (BOUNDS.bottom - BOUNDS.top) * 0.7
const SKY_Y = VIEWPORT.topInset + (BOUNDS.top - VIEWPORT.topInset) / 2

function createMarker() {
  const visibleCalls: boolean[] = []

  return {
    visibleCalls,
    setSize: () => {},
    setPosition: () => {},
    setVisible: (visible: boolean) => {
      visibleCalls.push(visible)
    },
  }
}

function createScene() {
  const scene = Object.create(CombatScene.prototype) as any
  const marker = createMarker()

  scene.renderMode = 'perspective'
  scene.projection = PROJECTION
  scene.hoverMarker = marker
  scene.sprites = new Map()
  scene.interpolations = new Map()
  scene.castBars = new Map()
  scene.statuses = new Map()

  return { scene, marker }
}

describe('CombatScene onPointerMove — hover 2.5D', () => {
  it('create() đăng ký listener pointermove (regression: từng thiếu input.on)', () => {
    const scene = Object.create(CombatScene.prototype) as any
    const inputOn = vi.fn()

    // Stub tối thiểu để create() chạy qua được tới chỗ đăng ký listener:
    // texture/animation đã tồn tại, eventBus không có (bỏ qua subscribe).
    scene.textures = { exists: () => true }
    scene.anims = { exists: () => true }
    scene.scale = { width: VIEWPORT.width, height: VIEWPORT.height, on: vi.fn() }
    scene.input = { on: inputOn, off: vi.fn() }
    scene.events = { on: vi.fn(), once: vi.fn() }
    scene.cameras = { main: { setZoom: vi.fn() } }
    scene.time = { now: 0 }
    scene.game = { registry: { set: vi.fn() } }
    scene.registry = { get: () => undefined }
    scene.sprites = new Map()
    scene.interpolations = new Map()
    scene.castBars = new Map()
    scene.statuses = new Map()
    scene.add = new Proxy(
      {},
      {
        get: () => () => {
          const chain: Record<string, unknown> = {}
          const proxy: any = new Proxy(chain, {
            get: (obj, prop) => (prop in obj ? obj[prop as string] : () => proxy),
            set: (obj, prop, value) => {
              obj[prop as string] = value
              return true
            },
          })
          return proxy
        },
      },
    )
    scene.physics = { add: { existing: vi.fn() } }

    scene.create()

    expect(inputOn).toHaveBeenCalledWith('pointermove', scene.pointerMoveHandler)
  })

  it('pointer giữa sân → marker hiện tại ô chứa nó', () => {
    const { scene, marker } = createScene()

    scene.onPointerMove({ x: 800, y: ROAD_Y })

    expect(marker.visibleCalls.at(-1)).toBe(true)
  })

  it('pointer ở VÙNG PHONG CẢNH (giữa HUD và chân trời) → marker ẩn', () => {
    const { scene, marker } = createScene()

    scene.onPointerMove({ x: 800, y: SKY_Y })

    expect(marker.visibleCalls.at(-1)).toBe(false)
  })

  it('pointer trên HUD / dưới sân → marker ẩn', () => {
    const { scene, marker } = createScene()

    scene.onPointerMove({ x: 800, y: 20 })
    expect(marker.visibleCalls.at(-1)).toBe(false)

    scene.onPointerMove({ x: 800, y: 880 })
    expect(marker.visibleCalls.at(-1)).toBe(false)
  })

  it('pointer ngoài cạnh nghiêng (trapezoid thu hẹp về xa) → marker ẩn', () => {
    const { scene, marker } = createScene()

    // Gần đáy: cạnh gần rộng; điểm ngoài biên trái tuyệt đối.
    scene.onPointerMove({ x: 5, y: BOUNDS.bottom - 2 })
    expect(marker.visibleCalls.at(-1)).toBe(false)

    // Gần chân trời: cạnh xa hẹp ~nửa cạnh gần — điểm vẫn trong viewport
    // nhưng ngoài trapezoid.
    const farHalfWidth = (BOUNDS.right - BOUNDS.left) / 2
    scene.onPointerMove({ x: BOUNDS.centerX + farHalfWidth + 60, y: BOUNDS.top + 4 })
    expect(marker.visibleCalls.at(-1)).toBe(false)
  })

  it('flat mode: handler không làm gì (không có marker)', () => {
    const { scene, marker } = createScene()

    scene.renderMode = 'flat'
    scene.onPointerMove({ x: 800, y: ROAD_Y })

    expect(marker.visibleCalls).toHaveLength(0)
  })
})
