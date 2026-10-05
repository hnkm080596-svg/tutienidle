// @vitest-environment jsdom
// W8-AUT audit repro harness (temp file - not part of the suite).
//
// Attacks the wave-7-adjudicated OnlineSessionController @4f456cfd:
//
//  (a) The catch-path escalation calls markFailed('recovery') UNGUARDED
//      (:512/:528) - enterTerminal bumps the generation then runs
//      transition() BEFORE clearHeartbeat/clearRetry/onPause. A deps
//      callback that throws inside transition('recovery') leaves the
//      retry cadence armed behind a nominal terminal; the next tick's
//      attemptReconnect (no state guard, :458) can revive 'recovery'
//      back to 'ready' - a terminal that is not terminal.
//  (b) observeSaveResult's local early-return (:279) verified both
//      ways: without deps.reconnect an armed-class refuse reaches no
//      terminal; with it the same refuse lands 'recovery'.
//  (c) Mixed-class streak control: alternating throw/'unavailable'
//      never reaches the budget - consecutive-only semantics.
//  (d) Local-branch attemptReconnect never sets reconnectInFlight
//      (:488 is remote-only) - rapid suspend/resume double-runs
//      onResume.

import { describe, expect, it, vi } from 'vitest'
import type { CloudSaveWriteResult } from '../cloudSave/CloudSaveService'
import type { GameSave } from '../save/SaveSystem'
import { OnlineSessionController } from './OnlineSessionController'
import type { PauseReason, ReconnectOutcome } from './OnlineSessionController'

const RETRY = 10_000

function makeScheduler() {
  let nextHandle = 1
  const handles = new Map<number, { callback: () => void; timeoutMs: number }>()
  return {
    handles,
    scheduleInterval: (callback: () => void, timeoutMs: number) => {
      const handle = nextHandle++
      handles.set(handle, { callback, timeoutMs })
      return handle
    },
    clearHandle: (handle: number) => {
      handles.delete(handle)
    },
    fire: (timeoutMs: number) => {
      for (const { callback, timeoutMs: t } of [...handles.values()]) {
        if (t === timeoutMs) callback()
      }
    },
  }
}

function makeHarness(overrides: Partial<ConstructorParameters<typeof OnlineSessionController>[0]> = {}) {
  let now = 1_000_000
  const scheduler = makeScheduler()
  const pauses: PauseReason[] = []
  const resumes: Array<{ lineage: 'same' | 'replaced'; save?: GameSave }> = []
  const states: string[] = []

  const controller = new OnlineSessionController({
    monotonicNow: () => now,
    scheduleInterval: scheduler.scheduleInterval,
    clearHandle: scheduler.clearHandle,
    onPause: (reason) => pauses.push(reason),
    onResume: (lineage, save) => {
      resumes.push({ lineage, save })
    },
    onStateChange: (state) => states.push(state),
    ...overrides,
  })

  return { controller, scheduler, pauses, resumes, states, advance: (ms: number) => { now += ms } }
}

describe('W8-AUT-3 repro - escalation markFailed runs unguarded; enterTerminal is non-atomic', () => {
  it('a throwing onStateChange inside enterTerminal leaves the retry cadence armed -> next tick revives the terminal to ready', async () => {
    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => rejections.push(reason)
    process.on('unhandledRejection', onRejection)

    let reconnectCalls = 0
    const { controller, scheduler, states } = makeHarness({
      // 3 throwing attempts reach the streak budget; the 4th 'resumes'.
      reconnect: vi.fn(async (): Promise<ReconnectOutcome> => {
        reconnectCalls++
        if (reconnectCalls <= 3) throw new Error('pipeline blew up')
        return { status: 'resumed', lineage: 'same' }
      }),
      onStateChange: (state) => {
        states.push(state)
        if (state === 'recovery') throw new Error('state sink broke')
      },
    })

    try {
      controller.beginChecking()
      controller.markReady()
      controller.pause('suspend')
      await new Promise((resolve) => setTimeout(resolve, 0))
      // attempt 1 (immediate) threw -> streak 1, still reconnecting.
      expect(controller.authorityState).toBe('reconnecting')
      expect(reconnectCalls).toBe(1)

      scheduler.fire(RETRY) // attempt 2
      await new Promise((resolve) => setTimeout(resolve, 0))
      scheduler.fire(RETRY) // attempt 3 -> streak 3 -> markFailed('recovery')
      await new Promise((resolve) => setTimeout(resolve, 0))

      // The nominal terminal state was assigned (transition writes state
      // before invoking onStateChange) - the UI reads 'recovery'...
      expect(controller.authorityState).toBe('recovery')
      expect(states).toContain('recovery')
      // ...but enterTerminal's throw skipped clearRetry: the retry
      // cadence is STILL armed behind the terminal.
      expect(scheduler.handles.size).toBe(1)

      // The still-armed tick runs the pipeline anyway (attemptReconnect
      // has no state guard) - a 'resumed' outcome lands markReady.
      scheduler.fire(RETRY)
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Terminal revived without acknowledge(): the spec's sticky
      // terminal property is violated.
      expect(controller.authorityState).toBe('ready')
      expect(reconnectCalls).toBe(4)
      expect(rejections.length).toBeGreaterThanOrEqual(1)
    } finally {
      process.off('unhandledRejection', onRejection)
      controller.stopAll()
    }
  })
})

