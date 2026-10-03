// Lifecycle regression (migration gate P1/P5): listener resize dang ky
// tren ScaleManager (game-level) bang anonymous callback tung TICH TUC
// qua moi lan Home -> Combat - N listener cung chay moi resize, scene bI
// giu boi ScaleManager. create() phai dung handler on dInh + events.once
// de 10 lan vao/ra van dung 1 listener active tai moi thoi diem.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
// ?raw import (vite/client types) - doc source khong can @types/node.
import combatSceneSource from './CombatScene.ts?raw'

const VIEWPORT = { width: 1600, height: 900 }

function createSceneWithStubs() {
  // new CombatScene() (khong phai Object.create) - PHAI chay constructor
  // de class field resizeHandler/shutdownHandler co identity that: test
  // nay verify chinh tinh "cung 1 reference qua cac lan create" cua chung.
  const scene = createTestScene()

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
  // Static-mode entities bob via a tween (uniformity 2026-09-19) - stub the
  // tween manager so sprite creation doesn't need a real Tweens plugin.
  scene.tweens = { add: vi.fn(), killTweensOf: vi.fn() }

  return { scene, activeResizeListeners, inputOn, inputOff, shutdownHandlers }
}

describe('CombatScene lifecycle â€” listener khÃ´ng tÃ­ch lÅ©y qua restart', () => {
  it('10 láº§n create â†’ shutdown: má»—i lÃºc sau create Ä‘Ãºng 1 resize listener, sau shutdown vá» 0', () => {
    const { scene, activeResizeListeners, inputOn, inputOff, shutdownHandlers } =
      createSceneWithStubs()

    for (let cycle = 0; cycle < 10; cycle++) {
      scene.create()

      expect(activeResizeListeners.size).toBe(1)

      // Combat tu dong hoan toan (yeu cau 2026-08-26) - KHONG dang ky
      // bat ky input listener nao nua (hover circle da go).
      expect(inputOn).not.toHaveBeenCalled()

      // Kich hoat shutdown handler ma events.once da dang ky.
      const shutdownHandler = shutdownHandlers.at(-1)

      expect(shutdownHandler).toBeDefined()
      shutdownHandler!()

      expect(activeResizeListeners.size).toBe(0)
      expect(inputOff).not.toHaveBeenCalled()
    }

    // 10 chu ky = van KHONG co input listener nao tich luy.
    expect(inputOn).not.toHaveBeenCalled()
    expect(inputOff).not.toHaveBeenCalled()
  })

  it('resize báº¯n N láº§n sau khi vÃ o combat â€” layout chá»‰ cháº¡y qua listener duy nháº¥t', () => {
    const { scene, activeResizeListeners } = createSceneWithStubs()

    scene.create()

    const layoutSpy = vi.spyOn(scene, 'applyBattlefieldLayout')
    const listener = [...activeResizeListeners][0] as (size: {
      width: number
      height: number
    }) => void

    listener({ width: 1280, height: 720 })
    listener({ width: 1440, height: 810 })

    // 1 listener x 2 lan ban = dung 2 lan layout (khong nhan doi).
    expect(layoutSpy).toHaveBeenCalledTimes(2)
  })

  it('depth lÃ  há»‡ tá»a Ä‘á»™ á»•n Ä‘á»‹nh â€” updateEntityDepths khÃ´ng remap min/max road bounds', () => {
    const { scene } = createSceneWithStubs()

    scene.create()

    const minBefore = scene.entityFootMinY
    const maxBefore = scene.entityFootMaxY

    // Gia lap spawn/death: sprites them/bOt roi sort lai nhieu frame.
    scene.sprites.set('a', { footY: 500, columnFloat: 3, rect: { setDepth: vi.fn() } })
    scene.updateEntityDepths()

    expect(scene.entityFootMinY).toBe(minBefore)
    expect(scene.entityFootMaxY).toBe(maxBefore)

    scene.sprites.delete('a')
    scene.updateEntityDepths()

    expect(scene.entityFootMinY).toBe(minBefore)
    expect(scene.entityFootMaxY).toBe(maxBefore)
  })

  it('geometry snapshot cho e2e Ä‘Æ°á»£c ghi vÃ o registry má»—i layout', () => {
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

  it('source khÃ³a lifecycle Ä‘Ãºng: scale.on/off cÃ¹ng handler á»•n Ä‘á»‹nh + events.once', () => {
    // Stub khong mo phong duoc auto-remove cua events.once - khoa bang
    // source assertion: cam .on('shutdown') (tich luy) va anonymous
    // resize callback (moi create mot reference mOi).
    expect(combatSceneSource).toContain("this.scale.on('resize', this.resizeHandler)")
    expect(combatSceneSource).toContain("this.scale.off('resize', this.resizeHandler)")
    expect(combatSceneSource).toContain("this.events.once('shutdown', this.shutdownHandler)")
    expect(combatSceneSource).not.toContain("this.events.on('shutdown'")
    expect(combatSceneSource).not.toMatch(/scale\.on\('resize', \(/)
  })

  it('onBattleStart pháº£i dá»n statuses (icon DoT khÃ´ng sÃ³t qua auto-refight)', () => {
    // onBattleStart phai clear statuses - match body method (source-contract,
    // cung giOi han vOi cac case khac trong file nay).
    const onBattleStartBody =
      combatSceneSource.match(/onBattleStart\([^)]*\) \{[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(onBattleStartBody).toMatch(/statuses/)
  })

  it('rebindSession phải báo rebind cho onBattleStart để camera-latch sống qua reattach cùng session', () => {
    // Pin source-contract: same sessionId => rebind (keep latch);
    // different/undefined session => battle start (clear latch).
    expect(combatSceneSource).toMatch(/context\.sessionId !== undefined &&\s*context\.sessionId === this\.initSessionId/)
    expect(combatSceneSource).toMatch(/onBattleStart\(\{ rebind: isSameSessionRebind \}\)/)
    expect(combatSceneSource).toMatch(/_skillVfxDriver\?\.reset\(options\?\.rebind \? 'rebind' : 'battle'\)/)
  })
})
