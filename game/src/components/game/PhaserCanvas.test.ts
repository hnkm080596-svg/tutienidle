// @vitest-environment jsdom
// Task 4 (perf-optimize-pass, phần 3) — bootstrap error boundary.
// Mô phỏng 2 đường lỗi của khối bootstrap async trong PhaserCanvas.vue:
//   1) new Phaser.Game() throw (dòng đầu setupGame()).
//   2) lỗi throw SAU khi đã đăng ký EventBus handler (mô phỏng qua
//      ResizeObserver.observe() throw — statement cuối setupGame()).
// Cả 2 đều phải: không unhandled rejection, dọn dẹp EventBus handler/
// resizeObserver/game/window.__tutienPhaserGame đã đăng ký (nếu có),
// và set bootError CỤC BỘ (KHÔNG route qua errorStore/ErrorScreen.vue
// toàn app — xem code review Task 4 finding 2, fix report).
//
// import('phaser') reject thẳng (trước khi vào setupGame()) không có
// pattern mock ổn định trong repo này (vi.doMock cho 1 factory throw
// làm hỏng cache module cho các test sau trong cùng file — không đáng
// công sức ép cho 1 task nhỏ, xem ghi chú task-4-report.md) — 2 test
// dưới đây đã phủ đúng yêu cầu cốt lõi: try/catch bọc quanh CẢ khối
// import lẫn setupGame(), và cleanup chạy đúng dù lỗi xảy ra ở đâu
// trong khối đó.
//
// Mount theo pattern project (createApp + h + provide, KHÔNG
// @vue/test-utils — xem CombatExitConfirmModal.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, ref, type App, type Ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import { GAME_MANAGER_KEY } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import {
  VUE_ROUTE_ADAPTER_KEY,
  type Route,
} from '@/presentation/PresentationContracts'
import type { VueRouteAdapter } from '@/presentation/VueRouteAdapter'
import PhaserCanvas from './PhaserCanvas.vue'

// Scene modules import 'phaser' ở top-level (extends Phaser.Scene) —
// mock hẳn ra để test không phụ thuộc runtime WebGL/canvas thật.
vi.mock('@/game/scenes/AssetLoaderScene', () => ({
  AssetLoaderScene: class {},
  ASSET_LOADER_SCENE_KEY: 'AssetLoaderScene',
}))
vi.mock('@/game/scenes/MainScene', () => ({ MainScene: class {} }))
vi.mock('@/game/scenes/CombatScene', () => ({ CombatScene: class {} }))
vi.mock('@/game/scenes/TribulationScene', () => ({ TribulationScene: class {} }))

// vi.hoisted — state mutable đọc được bên trong factory vi.mock('phaser')
// (factory bị hoist lên đầu file, không được đóng gói biến top-level
// thường; đây là cách vitest khuyến nghị để factory vẫn phản ứng theo
// từng test).
const { gameCtor, phaserMockState } = vi.hoisted(() => ({
  gameCtor: vi.fn(),
  phaserMockState: { failGameCtor: false },
}))

vi.mock('phaser', () => {
  class FakeGame {
    // A real Phaser registry reads as well as writes, and the host now
    // validates its own seeding through it (PresentationGate.assertGateSeeded).
    // A write-only fake made setupGame() fail with "registry.get is not a
    // function" before it reached the error this suite is actually about.
    private readonly registryStore = new Map<string, unknown>()
    registry = {
      set: vi.fn((key: string, value: unknown) => void this.registryStore.set(key, value)),
      get: vi.fn((key: string) => this.registryStore.get(key)),
    }
    scale = { resize: vi.fn() }
    // A real Phaser.Game has an event emitter; the host subscribes 'ready' on it.
    events = { once: vi.fn(), emit: vi.fn(), on: vi.fn(), off: vi.fn() }
    destroy = vi.fn()
    scene = { getScene: vi.fn(() => null) }

    constructor(config: unknown) {
      gameCtor(config)

      if (phaserMockState.failGameCtor) {
        throw new Error('mock: Phaser.Game khởi tạo thất bại')
      }
    }
  }

  return {
    default: {
      AUTO: 'AUTO',
      Game: FakeGame,
    },
  }
})

interface MockGameManager {
  eventBus: {
    on: ReturnType<typeof vi.fn>
    off: ReturnType<typeof vi.fn>
    emit: ReturnType<typeof vi.fn>
  }
}