describe('W8-AUT markFailed-skip reachability - observeSaveResult local early-return', () => {
  it('no reconnect dep: an armed-class refuse reaches NO terminal (early return)', () => {
    const { controller } = makeHarness({ reconnect: undefined })
    controller.beginChecking()
    controller.markReady()

    controller.observeSaveResult({
      status: 'unavailable',
      code: 'SAVE_INVALID',
      retryable: false,
    } as CloudSaveWriteResult)

    // Local-only mode never transitions - stays 'ready'. (In shipped
    // configs the arm is unreachable here: every local save refuse is
    // retryable:true, so saveIssue/boot.fail never fire without this
    // path mattering.)
    expect(controller.authorityState).toBe('ready')
  })

  it('with reconnect dep: the same refuse lands recovery - the arm premise holds', () => {
    const { controller } = makeHarness({
      reconnect: async (): Promise<ReconnectOutcome> => ({ status: 'unavailable' }),
    })
    controller.beginChecking()
    controller.markReady()

    controller.observeSaveResult({
      status: 'unavailable',
      code: 'SAVE_INVALID',
      retryable: false,
    } as CloudSaveWriteResult)

    expect(controller.authorityState).toBe('recovery')
  })
})

describe('W8-AUT streak semantics - mixed-class failures stay consecutive-only', () => {
  it('alternating throw / unavailable never escalates (budget is consecutive)', async () => {
    let reconnectCalls = 0
    const { controller, scheduler } = makeHarness({
      reconnect: vi.fn(async (): Promise<ReconnectOutcome> => {
        reconnectCalls++
        if (reconnectCalls % 2 === 1) throw new Error('flaky pipeline')
        return { status: 'unavailable' }
      }),
    })

    controller.beginChecking()
    controller.markReady()
    controller.pause('suspend')
    await new Promise((resolve) => setTimeout(resolve, 0))

    for (let i = 0; i < 6; i++) {
      scheduler.fire(RETRY)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    // throw,unavailable,throw,unavailable,... -> the 'unavailable'
    // outcome resets the streak at :517 - never 3 consecutive.
    expect(controller.authorityState).toBe('reconnecting')
    expect(reconnectCalls).toBe(7)
    controller.stopAll()
  })
})

describe('W8-AUT nit - local-branch attemptReconnect has no in-flight dedup', () => {
  it('two rapid resumeFromSuspend calls run onResume twice concurrently', async () => {
    let resumeCalls = 0
    let release: () => void = () => undefined
    const gate = new Promise<void>((yes) => { release = yes })
    const { controller } = makeHarness({
      reconnect: undefined,
      onResume: async () => {
        resumeCalls++
        await gate
      },
    })

    controller.beginChecking()
    controller.markReady()
    controller.suspend()
    expect(controller.authorityState).toBe('reconnecting')

    controller.resumeFromSuspend()
    controller.resumeFromSuspend()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Remote mode dedups via reconnectInFlight (:488); the local branch
    // returns before the flag is ever set - both calls ran the resume.
    expect(resumeCalls).toBe(2)

    release()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.authorityState).toBe('ready')
    controller.stopAll()
  })
})
