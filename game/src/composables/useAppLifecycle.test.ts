// @vitest-environment jsdom
//
// Remediation Task 5 (2026-09-05) - App.vue boot/tick/listener lifecycle
// idempotence. App.vue extract ra composable `useAppLifecycle` de test
// duoc (script setup cua App.vue khong test truc tiep duoc):
// 1. startTickLoop() goi 2 lan -> chi 1 interval (truoc day setInterval
//    chay de tickHandle - interval cu leak, tick chay 2x/giay).
// 2. bootGame() 2 lan trong luc boot dau con pending -> boot/save flow chi
//    chay 1 lan (bootInFlight guard, reset khi fail de retry con duong).
// 3. Unmount: event-bus handlers go, subscriptions/detached listeners
//    don sach (symmetric cleanup).
// 4. persistProgress save-in-flight guard: goi don 2 lan -> 1 lan save.
//
// KHONG co @vue/test-utils -> mount thu cong createApp (pattern
// usePanelPagination.test.ts). Fake timers cho interval/tick.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, onUnmounted, ref } from 'vue'
import { useAppLifecycle } from './useAppLifecycle'
import { TICK_INTERVAL_MS } from '../core/idle/SpeedSettings'
import type { GameSave } from '../services/save/SaveSystem'
import type { GameManager } from '../core/game/GameManager'

// --- Stub dependency surface cua useAppLifecycle (constructor injection) ---

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
    // setInterval stub tra handle tuan tu, day callback vao mang de test
    // bam thu cong (mo phong timer fire).
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
      capability: 'local-only' as 'local-only' | 'remote-authoritative',
    } as unknown as Pick<
      import('../services/cloudSave/CloudSaveCoordinator').CloudSaveCoordinator,
      'load' | 'save' | 'reset' | 'capability'
    >,
    player: {
      save: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
      restoreFromSave: vi.fn(),
      $state: {},
    },
    // B1-D - the admission-authority stub: 'ready' by default so existing
    // lifecycle behavior stays in place; individual tests flip canMutate
    // to false to exercise the mutation gate.
    authority: {
      canMutate: vi.fn(() => true),
      beginChecking: vi.fn(),
      markReady: vi.fn(),
      markFailed: vi.fn(),
      observeSaveResult: vi.fn(),
    },
    gameManager: {
      eventBus: {
        on: vi.fn(),
        off: vi.fn(),
      },
      materialRegistry: { has: () => false },
      materialBag: { add: vi.fn(), getAll: () => [] },
      techniqueManager: { getAll: () => [] },
      skillManager: { getAll: () => [] },
      equipmentBag: { getAll: () => [] },
      pillBag: { getAll: () => [] },
      equipmentSlotManager: { getAll: () => [] },
      alchemySystem: { getJobs: () => [] },
      questManager: { getState: () => ({}) },
      decomposeSystem: { getSaveState: () => ({}) },
      tribulationDirector: { serializeRuntime: () => ({}) },
      productionSystem: { getSiteDefinitions: () => [], getAllStates: () => [] },
      setProductionAutoRestart: vi.fn(),
      setActivePlayer: vi.fn(),
      buildingManager: { add: vi.fn(), getAll: () => [] },
      refreshAutoWorkerCapacity: vi.fn(),
      restoreFromSave: vi.fn(),
      freezeCombat: vi.fn(),
      resumeCombat: vi.fn(),
    } as unknown as GameManager,
    tick: vi.fn(),
    offlineSummary: { show: vi.fn() },
    saveIssue: { report: vi.fn() },
    entryStage: ref('game'),
    restoreGameSession: vi.fn(() => ({ status: 'ok' as const, offline: { elapsedSeconds: 0, cultivation: 0 } })),
    persistPlayer: vi.fn(async () => ({ status: 'ok' as const, revision: 1 })),
    onError: vi.fn(),
    unsupportedSaveNotice: vi.fn(),
    hardReset: vi.fn(),
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
    authority: stubs.authority,
    player: stubs.player,
    gameManager: stubs.gameManager,
    tick: stubs.tick,
    offlineSummary: stubs.offlineSummary,
    saveIssue: stubs.saveIssue,
    entryStage: stubs.entryStage,
    restoreGameSession: stubs.restoreGameSession,
    persistPlayer: stubs.persistPlayer,
    onError: stubs.onError,
    unsupportedSaveNotice: stubs.unsupportedSaveNotice,
    hardReset: stubs.hardReset,
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

    // 1 interval autosave (tick interval rieng, chua start).
    expect(stubs.intervals).toHaveLength(1)

    lifecycle.stopAll()

    expect(stubs.clearHandle).toHaveBeenCalled()
    expect(stubs.removeEventListener).toHaveBeenCalledTimes(2)
  })
})

