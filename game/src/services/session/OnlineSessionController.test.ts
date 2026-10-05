// B1-D (beta-final PR5) - the online-admission authority, deterministic
// edition: the scheduler and the monotonic clock are injected so heartbeat
// cadence, health-lease expiry, reconnect retries and flush/generation
// binding run without vitest fake timers or real time.
import { describe, expect, it, vi } from 'vitest'
import type { CloudSaveWriteResult } from '../cloudSave/CloudSaveService'
import type { GameSave } from '../save/SaveSystem'
import { authorityStateForError, OnlineSessionController } from './OnlineSessionController'
import type { PauseReason, ProbeOutcome, ReconnectOutcome } from './OnlineSessionController'

interface Scheduler {
  scheduleInterval: (callback: () => void, timeoutMs: number) => number
  clearHandle: (handle: number) => void
  fire: (ms: number) => void
  handles: Map<number, { callback: () => void; timeoutMs: number }>
}

function makeScheduler(): Scheduler {
  let nextHandle = 1
  const handles = new Map<number, { callback: () => void; timeoutMs: number }>()
  return {
    handles,
    scheduleInterval: (callback, timeoutMs) => {
      const handle = nextHandle++
      handles.set(handle, { callback, timeoutMs })
      return handle
    },
    clearHandle: (handle) => {
      handles.delete(handle)
    },
    fire: (timeoutMs) => {
      for (const { callback, timeoutMs: t } of [...handles.values()]) {
        if (t === timeoutMs) {
          callback()
        }
      }
    },
  }
}

function makeHarness(overrides: Partial<ConstructorParameters<typeof OnlineSessionController>[0]> = {}) {
  let now = 1_000_000
  const scheduler = makeScheduler()
  const pauses: PauseReason[] = []
  const resumes: Array<{ lineage: 'same' | 'replaced'; save?: GameSave; serverNowMs?: number }> = []
  const states: string[] = []

  const controller = new OnlineSessionController({
    monotonicNow: () => now,
    scheduleInterval: scheduler.scheduleInterval,
    clearHandle: scheduler.clearHandle,
    onPause: (reason) => pauses.push(reason),
    onResume: (lineage, save, serverAuthority) =>
      resumes.push({ lineage, save, serverNowMs: serverAuthority?.serverNowMs }),
    onStateChange: (state) => states.push(state),
    ...overrides,
  })

  return {
    controller,
    scheduler,
    pauses,
    resumes,
    states,
    advance: (ms: number) => {
      now += ms
    },
    getNow: () => now,
  }
}

const HB = 30_000
const RETRY = 10_000

