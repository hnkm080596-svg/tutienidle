// @vitest-environment jsdom
//
// Remediation Task 5 (2026-09-05) — App.vue boot/tick/listener lifecycle
// idempotence. App.vue extract ra composable `useAppLifecycle` để test
// được (script setup của App.vue không test trực tiếp được):
// 1. startTickLoop() gọi 2 lần → chỉ 1 interval (trước đây setInterval
//    chạy đè tickHandle — interval cũ leak, tick chạy 2×/giây).
// 2. bootGame() 2 lần trong lúc boot đầu còn pending → boot/save flow chỉ
//    chạy 1 lần (bootInFlight guard, reset khi fail để retry còn đường).
// 3. Unmount: event-bus handlers gỡ, subscriptions/detached listeners
//    dọn sạch (symmetric cleanup).
// 4. persistProgress save-in-flight guard: gọi dồn 2 lần → 1 lần save.
//
// KHÔNG có @vue/test-utils → mount thủ công createApp (pattern
// usePanelPagination.test.ts). Fake timers cho interval/tick.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, onUnmounted, ref } from 'vue'
import { useAppLifecycle } from './useAppLifecycle'
import type { GameSave } from '../services/save/SaveSystem'
import type { GameManager } from '../core/game/GameManager'

// --- Stub dependency surface của useAppLifecycle (constructor injection) ---

function makeStubs() {
  const clock = {
    start: vi.fn(),
    stop: vi.fn(),
    nowSeconds: () => 0,
  }

  const intervals: Array<() => void> = []

  return {
    clock,
    intervals,
    // setInterval stub trả handle tuần tự, đẩy callback vào mảng để test
    // bấm thủ công (mô phỏng timer fire).
    scheduleInterval: (callback: () => void): number => {
      intervals.push(callback)
      return intervals.length
    },
    clearHandle: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    boot: {
      startSaveLoad: vi.fn(),
      startInitializing: vi.fn(),
      enterGame: vi.fn(),
      fail: vi.fn(),
      requireCharacter: vi.fn(),
      showAuth: vi.fn(),
    },
    coordinator: {
      load: vi.fn(async () => ({ status: 'empty' as const, revision: 0 as const })),
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      reset: vi.fn(),
    } as unknown as Pick<
      import('../services/cloudSave/CloudSaveCoordinator').CloudSaveCoordinator,
      'load' | 'save' | 'reset'
    >,
    player: {
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      restoreFromSave: vi.fn(),
      $state: {},
    },
    gameManager: {
      eventBus: {
        on: vi.fn(),
        off: vi.fn(),
      },
      skillManager: {
        has: () => false,
        getEquippedInSlot: () => undefined,
      },
      learnSkill: vi.fn(),
      setSkillLoadoutSlot: vi.fn(),
      learnTechnique: vi.fn(),
      equipTechnique: vi.fn(),
      materialRegistry: { has: () => false },
      materialBag: { add: vi.fn() },
      productionSystem: { getSiteDefinitions: () => [] },
      setProductionAutoRestart: vi.fn(),
      startProductionCycle: vi.fn(),
      setActivePlayer: vi.fn(),
      buildingManager: { add: vi.fn() },
      refreshAutoWorkerCapacity: vi.fn(),
      restoreFromSave: vi.fn(),
    } as unknown as GameManager,
    tick: vi.fn(),
    offlineSummary: { show: vi.fn() },
    saveIssue: { report: vi.fn() },
    entryStage: ref('game'),
    restoreGameSession: vi.fn(() => ({ status: 'ok' as const, offline: { elapsedSeconds: 0, cultivation: 0 } })),
    persistPlayer: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
    onError: vi.fn(),
  }
}

type Stubs = ReturnType<typeof makeStubs>

function makeLifecycle(stubs: Stubs) {
  return useAppLifecycle({
    clock: stubs.clock,
    scheduleInterval: stubs.scheduleInterval,
    clearHandle: stubs.clearHandle,
    addEventListener: stubs.addEventListener,
    removeEventListener: stubs.removeEventListener,
    boot: stubs.boot,
    coordinator: stubs.coordinator,
    player: stubs.player,
    gameManager: stubs.gameManager,
    tick: stubs.tick,
    offlineSummary: stubs.offlineSummary,
    saveIssue: stubs.saveIssue,
    entryStage: stubs.entryStage,
    restoreGameSession: stubs.restoreGameSession,
    persistPlayer: stubs.persistPlayer,
    onError: stubs.onError,
  })
}

