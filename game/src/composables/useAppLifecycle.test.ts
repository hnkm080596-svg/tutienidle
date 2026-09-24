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
import { TICK_INTERVAL_MS } from '../core/idle/SpeedSettings'
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
  const intervalCalls: Array<{ timeoutMs: number }> = []

  return {
    clock,
    intervals,
    intervalCalls,
    // setInterval stub trả handle tuần tự, đẩy callback vào mảng để test
    // bấm thủ công (mô phỏng timer fire).
    scheduleInterval: (callback: () => void, timeoutMs: number): number => {
      intervals.push(callback)
      intervalCalls.push({ timeoutMs })
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
      materialRegistry: { has: () => false },
      materialBag: { add: vi.fn() },
      productionSystem: { getSiteDefinitions: () => [] },
      setProductionAutoRestart: vi.fn(),
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
    hardReset: vi.fn(),
    remoteSync: vi.fn(async () => 'skipped'),
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
    hardReset: stubs.hardReset,
    remoteSync: stubs.remoteSync,
  })
}

describe('useAppLifecycle — idempotent tick loop (Remediation Task 5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tick loop cadence comes from SpeedSettings.TICK_INTERVAL_MS (audit T5-46)', () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    lifecycle.startTickLoop(() => undefined)

    expect(stubs.intervalCalls[0]?.timeoutMs).toBe(TICK_INTERVAL_MS)

    lifecycle.stopAll()
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

    // load() waits on the gate - simulates a pending boot. Deferred created
    // upfront: bootGame awaits remoteSync BEFORE calling load(), so a
    // resolver assigned inside mockImplementation would not exist yet
    // when the test releases it.
    let releaseLoad: (value: unknown) => void = () => undefined
    const loadGate = new Promise((resolve) => (releaseLoad = resolve))
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockImplementation(() => loadGate)

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

  it("restore 'rejected' → saveIssue recovery surface (corrupted + raw), không phải dead-end boot error", async () => {
    const stubs = makeStubs()

    const save = { version: 82, player: { realm: 'pham_nhan' } }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'ok',
      revision: 5,
      save,
      raw: 'stored-raw-bytes',
    })
    ;(stubs.restoreGameSession as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      status: 'rejected',
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    // The exported recovery payload is the stored raw bytes (same
    // contract as the incompatible/corrupted branches), not the
    // normalized save object.
    expect(stubs.saveIssue.report).toHaveBeenCalledWith('corrupted', 'stored-raw-bytes')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.onError).not.toHaveBeenCalled()

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
    const loadGate = new Promise((resolve) => (releaseLoad = resolve))
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockImplementation(() => loadGate)

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
    const loadGate = new Promise((resolve) => (releaseLoad = resolve))
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockImplementation(() => loadGate)

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

describe('useAppLifecycle - remote sync reconciliation (spec F8, Mission F Task 11)', () => {
  it('remoteSync is awaited after startSaveLoad and before coordinator.load', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    await lifecycle.bootGame({ createNewCharacter: false })

    const syncOrder = stubs.remoteSync.mock.invocationCallOrder[0]
    const loadOrder = (stubs.coordinator.load as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    expect(stubs.remoteSync).toHaveBeenCalledTimes(1)
    expect(syncOrder).toBeDefined()
    expect(loadOrder).toBeDefined()
    expect(syncOrder!).toBeLessThan(loadOrder!)

    lifecycle.stopAll()
  })

  it('createNewCharacter boot skips remoteSync - the new character has no remote row yet', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    await lifecycle.bootGame({ createNewCharacter: true })

    expect(stubs.remoteSync).not.toHaveBeenCalled()

    lifecycle.stopAll()
  })

  it('remoteSync rejection never blocks boot - coordinator.load still runs', async () => {
    const stubs = makeStubs()
    stubs.remoteSync.mockRejectedValueOnce(new Error('remote down'))
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(stubs.coordinator.load).toHaveBeenCalledTimes(1)
    expect(outcome.status).toBe('require-character')

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
            hardReset: stubs.hardReset,
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
          hardReset: stubs.hardReset,
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

describe('useAppLifecycle — B2 character-creation save transaction (audit T1-8)', () => {
  it('new character: first durable save commits BEFORE tick loop / enterGame (order via invocationCallOrder)', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('entered')
    expect(stubs.player.save).toHaveBeenCalledTimes(1)

    const saveOrder = (stubs.player.save as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!
    const enterOrder = stubs.boot.enterGame.mock.invocationCallOrder[0]!
    expect(saveOrder).toBeLessThan(enterOrder)
    expect(stubs.clock.start.mock.invocationCallOrder[0]!).toBeGreaterThan(saveOrder)

    lifecycle.stopAll()
  })

  it('new character save non-ok → outcome failed, boot.fail + onError, tick loop and clock NEVER start', async () => {
    const stubs = makeStubs()
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'unavailable',
      message: 'storage blocked',
      retryable: false,
    })
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('failed')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()
    expect(stubs.onError).toHaveBeenCalledWith('storage blocked')
    expect(lifecycle.getTickHandle()).toBeUndefined()
    expect(stubs.clock.start).not.toHaveBeenCalled()
    expect(stubs.intervals).toHaveLength(0)

    lifecycle.stopAll()
  })

  it('conflict save result maps to the session-conflict message', async () => {
    const stubs = makeStubs()
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'conflict',
      currentRevision: 2,
    })
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('failed')
    expect(stubs.onError).toHaveBeenCalledWith('Save đã thay đổi ở một phiên khác.')

    lifecycle.stopAll()
  })

  it('stopAll during the first-save await → continuation is stale, no fail/enter/tick (generation fence extends over the new await)', async () => {
    const stubs = makeStubs()

    let releaseSave: (value: unknown) => void = () => undefined
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => (releaseSave = resolve)),
    )

    const lifecycle = makeLifecycle(stubs)
    const boot = lifecycle.bootGame({ createNewCharacter: true })

    // Park bootGame AT the player.save await before stopping — calling
    // stopAll() synchronously only exercises the existing fence after
    // coordinator.reset(), leaving the new post-save fence uncovered.
    await vi.waitFor(() => expect(stubs.player.save).toHaveBeenCalled())
    lifecycle.stopAll()
    releaseSave({ status: 'ok', revision: 1 })

    const outcome = await boot

    expect(outcome.status).toBe('skipped')
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()
    expect(stubs.boot.fail).not.toHaveBeenCalled()
    expect(stubs.intervals).toHaveLength(0)
    expect(stubs.clock.start).not.toHaveBeenCalled()
  })

  // QA repro (mission B deep audit): a failed first save leaves every
  // onNewCharacter grant applied (buildings/materials/activePlayer were
  // committed BEFORE the save await). The real callback in App.vue is
  // NOT idempotent - buildingManager.add / materialBag.add / baseStats
  // all append - so the boot-error -> auth -> re-create path grants the
  // starter pack a second time and persists the doubled state. This
  // callback mirrors the same public seams App.vue's onNewCharacter
  // drives (buildingManager.add x2 starter buildings, materialBag.add
  // x2 starter stacks, setActivePlayer).
  it('first save fails then retry creates again -> starter grants apply EXACTLY ONCE (no double grant)', async () => {
    const stubs = makeStubs()

    // Faithful seam mirror of App.vue's onNewCharacter: non-idempotent
    // appends (add) plus the active-player registration.
    const grantStarterContent = () => {
      stubs.gameManager.buildingManager.add({
        instanceId: 'a',
        buildingId: 'teleport_array',
        level: 1,
        lastCollectedAt: 0,
      })
      stubs.gameManager.buildingManager.add({
        instanceId: 'b',
        buildingId: 'gathering_outpost',
        level: 1,
        lastCollectedAt: 0,
      })
      stubs.gameManager.materialBag.add({} as never, 15)
      stubs.gameManager.materialBag.add({} as never, 6)
      stubs.gameManager.setActivePlayer(stubs.player.$state as never)
    }

    const lifecycle = makeLifecycle(stubs)

    // Attempt 1: storage unavailable at the first-save boundary.
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'unavailable',
      message: 'storage blocked',
      retryable: true,
    })

    const first = await lifecycle.bootGame({
      createNewCharacter: true,
      onNewCharacter: grantStarterContent,
    })

    expect(first.status).toBe('failed')

    // Attempt 2: transient failure recovered; the user re-creates. The
    // first attempt's grants cannot be rolled back in memory, so the
    // retry must reload for a clean process - NOT re-run the callback.
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'ok',
      revision: 1,
    })

    const second = await lifecycle.bootGame({
      createNewCharacter: true,
      onNewCharacter: grantStarterContent,
    })

    expect(second.status).toBe('skipped')
    expect(stubs.hardReset).toHaveBeenCalledTimes(1)

    // One character must own ONE starter set: 2 buildings + 2 material
    // stacks. The guard blocks the second grant entirely.
    expect(stubs.gameManager.buildingManager.add).toHaveBeenCalledTimes(2)
    expect(stubs.gameManager.materialBag.add).toHaveBeenCalledTimes(2)

    lifecycle.stopAll()
  })

  // QA repro (mission B deep audit): the new first-save await is not
  // guarded - a service that THROWS (coordinator.save has no try/catch;
  // a remote CloudSaveService may reject on network failure) propagates
  // out of bootGame. boot.fail() never runs, so the caller sees an
  // unhandled rejection and the app sits on LoadingScreen forever
  // instead of the boot-error screen. coordinator.load() shares this
  // exposure but the new save await widens it.
  it('player.save THROWS during first save -> boot still fails visibly instead of hanging', async () => {
    const stubs = makeStubs()
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network down'),
    )

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('failed')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  // Mission B external audit (Medium): onNewCharacter runs OUTSIDE the
  // try/catch and BEFORE newCharacterGrantsApplied is set. A mid-grant
  // throw escapes bootGame as an unhandled rejection (the caller
  // `await bootGame(true)` has no catch either) -> boot.fail() never
  // runs, the flag stays false on a PARTIALLY mutated runtime, and a
  // retry re-runs the non-idempotent grants = the same double-grant
  // class the save-failure path was fixed for, one seam earlier.
  it('onNewCharacter THROWS mid-grant -> boot fails visibly + retry hard-resets instead of re-granting', async () => {
    const stubs = makeStubs()

    const grantStarterContent = vi.fn(() => {
      stubs.gameManager.buildingManager.add({
        instanceId: 'a',
        buildingId: 'teleport_array',
        level: 1,
        lastCollectedAt: 0,
      })
      throw new Error('grant blew up mid-transaction')
    })

    const lifecycle = makeLifecycle(stubs)
    const first = await lifecycle.bootGame({
      createNewCharacter: true,
      onNewCharacter: grantStarterContent,
    })

    // The throw must resolve through the same visible failure contract as
    // a throwing first save — not an unhandled rejection on a stuck boot.
    expect(first.status).toBe('failed')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.onError).toHaveBeenCalled()
    expect(stubs.player.save).not.toHaveBeenCalled()
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()

    // The runtime is dirty (partial grants applied, no save): a retry
    // must take the dirty-transaction branch (hardReset + skipped), not
    // re-run the callback on top of the partial state.
    const second = await lifecycle.bootGame({
      createNewCharacter: true,
      onNewCharacter: grantStarterContent,
    })

    expect(second.status).toBe('skipped')
    expect(stubs.hardReset).toHaveBeenCalledTimes(1)
    // The callback ran exactly once — the first attempt. A re-run would
    // double-apply the partial grants.
    expect(grantStarterContent).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })
})