describe('OnlineSessionController — admission + heartbeat + lease', () => {
  it('no probe (local mode): markReady arms nothing and the lease never expires', () => {
    const { controller, scheduler, advance } = makeHarness()

    controller.beginChecking()
    controller.markReady()

    expect(controller.authorityState).toBe('ready')
    expect(scheduler.handles.size).toBe(0)

    advance(10_000_000)
    expect(controller.canMutate()).toBe(true)
  })

  it('probe ok renews the health lease past the original deadline', async () => {
    const probe = vi.fn(async (): Promise<ProbeOutcome> => ({ status: 'ok' }))
    const { controller, scheduler, advance } = makeHarness({ probe })

    controller.beginChecking()
    controller.markReady()
    expect(scheduler.handles.size).toBe(1)

    // t+30s: heartbeat fires and renews the lease to t+70s.
    advance(30_000)
    scheduler.fire(HB)
    await vi.waitFor(() => expect(probe).toHaveBeenCalledTimes(1))

    // t+65s: beyond the ORIGINAL 40s deadline but inside the renewed one.
    advance(35_000)
    expect(controller.canMutate()).toBe(true)
  })

  it('lease expiry between beats is itself an observed loss: canMutate pauses', () => {
    const probe = vi.fn(async (): Promise<ProbeOutcome> => ({ status: 'ok' }))
    const reconnect = vi.fn(async (): Promise<ReconnectOutcome> => ({ status: 'unavailable' }))
    const { controller, pauses, advance } = makeHarness({ probe, reconnect })

    controller.beginChecking()
    controller.markReady()

    advance(40_001) // lease expired, no heartbeat landed in between
    expect(controller.canMutate()).toBe(false)
    expect(pauses).toEqual(['health-lease-expired'])
    expect(controller.authorityState).toBe('reconnecting')
  })

  it('heartbeat transient failure pauses and starts the reconnect pipeline', async () => {
    const probe = vi.fn(async (): Promise<ProbeOutcome> => ({
      status: 'unavailable',
      code: 'NETWORK_UNAVAILABLE',
      retryable: true,
    }))
    const reconnect = vi.fn(async (): Promise<ReconnectOutcome> => ({
      status: 'resumed',
      lineage: 'same',
    }))
    const { controller, scheduler, pauses, resumes, advance } = makeHarness({ probe, reconnect })

    controller.beginChecking()
    controller.markReady()
    advance(30_000)
    scheduler.fire(HB)
    await vi.waitFor(() => expect(resumes).toHaveLength(1))

    expect(pauses).toEqual(['heartbeat-failed'])
    expect(resumes[0]).toEqual({ lineage: 'same', save: undefined, serverNowMs: undefined })
    expect(controller.authorityState).toBe('ready')
  })

  it('reconnect unavailable keeps retrying on the 10s cadence', async () => {
    const probe = vi.fn(async (): Promise<ProbeOutcome> => ({ status: 'unavailable' }))
    const reconnect = vi.fn(async (): Promise<ReconnectOutcome> => ({ status: 'unavailable' }))
    const { controller, scheduler, advance } = makeHarness({ probe, reconnect })

    controller.beginChecking()
    controller.markReady()
    advance(30_000)
    scheduler.fire(HB)
    await vi.waitFor(() => expect(reconnect).toHaveBeenCalledTimes(1))
    expect(controller.authorityState).toBe('reconnecting')

    // Retry interval fires the pipeline again.
    scheduler.fire(RETRY)
    await vi.waitFor(() => expect(reconnect).toHaveBeenCalledTimes(2))
  })

  it('replaced lineage hands the authoritative payload to onResume (zero-accrual restore)', async () => {
    const probe = vi.fn(async (): Promise<ProbeOutcome> => ({ status: 'unavailable' }))
    const replacementSave = { marker: 'server-save' } as unknown as GameSave
    const reconnect = vi.fn(async (): Promise<ReconnectOutcome> => ({
      status: 'resumed',
      lineage: 'replaced',
      save: replacementSave,
      serverAuthority: { serverNowMs: 9_999 },
    }))
    const { controller, scheduler, resumes, advance } = makeHarness({ probe, reconnect })

    controller.beginChecking()
    controller.markReady()
    advance(30_000)
    scheduler.fire(HB)
    await vi.waitFor(() => expect(resumes).toHaveLength(1))

    expect(resumes[0]!.lineage).toBe('replaced')
    expect(resumes[0]!.save).toBe(replacementSave)
    expect(resumes[0]!.serverNowMs).toBe(9_999)
    expect(controller.authorityState).toBe('ready')
  })

  it('a stale reconnect outcome cannot resume: generation bump wins', async () => {
    let resolveReconnect: ((outcome: ReconnectOutcome) => void) | undefined
    const reconnect = vi.fn(
      () =>
        new Promise<ReconnectOutcome>((resolve) => {
          resolveReconnect = resolve
        }),
    )
    const { controller, resumes } = makeHarness({
      probe: async () => ({ status: 'unavailable' }) as ProbeOutcome,
      reconnect,
    })

    controller.beginChecking()
    controller.markReady()
    controller.pause('heartbeat-failed')
    await vi.waitFor(() => expect(reconnect).toHaveBeenCalledTimes(1))

    // The in-flight attempt's generation is captured; a terminal entry
    // bumps it, so the late 'resumed' outcome must be ignored.
    controller.observeSaveResult({ status: 'conflict' } as CloudSaveWriteResult)
    expect(controller.authorityState).toBe('conflict')

    resolveReconnect!({ status: 'resumed', lineage: 'same' })
    await Promise.resolve()
    await Promise.resolve()

    expect(resumes).toHaveLength(0)
    expect(controller.authorityState).toBe('conflict')
  })

  it('heartbeat SESSION_REVOKED is terminal; acknowledge() is the only way back to auth', async () => {
    const probe = vi.fn(async (): Promise<ProbeOutcome> => ({
      status: 'unavailable',
      code: 'SESSION_REVOKED',
    }))
    const { controller, scheduler, pauses, advance } = makeHarness({ probe })

    controller.beginChecking()
    controller.markReady()
    advance(30_000)
    scheduler.fire(HB)
    await vi.waitFor(() => expect(controller.authorityState).toBe('revoked'))

    expect(pauses).toEqual(['terminal'])
    expect(controller.canMutate()).toBe(false)
    // Retry is NOT armed in a terminal state.
    expect(scheduler.handles.size).toBe(0)

    controller.acknowledge()
    expect(controller.authorityState).toBe('signed-out')
  })

  it('non-retryable AUTH_EXPIRED on the heartbeat maps to revoked (credential is gone)', async () => {
    const probe = vi.fn(async (): Promise<ProbeOutcome> => ({
      status: 'unavailable',
      code: 'AUTH_EXPIRED',
      retryable: false,
    }))
    const { controller, scheduler, advance } = makeHarness({ probe })

    controller.beginChecking()
    controller.markReady()
    advance(30_000)
    scheduler.fire(HB)
    await vi.waitFor(() => expect(controller.authorityState).toBe('revoked'))
  })

  it('observeSaveResult: ok renews the lease; conflict goes terminal; transient pauses', () => {
    const reconnect = vi.fn(async (): Promise<ReconnectOutcome> => ({ status: 'unavailable' }))
    const { controller, pauses, advance } = makeHarness({
      probe: async () => ({ status: 'ok' }) as ProbeOutcome,
      reconnect,
    })

    controller.beginChecking()
    controller.markReady()

    // ok pushes the deadline out.
    advance(35_000)
    controller.observeSaveResult({ status: 'ok', revision: 2 } as CloudSaveWriteResult)
    advance(10_000) // now past the ORIGINAL deadline
    expect(controller.canMutate()).toBe(true)

    controller.observeSaveResult({ status: 'conflict' } as CloudSaveWriteResult)
    expect(controller.authorityState).toBe('conflict')
    expect(controller.canMutate()).toBe(false)

    // Fresh controller: transient unavailable pauses and reconnects.
    const second = makeHarness({ reconnect })
    second.controller.beginChecking()
    second.controller.markReady()
    second.controller.observeSaveResult({
      status: 'unavailable',
      code: 'NETWORK_UNAVAILABLE',
      retryable: true,
    } as CloudSaveWriteResult)
    expect(second.controller.authorityState).toBe('reconnecting')
    expect(second.pauses).toEqual(['save-failed'])

    // Non-retryable AUTH_EXPIRED on a save = credential cleared = revoked.
    const third = makeHarness({ reconnect })
    third.controller.beginChecking()
    third.controller.markReady()
    third.controller.observeSaveResult({
      status: 'unavailable',
      code: 'AUTH_EXPIRED',
      retryable: false,
    } as CloudSaveWriteResult)
    expect(third.controller.authorityState).toBe('revoked')
  })

  it('suspend() pauses; resumeFromSuspend() revalidates through the pipeline', async () => {
    const reconnect = vi.fn(async (): Promise<ReconnectOutcome> => ({ status: 'resumed', lineage: 'same' }))
    const { controller, pauses, resumes } = makeHarness({ reconnect })

    controller.beginChecking()
    controller.markReady()
    controller.suspend()
    expect(controller.authorityState).toBe('reconnecting')
    expect(pauses).toEqual(['suspend'])

    controller.resumeFromSuspend()
    await vi.waitFor(() => expect(resumes).toHaveLength(1))
    expect(controller.authorityState).toBe('ready')
  })
})