function makeGameManager(): MockGameManager {
  return {
    eventBus: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }
}

let app: App | null = null
let container: HTMLDivElement | null = null
let pinia: Pinia | null = null

beforeEach(() => {
  gameCtor.mockClear()
  phaserMockState.failGameCtor = false
})

afterEach(() => {
  app?.unmount()
  app = null

  container?.remove()
  container = null

  pinia = null

  delete (window as { __tutienPhaserGame?: unknown }).__tutienPhaserGame

  vi.unstubAllGlobals()
})

/**
 * The retry hook only reads two adapter fields — a partial carrying those
 * refs is enough to drive it (the real adapter mirrors coordinator
 * snapshots; the fake writes them directly).
 */
interface FakeRouteAdapter {
  transitionId: Ref<number>
  targetRoute: Ref<Route | null>
}

function makeRouteAdapter(): FakeRouteAdapter {
  return {
    transitionId: ref(0),
    targetRoute: ref<Route | null>(null),
  }
}

function mountCanvas(gm: MockGameManager, routeAdapter?: FakeRouteAdapter) {
  container = document.createElement('div')
  document.body.appendChild(container)

  // app.mount() trả về root instance của WRAPPER ({ render: () => h(...) }),
  // KHÔNG phải instance của PhaserCanvas — phải bắt qua template ref
  // để đọc được giá trị defineExpose({ bootError }) của nó.
  const canvasRef = ref<{ bootError: string | null } | null>(null)

  app = createApp({ render: () => h(PhaserCanvas, { ref: canvasRef }) })

  pinia = createPinia()
  app.use(pinia)
  app.provide(GAME_MANAGER_KEY, gm as unknown as import('@/core/game/GameManager').GameManager)

  if (routeAdapter) {
    app.provide(VUE_ROUTE_ADAPTER_KEY, routeAdapter as unknown as VueRouteAdapter)
  }

  // usePlayerStore() cần pinia active trước khi mount.
  usePlayerStore(pinia)

  app.mount(container)

  if (!canvasRef.value) {
    throw new Error('PhaserCanvas template ref không gắn được sau mount()')
  }

  return { instance: canvasRef.value }
}

async function waitForBootError(instance: { bootError: string | null }) {
  for (let i = 0; i < 50; i += 1) {
    if (instance.bootError !== null) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

describe('PhaserCanvas — bootstrap error boundary (Task 4)', () => {
  it('new Phaser.Game() throw ngay dòng đầu setupGame() → bootError set, không có handler mồ côi', async () => {
    phaserMockState.failGameCtor = true

    const gm = makeGameManager()

    // Không có "unhandled rejection" nào lọt ra — nếu try/catch trong
    // component thiếu, `await Promise.all([...])`/setupGame() throw sẽ
    // làm chính IIFE async đó reject không ai bắt (vitest sẽ tự fail
    // test file với lỗi "Unhandled Rejection" nếu điều đó xảy ra), nên
    // việc mountCanvas + waitForBootError chạy xong sạch sẽ tới cuối
    // (không có unhandled rejection nào được vitest báo) đã là bằng
    // chứng gián tiếp đủ mà không cần tự cài process listener.
    const { instance } = mountCanvas(gm)

    await waitForBootError(instance)

    expect(instance.bootError).toContain('Phaser.Game khởi tạo thất bại')

    // new Phaser.Game(...) là dòng ĐẦU TIÊN của setupGame() (xem
    // PhaserCanvas.vue) — throw ở đây nghĩa là chưa có eventBus.on()
    // nào chạy tới, nên off() cũng không cần gọi. Test này khẳng định
    // đúng invariant đó (không giả định nhầm có state mồ côi).
    expect(gm.eventBus.on).not.toHaveBeenCalled()
    expect(gm.eventBus.off).not.toHaveBeenCalled()
  })

  it('lỗi SAU khi setupGame() đã đăng ký EventBus handler (ResizeObserver.observe throw) → cleanup đầy đủ', async () => {
    const resizeObserverDisconnect = vi.fn()
    const resizeObserverObserve = vi.fn(() => {
      throw new Error('mock: ResizeObserver.observe thất bại')
    })

    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = resizeObserverObserve
        disconnect = resizeObserverDisconnect
        unobserve = vi.fn()
      },
    )

    const gm = makeGameManager()

    const { instance } = mountCanvas(gm)

    await waitForBootError(instance)

    expect(instance.bootError).toContain('ResizeObserver.observe thất bại')

    // setupGame() đã kịp new Phaser.Game() thành công + đăng ký 2
    // EventBus handler (battle_end/combat_scene_exit — ARCH-014 retired
    // the dead 'positions' listener: no live producer) + set
    // window.__tutienPhaserGame + tạo resizeObserver TRƯỚC khi observe()
    // throw — catch phải dọn HẾT: off() lại đúng 2 handler, disconnect()
    // resizeObserver, VÀ reset window.__tutienPhaserGame về undefined
    // (code review Task 4 finding 1 — trước fix, global này bị bỏ sót,
    // để lại tham chiếu mồ côi tới 1 Phaser.Game đã destroy cho tooling
    // e2e/visual-gate đọc registry qua đó).
    expect(gameCtor).toHaveBeenCalledOnce()
    expect(gm.eventBus.on).toHaveBeenCalledTimes(2)
    expect(gm.eventBus.off).toHaveBeenCalledTimes(2)
    expect(resizeObserverDisconnect).toHaveBeenCalledTimes(1)
    expect((window as { __tutienPhaserGame?: unknown }).__tutienPhaserGame).toBeUndefined()
  })
})