describe('useAppLifecycle — boot idempotence (Remediation Task 5)', () => {
  it('bootGame 2 lần khi boot đầu còn pending → boot flow chỉ chạy 1 lần', async () => {
    const stubs = makeStubs()

    // load() waits on the gate - simulates a pending boot.
    let releaseLoad: (value: unknown) => void = () => undefined
    const loadGate = new Promise((resolve) => (releaseLoad = resolve))
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockImplementation(() => loadGate)

    const lifecycle = makeLifecycle(stubs)

    const first = lifecycle.bootGame({ createNewCharacter: false })
    const second = lifecycle.bootGame({ createNewCharacter: false })

    // Release load 'ok' - boot di qua toi enterGame.
    releaseLoad({ status: 'ok', revision: 3, save: { player: {} } })

    await Promise.all([first, second])

    // startSaveLoad chi 1 lan - boot thu 2 bi guard chan.
    expect(stubs.boot.startSaveLoad).toHaveBeenCalledTimes(1)
    expect(stubs.coordinator.load).toHaveBeenCalledTimes(1)
    expect(stubs.boot.enterGame).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  // Fix (2026-09-06) - regression test cho lop bug da lam freeze TOAN BO
  // game: bootGame() thanh cong phai TU khoi dong tick loop, khong phu
  // thuoc caller nho goi startTickLoop() rieng (dung loi da xay ra o
  // commit d6d9a1d - extract composable, quen rewire loi goi). Khac voi
  // 2 test "startTickLoop 2 lan" o tren (chi test HELPER khi duoc goi thu
  // cong voi callback tu tao), test nay di qua dung con duong san xuat
  // (bootGame() -> startTickLoop(deps.tick)) - neu ai xoa dong goi do
  // trong useAppLifecycle.ts, test nay FAIL trong khi 2 test kia van xanh.
  it('bootGame thành công → tick loop tự khởi động (KHÔNG cần caller gọi startTickLoop riêng)', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    expect(lifecycle.getTickHandle()).toBeUndefined()

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('entered')
    expect(lifecycle.getTickHandle()).not.toBeUndefined()
    expect(stubs.intervals).toHaveLength(1)

    // Interval da dang ky dung la tick - bam thu cong phai goi tick(),
    // khong phai mot no-op nao khac.
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

    // Boot lai - lan nay load 'empty' -> requireCharacter.
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

    const save = { version: 83, player: { realm: 'pham_nhan' } }
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

describe('useAppLifecycle — B1-C pending load surfaces', () => {
  it("load 'pending-conflict' routes the durable record's bytes to the corrupted surface + boot.fail (B1-C)", async () => {
    const stubs = makeStubs()
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'pending-conflict',
      currentRevision: 9,
      pendingRaw: 'pending-payload-bytes',
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    expect(stubs.saveIssue.report).toHaveBeenCalledWith('corrupted', 'pending-payload-bytes', undefined, 'local')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.onError).not.toHaveBeenCalled()

    lifecycle.stopAll()
  })

  it("load 'pending-quarantined' routes pendingRaw to the corrupted surface + boot.fail (B1-C)", async () => {
    const stubs = makeStubs()
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'pending-quarantined',
      reason: 'journal-envelope-corrupt',
      pendingRaw: 'quarantined-bytes',
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    expect(stubs.saveIssue.report).toHaveBeenCalledWith('corrupted', 'quarantined-bytes', undefined, 'local')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })
})

describe('useAppLifecycle — ARCH-013/L04 boot generation fence', () => {
  // Audit L04 executed: deferred load -> real stopAll -> resolve 'ok'
  // produced {intervals:1, restores:1, entries:1, handle:1} - a disposed
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

    // Every branch below the fence is a route/UI write - none may run:
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

    // createNewCharacter path awaits Promise.resolve - still an await
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

    // No interval re-armed, no DOM listener re-registered - nhung save cuoi
    // VAN duoc phep: persistProgress khong co listener-driven caller nao sot
    // lai sau stopAll (tat ca da bi go), nen call duy nhat toi duoc no la
    // flush chu dich trong App.vue's onUnmounted - cai flush "persist first
    // so a development reload cannot roll the player back" phai that su
    // chay (regression review round 1: gate `stopped` o day da giet no).
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

describe('useAppLifecycle - remote-authoritative boot semantics (B1)', () => {
  const remoteCharacter = {
    id: 'char-1',
    name: 'Vo Danh',
    selectedTalentIds: ['talent-a'],
    baseAttributes: { strength: 1, dexterity: 1, intelligence: 1, attunement: 1, vitality: 1 },
    mortalBasicSkillId: 'linh_bao',
    realmId: 'mortal',
    realmLevel: 0,
    createdAt: '2026-01-01T00:00:00Z',
  }

  it('local-mode createNewCharacter boot keeps the synthetic empty shortcut (no authoritative load)', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    await lifecycle.bootGame({ createNewCharacter: true })

    expect(stubs.coordinator.load).not.toHaveBeenCalled()
    expect(stubs.coordinator.reset).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  it('remote-authoritative createNewCharacter boot performs the authoritative load instead of synthetic empty', async () => {
    const stubs = makeStubs()
    stubs.coordinator = { ...stubs.coordinator, capability: 'remote-authoritative' }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'uninitialized',
      revision: 0,
      character: remoteCharacter,
    })

    const onNewCharacter = vi.fn()
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true, onNewCharacter })

    // The RPC load is the ONLY load step - no reset short-circuit.
    expect(stubs.coordinator.load).toHaveBeenCalledTimes(1)
    expect(stubs.coordinator.reset).not.toHaveBeenCalled()

    // Canonical server metadata drives exactly one starter snapshot.
    expect(onNewCharacter).toHaveBeenCalledTimes(1)
    expect(onNewCharacter).toHaveBeenCalledWith(remoteCharacter)
    expect(outcome.status).toBe('entered')

    lifecycle.stopAll()
  })

  it('CHARACTER_UNINITIALIZED rebuild: first save commits before the tick loop starts', async () => {
    const stubs = makeStubs()
    stubs.coordinator = { ...stubs.coordinator, capability: 'remote-authoritative' }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'uninitialized',
      revision: 0,
      character: remoteCharacter,
    })

    // Required seed: zero ticks may run before the first remote ack -
    // capture the tick count at the moment the revision-1 write resolves.
    let tickCountBeforeFirstRemoteAck = -1
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      tickCountBeforeFirstRemoteAck = (stubs.tick as ReturnType<typeof vi.fn>).mock.calls.length
      return { status: 'ok' as const, revision: 1 }
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false, onNewCharacter: vi.fn() })

    expect(outcome.status).toBe('entered')
    expect(stubs.player.save).toHaveBeenCalledTimes(1)
    expect(tickCountBeforeFirstRemoteAck).toBe(0)

    // revision 1 precedes tick: the save ran before clock.start and
    // before the tick interval was scheduled.
    const saveOrder = (stubs.player.save as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    const clockOrder = stubs.clock.start.mock.invocationCallOrder[0]
    expect(saveOrder).toBeLessThan(clockOrder!)

    lifecycle.stopAll()
  })

  it('CHARACTER_UNINITIALIZED retried after a failed first save triggers the dirty-transaction reload instead of re-granting', async () => {
    const stubs = makeStubs()
    stubs.coordinator = { ...stubs.coordinator, capability: 'remote-authoritative' }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'uninitialized',
      revision: 0,
      character: remoteCharacter,
    })
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'unavailable',
      message: 'remote down',
      code: 'NETWORK_UNAVAILABLE',
      retryable: true,
    })

    const onNewCharacter = vi.fn()
    const lifecycle = makeLifecycle(stubs)

    // Boot 1: grants commit to runtime state, then the revision-0 write
    // fails -> boot.fail -> error screen.
    const first = await lifecycle.bootGame({ createNewCharacter: false, onNewCharacter })
    expect(first.status).toBe('failed')
    expect(onNewCharacter).toHaveBeenCalledTimes(1)

    // Retry in the same mount (back-to-auth -> re-auth -> bootGame(false)):
    // the server still has no save row, so load returns uninitialized
    // again. Re-running grants would duplicate buildings/materials on the
    // already-granted managers - the dirty-transaction guard must resolve
    // to a reload instead.
    const second = await lifecycle.bootGame({ createNewCharacter: false, onNewCharacter })

    expect(second.status).toBe('skipped')
    expect(stubs.hardReset).toHaveBeenCalledTimes(1)
    expect(onNewCharacter).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  it('CHARACTER_DELETED routes to character creation - reset_character makes tombstones restartable', async () => {
    const stubs = makeStubs()
    stubs.coordinator = { ...stubs.coordinator, capability: 'remote-authoritative' }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 'deleted' })

    const onNewCharacter = vi.fn()
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: false, onNewCharacter })

    expect(outcome.status).toBe('require-character')
    expect(stubs.onError).not.toHaveBeenCalled()
    expect(stubs.boot.fail).not.toHaveBeenCalled()
    expect(stubs.boot.requireCharacter).toHaveBeenCalledTimes(1)
    expect(onNewCharacter).not.toHaveBeenCalled()
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()

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

    // Moi on() co dung 1 off() cung event+handler.
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
            authority: stubs.authority,
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
      expect(stubs.clock.stop).not.toHaveBeenCalled() // chua start - khong stop Ao

      vi.useRealTimers()
    } finally {
      vi.useRealTimers()
    }
  })

  it('unmount-time persist vẫn fire SAU stopAll — ordering thật của App.vue (review round 1)', async () => {
    // Ordering that: composable tu dang ky onBeforeUnmount(stopAll), con
    // App.vue goi persistProgress() trong onUnmounted - Vue chay
    // beforeUnmount TRUOC unmounted, nen flush cuoi luon den sau stopAll.
    // Test nay tai tao dung thu tu do: neu persistProgress lai bi gate boi
    // `stopped`, "persist first so a dev reload cannot roll the player
    // back" lai thanh dead code ma khong test nao keu.
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
          authority: stubs.authority,
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

        // Mirror App.vue's onUnmounted flush - fires strictly after the
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
    // Type-only usage - giu import co nghia.
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
    // Retryable (transient) reject keeps the generic fail path; a
    // permanent reject would instead arm the remote recovery surface
    // (W5-AUT-1) - pinned in w5aut.repro.test.ts.
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'unavailable',
      message: 'storage blocked',
      retryable: true,
    })
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('failed')
    expect(stubs.boot.fail).toHaveBeenCalledTimes(1)
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()
    expect(stubs.onError).toHaveBeenCalledWith('storage blocked')
    expect(stubs.saveIssue.report).not.toHaveBeenCalled()
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

    // Park bootGame AT the player.save await before stopping - calling
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
    // a throwing first save - not an unhandled rejection on a stuck boot.
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
    // The callback ran exactly once - the first attempt. A re-run would
    // double-apply the partial grants.
    expect(grantStarterContent).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })
})