describe('OnlineSessionController — result-bearing flush (B1.9a)', () => {
  it('blocked when terminal, signed-out, or no save queue exists', async () => {
    const { controller } = makeHarness()
    // signed-out
    await expect(controller.flush('req-a')).resolves.toMatchObject({
      status: 'blocked',
      requestId: 'req-a',
    })

    // ready but no flushSave wired
    controller.beginChecking()
    controller.markReady()
    await expect(controller.flush('req-b')).resolves.toMatchObject({ status: 'blocked' })
  })

  it('saved result binds requestId + generation + revision; failure returns its code', async () => {
    const flushSave = vi
      .fn<() => Promise<CloudSaveWriteResult>>()
      .mockResolvedValueOnce({ status: 'ok', revision: 7 } as CloudSaveWriteResult)
      .mockResolvedValueOnce({ status: 'conflict' } as CloudSaveWriteResult)
      .mockResolvedValueOnce({
        status: 'unavailable',
        code: 'NETWORK_UNAVAILABLE',
      } as CloudSaveWriteResult)
    const { controller } = makeHarness({ flushSave })

    controller.beginChecking()
    controller.markReady()

    await expect(controller.flush('req-1')).resolves.toEqual({
      status: 'saved',
      requestId: 'req-1',
      generation: controller.currentGeneration,
      revision: 7,
    })
    await expect(controller.flush('req-2')).resolves.toMatchObject({
      status: 'failed',
      requestId: 'req-2',
      code: 'SAVE_CONFLICT',
    })
    await expect(controller.flush('req-3')).resolves.toMatchObject({
      status: 'failed',
      requestId: 'req-3',
      code: 'NETWORK_UNAVAILABLE',
    })
  })

  it('a flush that resolves after a generation bump reports failed, never saved', async () => {
    let resolveSave: ((result: CloudSaveWriteResult) => void) | undefined
    const flushSave = vi.fn(
      () =>
        new Promise<CloudSaveWriteResult>((resolve) => {
          resolveSave = resolve
        }),
    )
    const { controller } = makeHarness({ flushSave })

    controller.beginChecking()
    controller.markReady()

    const pending = controller.flush('req-stale')
    controller.pause('heartbeat-failed') // bumps the generation mid-flight
    resolveSave!({ status: 'ok', revision: 3 } as CloudSaveWriteResult)

    await expect(pending).resolves.toMatchObject({
      status: 'failed',
      requestId: 'req-stale',
      code: 'STALE_GENERATION',
    })
  })

  it('a throwing save queue reports failed instead of leaking', async () => {
    const flushSave = vi.fn(() => Promise.reject(new Error('boom')))
    const { controller } = makeHarness({ flushSave })

    controller.beginChecking()
    controller.markReady()

    await expect(controller.flush('req-x')).resolves.toMatchObject({
      status: 'failed',
      requestId: 'req-x',
      code: 'FLUSH_FAILED',
    })
  })
})