describe('PhaserCanvas — host bootstrap retry hook (ARCH-013/L04)', () => {
  beforeEach(() => {
    // jsdom has no ResizeObserver — a SUCCESSFUL construct() reaches
    // observe(), so the healthy/retry tests need a working stub (the
    // existing suite only ever exercised the throwing path on purpose).
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
      },
    )
  })

  // L04 gap: import/construct failure leaves the region's game === null and
  // bootError set, while a failed game-route transition keeps this component
  // mounted. coordinator.retry()/Back only re-run the TRANSITION — they
  // cannot recreate the Phaser.Game — so the host must reboot itself when a
  // new transition (transitionId bump) targets a Phaser-backed route.
  async function waitFor(assertion: () => void) {
    for (let i = 0; i < 50; i += 1) {
      try {
        assertion()
        return
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
    assertion()
  }

  it('construct failure + transitionId bump toward a game route → bootstrap retried', async () => {
    phaserMockState.failGameCtor = true
    const routeAdapter = makeRouteAdapter()
    const gm = makeGameManager()

    const { instance } = mountCanvas(gm, routeAdapter)

    await waitForBootError(instance)
    expect(instance.bootError).toContain('Phaser.Game khởi tạo thất bại')
    expect(gameCtor).toHaveBeenCalledTimes(1)

    // Retry path: the coordinator admits a new transition with the failed
    // (Phaser-backed) target already recorded — transitionId bumps first.
    phaserMockState.failGameCtor = false
    routeAdapter.targetRoute.value = 'home'
    routeAdapter.transitionId.value = 1

    await waitFor(() => {
      expect(gameCtor).toHaveBeenCalledTimes(2)
    })
    expect(instance.bootError).toBeNull()
  })

  it('transitionId bump toward a non-Phaser route does NOT reboot the host', async () => {
    phaserMockState.failGameCtor = true
    const routeAdapter = makeRouteAdapter()
    const gm = makeGameManager()

    const { instance } = mountCanvas(gm, routeAdapter)

    await waitForBootError(instance)
    expect(gameCtor).toHaveBeenCalledTimes(1)

    routeAdapter.targetRoute.value = 'auth'
    routeAdapter.transitionId.value = 1

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(gameCtor).toHaveBeenCalledTimes(1)
    expect(instance.bootError).not.toBeNull()
  })

  it('transitionId bump while the host is healthy does not re-boot', async () => {
    const routeAdapter = makeRouteAdapter()
    routeAdapter.targetRoute.value = 'home'
    const gm = makeGameManager()

    mountCanvas(gm, routeAdapter)

    await waitFor(() => {
      expect(gameCtor).toHaveBeenCalledTimes(1)
    })

    routeAdapter.transitionId.value = 1
    await new Promise((resolve) => setTimeout(resolve, 0))

    // bootError is null on a healthy host — the hook must stay inert.
    expect(gameCtor).toHaveBeenCalledTimes(1)
  })
})