describe('useAppLifecycle — idempotent tick loop (Remediation Task 5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('startTickLoop 2 lần → CHỈ 1 interval chạy (không leak)', () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    lifecycle.startTickLoop(() => undefined)
    lifecycle.startTickLoop(() => undefined)

    expect(stubs.intervals).toHaveLength(1)

    lifecycle.stopAll()
  })

  it('startAutosave 2 lần → 1 interval autosave + đúng 1 cặp listener; stop gỡ sạch', () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    lifecycle.startAutosave()
    lifecycle.startAutosave()

    // 1 interval autosave (tick interval riêng, chưa start).
    expect(stubs.intervals).toHaveLength(1)

    lifecycle.stopAll()

    expect(stubs.clearHandle).toHaveBeenCalled()
    expect(stubs.removeEventListener).toHaveBeenCalledTimes(2)
  })
})

describe('useAppLifecycle — boot idempotence (Remediation Task 5)', () => {
  it('bootGame 2 lần khi boot đầu còn pending → boot flow chỉ chạy 1 lần', async () => {
    const stubs = makeStubs()

    // load() chờ gate — mô phỏng boot đang pending.
    let releaseLoad: (value: unknown) => void = () => undefined
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (releaseLoad = resolve)),
    )

    const lifecycle = makeLifecycle(stubs)

    const first = lifecycle.bootGame({ createNewCharacter: false })
    const second = lifecycle.bootGame({ createNewCharacter: false })

    // Release load 'ok' — boot đi qua tới enterGame.
    releaseLoad({ status: 'ok', revision: 3, save: { player: {} } })

    await Promise.all([first, second])

    // startSaveLoad chỉ 1 lần — boot thứ 2 bị guard chặn.
    expect(stubs.boot.startSaveLoad).toHaveBeenCalledTimes(1)
    expect(stubs.coordinator.load).toHaveBeenCalledTimes(1)
    expect(stubs.boot.enterGame).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  // Fix (2026-09-06) — regression test cho lớp bug đã làm freeze TOÀN BỘ
  // game: bootGame() thành công phải TỰ khởi động tick loop, không phụ
  // thuộc caller nhớ gọi startTickLoop() riêng (đúng lỗi đã xảy ra ở
  // commit d6d9a1d — extract composable, quên rewire lời gọi). Khác với
  // 2 test "startTickLoop 2 lần" ở trên (chỉ test HELPER khi được gọi thủ
  // công với callback tự tạo), test này đi qua đúng con đường sản xuất
  // (bootGame() → startTickLoop(deps.tick)) — nếu ai xoá dòng gọi đó
  // trong useAppLifecycle.ts, test này FAIL trong khi 2 test kia vẫn xanh.
  it('bootGame thành công → tick loop tự khởi động (KHÔNG cần caller gọi startTickLoop riêng)', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    expect(lifecycle.getTickHandle()).toBeUndefined()

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('entered')
    expect(lifecycle.getTickHandle()).not.toBeUndefined()
    expect(stubs.intervals).toHaveLength(1)

    // Interval đã đăng ký đúng là tick — bấm thủ công phải gọi tick(),
    // không phải một no-op nào khác.
    stubs.intervals[0]?.()
    expect(stubs.tick).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  it('boot fail → guard reset → boot lại vẫn chạy được (retry còn đường)', async () => {
    const stubs = makeStubs()

    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'unavailable',
      message: 'no cloud',
    })

    const lifecycle = makeLifecycle(stubs)

    await lifecycle.bootGame({ createNewCharacter: false })

    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)

    // Boot lại — lần này load 'empty' → requireCharacter.
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'empty',
      revision: 0,
    })
    await lifecycle.bootGame({ createNewCharacter: false })

    expect(stubs.boot.requireCharacter).toHaveBeenCalledTimes(1)
    expect(stubs.boot.startSaveLoad).toHaveBeenCalledTimes(2)

    lifecycle.stopAll()
  })
})