describe('useAppLifecycle — B1-D admission authority', () => {
  it('tick is gated by authority.canMutate(): a late interval callback while paused does not tick', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })
    expect(outcome.status).toBe('entered')
    expect(stubs.intervals).toHaveLength(1)

    stubs.authority.canMutate.mockReturnValue(true)
    stubs.intervals[0]?.()
    expect(stubs.tick).toHaveBeenCalledTimes(1)

    // Observed authority loss pauses admission - the interval callback
    // fires but produces no tick.
    stubs.authority.canMutate.mockReturnValue(false)
    stubs.intervals[0]?.()
    expect(stubs.tick).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  it('persistProgress is gated by authority.canMutate() (no write while authority unresolved)', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    stubs.authority.canMutate.mockReturnValue(false)
    await lifecycle.persistProgress()
    expect(stubs.persistPlayer).not.toHaveBeenCalled()

    stubs.authority.canMutate.mockReturnValue(true)
    await lifecycle.persistProgress()
    expect(stubs.persistPlayer).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  it('bootGame enters checking, then markReady precedes clock.start (heartbeat arms before the first tick)', async () => {
    const stubs = makeStubs()
    const order: string[] = []
    stubs.authority.beginChecking.mockImplementation(() => order.push('beginChecking'))
    stubs.authority.markReady.mockImplementation(() => order.push('markReady'))
    stubs.clock.start.mockImplementation(() => order.push('clock.start'))

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: true })

    expect(outcome.status).toBe('entered')
    expect(order).toEqual(['beginChecking', 'markReady', 'clock.start'])

    lifecycle.stopAll()
  })

  it('a failed boot admission reports through authority.markFailed', async () => {
    const stubs = makeStubs()
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'unavailable',
      code: 'NETWORK_UNAVAILABLE',
      message: 'down',
      retryable: true,
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    expect(stubs.authority.beginChecking).toHaveBeenCalledTimes(1)
    expect(stubs.authority.markFailed).toHaveBeenCalledWith('NETWORK_UNAVAILABLE')
    expect(stubs.authority.markReady).not.toHaveBeenCalled()
    expect(stubs.clock.start).not.toHaveBeenCalled()
  })

  it('remote-authoritative ok boot: restore gets the server-stamped cold-boot window and the post-accrual commit flows through observeSaveResult', async () => {
    const stubs = makeStubs()
    stubs.coordinator = { ...stubs.coordinator, capability: 'remote-authoritative' }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'ok',
      revision: 5,
      save: { player: { lastSavedAt: 1_000 } },
      serverAuthority: { cutoffMs: 2_000, serverNowMs: 3_000 },
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('entered')
    expect(stubs.restoreGameSession).toHaveBeenCalledWith(
      stubs.player,
      stubs.gameManager,
      { player: { lastSavedAt: 1_000 } },
      { kind: 'cold-boot', sinceMs: 2_000, untilMs: 3_000 },
    )
    // The durability leg: the post-accrual snapshot committed AND the
    // result flowed into the authority before admission was granted.
    expect(stubs.player.save).toHaveBeenCalledWith(stubs.gameManager)
    expect(stubs.authority.observeSaveResult).toHaveBeenCalledWith({ status: 'ok', revision: 1 })
    expect(stubs.authority.markReady).toHaveBeenCalledTimes(1)

    lifecycle.stopAll()
  })

  it('remote-authoritative ok boot with a failed post-accrual commit fails the boot - no tick on uncommitted accrual', async () => {
    const stubs = makeStubs()
    stubs.coordinator = { ...stubs.coordinator, capability: 'remote-authoritative' }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'ok',
      revision: 5,
      save: { player: { lastSavedAt: 1_000 } },
      serverAuthority: { serverNowMs: 3_000 },
    })
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'conflict',
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    expect(stubs.authority.observeSaveResult).toHaveBeenCalledWith({ status: 'conflict' })
    expect(stubs.authority.markReady).not.toHaveBeenCalled()
    expect(stubs.boot.enterGame).not.toHaveBeenCalled()

    lifecycle.stopAll()
  })

  // W8-COR-2 pin: the B1-D commit arm — a permanent data-class refuse on a
  // live, loadable character mounts the save-issue surface at scope
  // 'remote' (remote reset is the only real un-wedge for a character whose
  // accrued write can never commit) with the refused payload as raw.
  it.each(['SAVE_INVALID', 'SAVE_TOO_LARGE', 'SERVER_ERROR', undefined] as const)(
    'remote-authoritative ok boot: permanent commit refuse (%s) arms the remote save-issue surface',
    async (code) => {
      const stubs = makeStubs()
      stubs.coordinator = { ...stubs.coordinator, capability: 'remote-authoritative' }
      ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'ok',
        revision: 5,
        save: { player: { lastSavedAt: 1_000 } },
        serverAuthority: { serverNowMs: 3_000 },
      })
      ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'unavailable',
        retryable: false,
        code,
      })

      const lifecycle = makeLifecycle(stubs)
      const outcome = await lifecycle.bootGame({ createNewCharacter: false })

      expect(outcome.status).toBe('failed')
      expect(stubs.saveIssue.report).toHaveBeenCalledWith(
        'corrupted',
        expect.any(String),
        undefined,
        'remote',
      )
      // Export salvages the refused accrued payload, not empty bytes.
      const raw = ((stubs.saveIssue.report as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] ?? '') as string
      expect(raw.length).toBeGreaterThan(0)
      expect(stubs.onError).not.toHaveBeenCalled()
      // markFailed dedup: codes already mapped 'recovery' by
      // observeSaveResult skip the explicit terminal entry.
      if (code === 'SAVE_INVALID' || code === 'SAVE_TOO_LARGE') {
        expect(stubs.authority.markFailed).not.toHaveBeenCalled()
      } else {
        expect(stubs.authority.markFailed).toHaveBeenCalledWith('recovery')
      }
      lifecycle.stopAll()
    },
  )

  // Blacklisted codes on the commit path keep the generic failure shape -
  // auth/transport/protocol faults have their own terminal surfaces and
  // must not mount a remote-reset affordance.
  it('remote-authoritative ok boot: blacklisted commit refuse does NOT arm the save-issue surface', async () => {
    const stubs = makeStubs()
    stubs.coordinator = { ...stubs.coordinator, capability: 'remote-authoritative' }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'ok',
      revision: 5,
      save: { player: { lastSavedAt: 1_000 } },
      serverAuthority: { serverNowMs: 3_000 },
    })
    ;(stubs.player.save as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'unavailable',
      retryable: false,
      code: 'SESSION_REVOKED',
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('failed')
    expect(stubs.saveIssue.report).not.toHaveBeenCalled()
    expect(stubs.onError).toHaveBeenCalledTimes(1)
    lifecycle.stopAll()
  })

  it('pauseSimulation stops the clock + freezes combat; resumeSimulation re-anchors and resumes', async () => {
    const stubs = makeStubs()
    const lifecycle = makeLifecycle(stubs)

    const outcome = await lifecycle.bootGame({ createNewCharacter: true })
    expect(outcome.status).toBe('entered')
    expect(stubs.intervals).toHaveLength(1) // tick

    lifecycle.startAutosave() // App.vue arms this after boot
    expect(stubs.intervals).toHaveLength(2) // tick + autosave

    lifecycle.pauseSimulation()
    expect(lifecycle.isSimPaused()).toBe(true)
    expect(stubs.clock.stop).toHaveBeenCalledTimes(1)
    expect(stubs.gameManager.freezeCombat).toHaveBeenCalledWith('authority-pause')
    // Both intervals cleared while paused.
    expect(stubs.clearHandle).toHaveBeenCalled()

    lifecycle.resumeSimulation()
    expect(lifecycle.isSimPaused()).toBe(false)
    expect(stubs.gameManager.resumeCombat).toHaveBeenCalledWith('authority-pause')
    // clock.start called twice: once at boot, once at resume re-anchor.
    expect(stubs.clock.start).toHaveBeenCalledTimes(2)
    // Tick loop re-armed (a fresh interval was scheduled).
    expect(stubs.intervals.length).toBeGreaterThan(2)

    lifecycle.stopAll()
  })
})

