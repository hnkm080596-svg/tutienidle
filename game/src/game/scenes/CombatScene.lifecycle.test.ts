// Lifecycle regression (migration gate P1/P5): listener resize đăng ký
// trên ScaleManager (game-level) bằng anonymous callback từng TÍCH TỤC
// qua mỗi lần Home → Combat — N listener cùng chạy mỗi resize, scene bị
// giữ bởi ScaleManager. create() phải dùng handler ổn định + events.once
// để 10 lần vào/ra vẫn đúng 1 listener active tại mọi thời điểm.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'
// ?raw import (vite/client types) — đọc source không cần @types/node.
import combatSceneSource from './CombatScene.ts?raw'

const VIEWPORT = { width: 1600, height: 900 }

function createSceneWithStubs() {
  // new CombatScene() (không phải Object.create) — PHẢI chạy constructor
  // để class field resizeHandler/shutdownHandler có identity thật: test
  // này verify chính tính "cùng 1 reference qua các lần create" của chúng.
  const scene = new CombatScene() as any

  const activeResizeListeners = new Set<unknown>()
  const inputOn = vi.fn()
  const inputOff = vi.fn()
  const shutdownHandlers: Array<() => void> = []

  scene.textures = { exists: () => true }
  scene.anims = { exists: () => true }
  scene.scale = {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    on: (_event: string, handler: (size: unknown) => void) => {
      activeResizeListeners.add(handler)
    },
    off: (_event: string, handler: (size: unknown) => void) => {
      activeResizeListeners.delete(handler)
    },
  }
  scene.input = { on: inputOn, off: inputOff }
  scene.events = {
    once: (_event: string, handler: () => void) => {
      shutdownHandlers.push(handler)
    },
  }
  scene.cameras = { main: { setZoom: vi.fn() } }
  scene.time = { now: 0 }
  scene.game = { registry: { set: vi.fn() } }
  scene.registry = { get: () => undefined }
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

  return { scene, activeResizeListeners, inputOn, inputOff, shutdownHandlers }
}

describe('CombatScene lifecycle — listener không tích lũy qua restart', () => {
  it('10 lần create → shutdown: mỗi lúc sau create đúng 1 resize listener, sau shutdown về 0', () => {
    const { scene, activeResizeListeners, inputOn, inputOff, shutdownHandlers } =
      createSceneWithStubs()

    for (let cycle = 0; cycle < 10; cycle++) {
      scene.create()

      expect(activeResizeListeners.size).toBe(1)

      // Combat tự động hoàn toàn (yêu cầu 2026-08-26) — KHÔNG đăng ký
      // bất kỳ input listener nào nữa (hover circle đã gỡ).
      expect(inputOn).not.toHaveBeenCalled()

      // Kích hoạt shutdown handler mà events.once đã đăng ký.
      const shutdownHandler = shutdownHandlers.at(-1)

      expect(shutdownHandler).toBeDefined()
      shutdownHandler!()

      expect(activeResizeListeners.size).toBe(0)
      expect(inputOff).not.toHaveBeenCalled()
    }

    // 10 chu kỳ = vẫn KHÔNG có input listener nào tích lũy.
    expect(inputOn).not.toHaveBeenCalled()
    expect(inputOff).not.toHaveBeenCalled()
  })

  it('resize bắn N lần sau khi vào combat — layout chỉ chạy qua listener duy nhất', () => {
    const { scene, activeResizeListeners } = createSceneWithStubs()

    scene.create()

    const layoutSpy = vi.spyOn(scene, 'applyBattlefieldLayout')
    const listener = [...activeResizeListeners][0] as (size: {
      width: number
      height: number
    }) => void

    listener({ width: 1280, height: 720 })
    listener({ width: 1440, height: 810 })

    // 1 listener × 2 lần bắn = đúng 2 lần layout (không nhân đôi).
    expect(layoutSpy).toHaveBeenCalledTimes(2)
  })

  it('depth là hệ tọa độ ổn định — updateEntityDepths không remap min/max road bounds', () => {
    const { scene } = createSceneWithStubs()

    scene.create()

    const minBefore = scene.entityFootMinY
    const maxBefore = scene.entityFootMaxY

    // Giả lập spawn/death: sprites thêm/bớt rồi sort lại nhiều frame.
    scene.sprites.set('a', { footY: 500, columnFloat: 3, rect: { setDepth: vi.fn() } })
    scene.updateEntityDepths()

    expect(scene.entityFootMinY).toBe(minBefore)
    expect(scene.entityFootMaxY).toBe(maxBefore)

    scene.sprites.delete('a')
    scene.updateEntityDepths()

    expect(scene.entityFootMinY).toBe(minBefore)
    expect(scene.entityFootMaxY).toBe(maxBefore)
  })

  it('geometry snapshot cho e2e được ghi vào registry mỗi layout', () => {
    const { scene } = createSceneWithStubs()

    scene.create()

    const setCalls = scene.game.registry.set.mock.calls as Array<[string, unknown]>
    const geometryCall = setCalls.find(([key]) => key === 'battlefieldGeometry')

    expect(geometryCall).toBeDefined()

    const snapshot = geometryCall![1] as {
      horizonY: number
      roadBottomY: number
      viewportHeight: number
    }

    expect(snapshot.viewportHeight).toBe(VIEWPORT.height)
    expect(snapshot.roadBottomY).toBeGreaterThan(snapshot.horizonY)
  })

  it('source khóa lifecycle đúng: scale.on/off cùng handler ổn định + events.once', () => {
    // Stub không mô phỏng được auto-remove của events.once — khóa bằng
    // source assertion: cấm .on('shutdown') (tích lũy) và anonymous
    // resize callback (mỗi create một reference mới).
    expect(combatSceneSource).toContain("this.scale.on('resize', this.resizeHandler)")
    expect(combatSceneSource).toContain("this.scale.off('resize', this.resizeHandler)")
    expect(combatSceneSource).toContain("this.events.once('shutdown', this.shutdownHandler)")
    expect(combatSceneSource).not.toContain("this.events.on('shutdown'")
    expect(combatSceneSource).not.toMatch(/scale\.on\('resize', \(/)
  })
})