describe('authorityStateForError — B1.7 taxonomy', () => {
  it.each([
    ['SESSION_REVOKED', 'revoked'],
    ['SAVE_CONFLICT', 'conflict'],
    ['PROTOCOL_OUTDATED', 'update-required'],
    ['MAINTENANCE', 'maintenance'],
    ['SAVE_INVALID', 'recovery'],
    ['SAVE_TOO_LARGE', 'recovery'],
    ['CONFIGURATION_ERROR', 'recovery'],
    ['NETWORK_UNAVAILABLE', 'reconnecting'],
    ['SERVER_ERROR', 'reconnecting'],
    [undefined, 'reconnecting'],
  ] as const)('%s -> %s', (code, expected) => {
    expect(authorityStateForError(code)).toBe(expected)
  })
})

describe('OnlineSessionController — local-only mode', () => {
  it('a failed save in local-only mode is not an admission transition', () => {
    const { controller, pauses } = makeHarness({ reconnect: undefined })

    controller.beginChecking()
    controller.markReady()
    expect(controller.authorityState).toBe('ready')

    // A quota/IO failure in local mode belongs to the caller's own
    // notification surface - the authority must stay admitted.
    controller.observeSaveResult({ status: 'unavailable', message: 'quota', retryable: true })

    expect(controller.authorityState).toBe('ready')
    expect(pauses).toEqual([])
    expect(controller.canMutate()).toBe(true)
  })

  it('a deterministically throwing local onResume escalates to recovery after the failure budget (W6-AUT-2)', async () => {
    // Local mode has no retry cadence - each OS resume is one
    // attemptReconnect. A throwing onResume used to escape as an
    // unhandled rejection and wedge the session 'reconnecting' forever;
    // the resume-failure budget now classifies a deterministic thrower
    // terminally after 3 consecutive throws.
    const { controller } = makeHarness({
      reconnect: undefined,
      onResume: () => {
        throw new Error('broken restore')
      },
    })
    controller.beginChecking()
    controller.markReady()
    expect(controller.authorityState).toBe('ready')

    for (let i = 0; i < 3; i++) {
      controller.suspend()
      expect(controller.authorityState).toBe('reconnecting')
      controller.resumeFromSuspend()
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    expect(controller.authorityState).toBe('recovery')
  })

  it('a throwing remote onResume stays reconnecting until the budget, then lands recovery - no infinite RPC churn (W6-COR-4)', async () => {
    let reconnectCalls = 0
    const { controller, scheduler } = makeHarness({
      reconnect: async () => {
        reconnectCalls++
        return { status: 'resumed', lineage: 'same' as const }
      },
      onResume: () => {
        throw new Error('broken restore')
      },
    })
    controller.beginChecking()
    controller.markReady()
    controller.pause('suspend')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.authorityState).toBe('reconnecting')
    expect(reconnectCalls).toBe(1)

    // Ticks 2 and 3 complete the failure budget -> terminal 'recovery'.
    scheduler.fire(RETRY)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.authorityState).toBe('reconnecting')
    scheduler.fire(RETRY)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.authorityState).toBe('recovery')
    expect(reconnectCalls).toBe(3)

    // Terminal: the retry cadence is torn down - no more RPC churn.
    scheduler.fire(RETRY)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(reconnectCalls).toBe(3)
  })

  it('a successful onResume resets the failure streak (W6-COR-4)', async () => {
    let failures = 0
    const { controller, scheduler } = makeHarness({
      reconnect: async () => ({ status: 'resumed' as const, lineage: 'same' as const }),
      onResume: () => {
        failures++
        if (failures <= 2) throw new Error('flaky')
      },
    })
    controller.beginChecking()
    controller.markReady()
    controller.pause('suspend')
    await new Promise((resolve) => setTimeout(resolve, 0))
    scheduler.fire(RETRY)
    await new Promise((resolve) => setTimeout(resolve, 0))
    scheduler.fire(RETRY)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Two throws then a success inside the same budget window: the
    // session lands ready instead of escalating.
    expect(controller.authorityState).toBe('ready')
    expect(failures).toBe(3) // 2 throws + the successful third call
  })
})