describe('useAppLifecycle — B1-D production composition', () => {
  it('the domain snapshot is unchanged while admission is blocked, whatever fires', async () => {
    const stubs = makeStubs()

    // Real domain values behind the gated drivers: the tick interval
    // mutates progression, the autosave interval persists it, the combat
    // clock would step a battle. Blocking admission must leave all of it
    // untouched - not merely stop the wall clock.
    const domain = { cultivation: 0, persisted: 0, combatSteps: 0 }
    stubs.tick.mockImplementation(() => {
      domain.cultivation += 1
    })
    stubs.persistPlayer.mockImplementation(async () => {
      domain.persisted += 1
      return { status: 'ok' as const, revision: 1 }
    })
    ;(stubs.gameManager.freezeCombat as ReturnType<typeof vi.fn>).mockImplementation(() => {
      domain.combatSteps = -1 // sentinel: frozen, not stepped
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: true })
    expect(outcome.status).toBe('entered')
    lifecycle.startAutosave()

    // Live: drivers pay real domain state.
    stubs.authority.canMutate.mockReturnValue(true)
    stubs.intervals[0]?.()
    stubs.intervals[1]?.()
    expect(domain.cultivation).toBe(1)
    expect(domain.persisted).toBe(1)

    // Observed authority loss pauses admission; every autonomous driver
    // still fires (intervals are only cleared, callbacks may still land)
    // plus a late manual persist - and the domain stays exactly here.
    stubs.authority.canMutate.mockReturnValue(false)
    lifecycle.pauseSimulation()
    const snapshot = { ...domain }

    for (const fire of [...stubs.intervals]) fire()
    await lifecycle.persistProgress()

    expect(domain).toEqual(snapshot)
    expect(domain.combatSteps).toBe(-1) // combat frozen, never stepped

    lifecycle.stopAll()
  })
})

