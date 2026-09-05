// Lifecycle regression (migration gate P1/P5): listener resize Ä‘Äƒng kÃ½
// trÃªn ScaleManager (game-level) báº±ng anonymous callback tá»«ng TÃCH Tá»¤C
// qua má»—i láº§n Home â†’ Combat â€” N listener cÃ¹ng cháº¡y má»—i resize, scene bá»‹
// giá»¯ bá»Ÿi ScaleManager. create() pháº£i dÃ¹ng handler á»•n Ä‘á»‹nh + events.once
// Ä‘á»ƒ 10 láº§n vÃ o/ra váº«n Ä‘Ãºng 1 listener active táº¡i má»i thá»i Ä‘iá»ƒm.
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
// ?raw import (vite/client types) â€” Ä‘á»c source khÃ´ng cáº§n @types/node.
import combatSceneSource from './CombatScene.ts?raw'

const VIEWPORT = { width: 1600, height: 900 }

function createSceneWithStubs() {
  // new CombatScene() (khÃ´ng pháº£i Object.create) â€” PHáº¢I cháº¡y constructor
  // Ä‘á»ƒ class field resizeHandler/shutdownHandler cÃ³ identity tháº­t: test
  // nÃ y verify chÃ­nh tÃ­nh "cÃ¹ng 1 reference qua cÃ¡c láº§n create" cá»§a chÃºng.
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

  return { scene, activeResizeListeners, inputOn, inputOff, shutdownHandlers }
}

describe('CombatScene lifecycle â€” listener khÃ´ng tÃ­ch lÅ©y qua restart', () => {
  it('10 láº§n create â†’ shutdown: má»—i lÃºc sau create Ä‘Ãºng 1 resize listener, sau shutdown vá» 0', () => {
    const { scene, activeResizeListeners, inputOn, inputOff, shutdownHandlers } =
      createSceneWithStubs()

    for (let cycle = 0; cycle < 10; cycle++) {
      scene.create()

      expect(activeResizeListeners.size).toBe(1)

      // Combat tá»± Ä‘á»™ng hoÃ n toÃ n (yÃªu cáº§u 2026-08-26) â€” KHÃ”NG Ä‘Äƒng kÃ½
      // báº¥t ká»³ input listener nÃ o ná»¯a (hover circle Ä‘Ã£ gá»¡).
      expect(inputOn).not.toHaveBeenCalled()

      // KÃ­ch hoáº¡t shutdown handler mÃ  events.once Ä‘Ã£ Ä‘Äƒng kÃ½.
      const shutdownHandler = shutdownHandlers.at(-1)

      expect(shutdownHandler).toBeDefined()
      shutdownHandler!()

      expect(activeResizeListeners.size).toBe(0)
      expect(inputOff).not.toHaveBeenCalled()
    }

    // 10 chu ká»³ = váº«n KHÃ”NG cÃ³ input listener nÃ o tÃ­ch lÅ©y.
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

    // 1 listener Ã— 2 láº§n báº¯n = Ä‘Ãºng 2 láº§n layout (khÃ´ng nhÃ¢n Ä‘Ã´i).
    expect(layoutSpy).toHaveBeenCalledTimes(2)
  })

  it('depth lÃ  há»‡ tá»a Ä‘á»™ á»•n Ä‘á»‹nh â€” updateEntityDepths khÃ´ng remap min/max road bounds', () => {
    const { scene } = createSceneWithStubs()

    scene.create()

    const minBefore = scene.entityFootMinY
    const maxBefore = scene.entityFootMaxY

    // Giáº£ láº­p spawn/death: sprites thÃªm/bá»›t rá»“i sort láº¡i nhiá»u frame.
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
    // Stub khÃ´ng mÃ´ phá»ng Ä‘Æ°á»£c auto-remove cá»§a events.once â€” khÃ³a báº±ng
    // source assertion: cáº¥m .on('shutdown') (tÃ­ch lÅ©y) vÃ  anonymous
    // resize callback (má»—i create má»™t reference má»›i).
    expect(combatSceneSource).toContain("this.scale.on('resize', this.resizeHandler)")
    expect(combatSceneSource).toContain("this.scale.off('resize', this.resizeHandler)")
    expect(combatSceneSource).toContain("this.events.once('shutdown', this.shutdownHandler)")
    expect(combatSceneSource).not.toContain("this.events.on('shutdown'")
    expect(combatSceneSource).not.toMatch(/scale\.on\('resize', \(/)
  })

  it('onBattleStart pháº£i dá»n statuses (icon DoT khÃ´ng sÃ³t qua auto-refight)', () => {
    // onBattleStart pháº£i clear statuses â€” match body method (source-contract,
    // cÃ¹ng giá»›i háº¡n vá»›i cÃ¡c case khÃ¡c trong file nÃ y).
    const onBattleStartBody =
      combatSceneSource.match(/onBattleStart\(\) \{[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(onBattleStartBody).toMatch(/statuses/)
  })
})