describe('useAppLifecycle — ARCH-013/L04 boot generation fence', () => {
  // Audit L04 executed: deferred load -> real stopAll -> resolve 'ok'
  // produced {intervals:1, restores:1, entries:1, handle:1} — a disposed
  // App's boot continuation restored state, started the world tick and
  // drove a route transition. The generation fence must zero ALL of it.
  it('stopAll trong lúc load pending → resolve vẫn: 0 restore / 0 interval / 0 route entry (outcome skipped)', async () => {
    const stubs = makeStubs()

    let releaseLoad: (value: unknown) => void = () => undefined
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (releaseLoad = resolve)),
    )

    const lifecycle = makeLifecycle(stubs)

    const boot = lifecycle.bootGame({ createNewCharacter: false })
    lifecycle.stopAll()
    releaseLoad({ status: 'ok', revision: 3, save: { player: {} } })

    const outcome = await boot

    expect(outcome.status).toBe('skipped')
    expect(stubs.restoreGameSession).not.toHaveBeenCalled()
    expect(stubs.intervals).toHaveLength(0)
    expect(stubs.clock.start).not.toHaveBeenCalled()
    expect(lifecycle.getTickHandle()).toBeUndefined()

    // Every branch below the fence is a route/UI write — none may run:
    // enterGame (home), fail (error), requireCharacter, offline modal,
    // onRestoreOk/onNewCharacter side effects, onError.
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()
    expect(stubs.boot.fail).not.toHaveBeenCalled()
    expect(stubs.boot.requireCharacter).not.toHaveBeenCalled()
    expect(stubs.offlineSummary.show).not.toHaveBeenCalled()
    expect(stubs.onError).not.toHaveBeenCalled()
  })

  it('stopAll trong lúc load pending → load FAIL cũng không route error/saveIssue vào App đã teardown', async () => {
    const stubs = makeStubs()

    let releaseLoad: (value: unknown) => void = () => undefined
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (releaseLoad = resolve)),
    )

    const lifecycle = makeLifecycle(stubs)

    const boot = lifecycle.bootGame({ createNewCharacter: false })
    lifecycle.stopAll()
    releaseLoad({ status: 'corrupted', raw: 'garbage' })

    const outcome = await boot

    expect(outcome.status).toBe('skipped')
    expect(stubs.boot.fail).not.toHaveBeenCalled()
    expect(stubs.saveIssue.report).not.toHaveBeenCalled()
    expect(stubs.onError).not.toHaveBeenCalled()
  })

  it('stopAll trong lúc new-character boot pending → continuation vẫn stale (cùng generation, synthetic await)', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    // createNewCharacter path awaits Promise.resolve — still an await
    // boundary; a synchronous stopAll between call and continuation must
    // fence it too.
    const boot = lifecycle.bootGame({ createNewCharacter: true })
    lifecycle.stopAll()

    const outcome = await boot

    expect(outcome.status).toBe('skipped')
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()
    expect(stubs.intervals).toHaveLength(0)
    expect(stubs.clock.start).not.toHaveBeenCalled()
  })

  it('bootGame SAU stopAll → skipped ngay, không gọi load (teardown là terminal)', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    lifecycle.stopAll()
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('skipped')
    expect(stubs.coordinator.load).not.toHaveBeenCalled()
    expect(stubs.boot.startSaveLoad).not.toHaveBeenCalled()
  })

  it('stopAll xong → startTickLoop/startAutosave no-op nhưng persistProgress VẪN chạy (flush tận cùng chủ đích)', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    lifecycle.stopAll()
    lifecycle.startTickLoop(() => undefined)
    lifecycle.startAutosave()
    await lifecycle.persistProgress()

    // No interval re-armed, no DOM listener re-registered — nhưng save cuối
    // VẪN được phép: persistProgress không có listener-driven caller nào sót
    // lại sau stopAll (tất cả đã bị gỡ), nên call duy nhất tới được nó là
    // flush chủ đích trong App.vue's onUnmounted — cái flush "persist first
    // so a development reload cannot roll the player back" phải thật sự
    // chạy (regression review round 1: gate `stopped` ở đây đã giết nó).
    expect(stubs.intervals).toHaveLength(0)
    expect(stubs.addEventListener).not.toHaveBeenCalled()
    expect(stubs.persistPlayer).toHaveBeenCalledTimes(1)
  })

  it('boot bình thường (không stop) vẫn chạy trọn — fence không phá happy path', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('entered')
    expect(stubs.boot.enterGame).toHaveBeenCalledTimes(1)
    expect(stubs.intervals).toHaveLength(1)

    lifecycle.stopAll()
  })
})

describe('useAppLifecycle — save in-flight guard (Remediation Task 5)', () => {
  it('persistProgress dồn 2 lần trong 1 tick → 1 lần player.save', async () => {
    const stubs = makeStubs()

    let releaseSave: (value: unknown) => void = () => undefined
    ;(stubs.persistPlayer as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (releaseSave = resolve)),
    )

    const lifecycle = makeLifecycle(stubs)

    const first = lifecycle.persistProgress()
    const second = lifecycle.persistProgress()

    releaseSave({ status: 'ok', revision: 1 })

    await Promise.all([first, second])

    expect(stubs.persistPlayer).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  it('save xong → guard nhả → persist kế tiếp chạy được', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    await lifecycle.persistProgress()
    await lifecycle.persistProgress()

    expect(stubs.persistPlayer).toHaveBeenCalledTimes(2)

    lifecycle.stopAll()
  })
})