describe('useAppLifecycle — B1-D pause latch', () => {
  it('a terminal during boot does not latch simPaused - the next live pause still applies', async () => {
    const stubs = makeStubs()
    stubs.entryStage.value = 'auth' // boot admission still in flight
    const lifecycle = makeLifecycle(stubs)

    // The authority surface reports a terminal pause pre-game.
    lifecycle.pauseSimulation()
    expect(lifecycle.isSimPaused()).toBe(false)

    // The app reaches the game, then a real pause lands.
    stubs.entryStage.value = 'game'
    lifecycle.pauseSimulation()
    expect(lifecycle.isSimPaused()).toBe(true)
    expect(stubs.clock.stop).toHaveBeenCalledTimes(1)
    expect(stubs.gameManager.freezeCombat).toHaveBeenCalledWith('authority-pause')

    lifecycle.stopAll()
  })
})

describe('useAppLifecycle - beta-scope unsupported-save notice (contract sec.H)', () => {
  it('a restored save carrying out-of-scope records fires unsupportedSaveNotice once with the domain reason', async () => {
    const stubs = makeStubs()
    // Post-restore state: a save that crossed beyond the beta realm
    // ceiling. The notice names the dormant slice, once per load.
    stubs.player.$state = { realmId: 'golden_core' }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'ok',
      revision: 1,
      save: { player: {} },
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('entered')
    expect(stubs.unsupportedSaveNotice).toHaveBeenCalledTimes(1)
    expect(stubs.unsupportedSaveNotice).toHaveBeenCalledWith('realm_beyond_release')

    lifecycle.stopAll()
  })

  it('an in-scope restored save never fires the notice (absent fields are not records)', async () => {
    const stubs = makeStubs()
    // Minimal in-scope state: no way field, no dormant records. The
    // formation-loadout read must not treat a missing field as a record.
    stubs.player.$state = { realmId: 'mortal' }
    ;(stubs.coordinator.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 'ok',
      revision: 1,
      save: { player: {} },
    })

    const lifecycle = makeLifecycle(stubs)
    const outcome = await lifecycle.bootGame({ createNewCharacter: false })

    expect(outcome.status).toBe('entered')
    expect(stubs.unsupportedSaveNotice).not.toHaveBeenCalled()

    lifecycle.stopAll()
  })
})