describe('useAppLifecycle — event bus + listener cleanup (Remediation Task 5)', () => {
  it('unmount/stopAll: event-bus handler gỡ symmetric với đăng ký', () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    lifecycle.stopAll()

    // Mỗi on() có đúng 1 off() cùng event+handler.
    const eventBus = stubs.gameManager.eventBus as unknown as {
      on: ReturnType<typeof vi.fn>
      off: ReturnType<typeof vi.fn>
    }
    const onCalls = eventBus.on.mock.calls as Array<[string, unknown]>
    const offCalls = eventBus.off.mock.calls as Array<[string, unknown]>

    expect(onCalls.length).toBeGreaterThan(0)
    expect(offCalls).toHaveLength(onCalls.length)

    for (const [index, [eventType, handler]] of onCalls.entries()) {
      expect(offCalls[index]).toEqual([eventType, handler])
    }
  })

  it('stopAll 2 lần → idempotent, off không gọi thêm', () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    lifecycle.stopAll()

    const eventBus = stubs.gameManager.eventBus as unknown as {
      on: ReturnType<typeof vi.fn>
      off: ReturnType<typeof vi.fn>
    }
    const offCount = eventBus.off.mock.calls.length

    lifecycle.stopAll()

    expect(eventBus.off.mock.calls.length).toBe(offCount)
    expect(stubs.removeEventListener).toHaveBeenCalledTimes(2)
  })
})

describe('useAppLifecycle — entry smoke qua createApp (pattern usePanelPagination)', () => {
  it('composable gắn được trong component Vue thật + cleanup khi unmount', () => {
    vi.useFakeTimers()

    try {
      const stubs = makeStubs()
      let lifecycleRef: ReturnType<typeof useAppLifecycle> | undefined

      const container = document.createElement('div')

      document.body.appendChild(container)

      const app = createApp({
        setup() {
          lifecycleRef = useAppLifecycle({
            clock: stubs.clock,
            scheduleInterval: stubs.scheduleInterval,
            clearHandle: stubs.clearHandle,
            addEventListener: stubs.addEventListener,
            removeEventListener: stubs.removeEventListener,
            boot: stubs.boot,
            coordinator: stubs.coordinator,
            player: stubs.player,
            gameManager: stubs.gameManager,
            tick: stubs.tick,
            offlineSummary: stubs.offlineSummary,
            saveIssue: stubs.saveIssue,
            entryStage: stubs.entryStage,
            restoreGameSession: stubs.restoreGameSession,
            persistPlayer: stubs.persistPlayer,
            onError: stubs.onError,
          })

          return () => h('div')
        },
      })

      app.mount(container)
      app.unmount()

      expect(lifecycleRef).toBeDefined()
      expect(stubs.removeEventListener).toHaveBeenCalled()
      expect(stubs.clock.stop).not.toHaveBeenCalled() // chưa start — không stop Ẩo

      vi.useRealTimers()
    } finally {
      vi.useRealTimers()
    }
  })

  it('unmount-time persist vẫn fire SAU stopAll — ordering thật của App.vue (review round 1)', async () => {
    // Ordering thật: composable tự đăng ký onBeforeUnmount(stopAll), còn
    // App.vue gọi persistProgress() trong onUnmounted — Vue chạy
    // beforeUnmount TRƯỚC unmounted, nên flush cuối luôn đến sau stopAll.
    // Test này tái tạo đúng thứ tự đó: nếu persistProgress lại bị gate bởi
    // `stopped`, "persist first so a dev reload cannot roll the player
    // back" lại thành dead code mà không test nào kêu.
    const stubs = makeStubs()

    const container = document.createElement('div')
    document.body.appendChild(container)

    const app = createApp({
      setup() {
        const lifecycle = useAppLifecycle({
          clock: stubs.clock,
          scheduleInterval: stubs.scheduleInterval,
          clearHandle: stubs.clearHandle,
          addEventListener: stubs.addEventListener,
          removeEventListener: stubs.removeEventListener,
          boot: stubs.boot,
          coordinator: stubs.coordinator,
          player: stubs.player,
          gameManager: stubs.gameManager,
          tick: stubs.tick,
          offlineSummary: stubs.offlineSummary,
          saveIssue: stubs.saveIssue,
          entryStage: stubs.entryStage,
          restoreGameSession: stubs.restoreGameSession,
          persistPlayer: stubs.persistPlayer,
          onError: stubs.onError,
        })

        // Mirror App.vue's onUnmounted flush — fires strictly after the
        // composable's onBeforeUnmount(stopAll).
        onUnmounted(() => {
          void lifecycle.persistProgress()
        })

        return () => h('div')
      },
    })

    app.mount(container)
    app.unmount()

    await vi.waitFor(() => expect(stubs.persistPlayer).toHaveBeenCalledTimes(1))
    expect(stubs.removeEventListener).toHaveBeenCalled() // stopAll ran first
  })

  it('GameSave type import không phá build test (contract giữ nguyên)', () => {
    // Type-only usage — giữ import có nghĩa.
    const save: GameSave | undefined = undefined

    expect(save).toBeUndefined()
  })
})
