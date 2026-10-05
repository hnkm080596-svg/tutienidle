// W5-INT audit repro harness (temp file - not part of the suite).
// Wave-5 fix verification: the audit attacked the wave-4 onResume-reject
// fix at the integration seams it composes:
//
//  (a) useBootFlow.fail() retried on the coordinator's in-flight
//      {status:'rejected'} - the fix lands the retry in useBootFlow.fail()
//      (coordinator.request -> whenIdle -> request). This file pins the
//      coordinator-level semantics; the retry path is pinned in
//      useBootFlow.test.ts.
//  (b) OnlineSessionController.attemptReconnect now runs deps.onResume()
//      BEFORE markReady(), guarded by the generation fence: a throwing
//      resume keeps the session 'reconnecting' (retried, never
//      fake-ready) and a rejecting resume's markFailed wins.
//  (c) The local-mode sibling: onResume still runs OUTSIDE the try/catch
//      (unchanged semantics - a throw escapes as an unhandled rejection
//      on the void-floated promise) but markReady is now ordered after it
//      with the same generation guard.
//
// See game/docs/qa/fixpoint-codex-w5-INT.md.
import { describe, expect, it, vi } from 'vitest'

import {
  GamePresentationCoordinator,
  type CoordinatorDeps,
} from '../../presentation/GamePresentationCoordinator'
import type {
  AssetPort,
  CurtainPort,
  RendererPort,
} from '../../presentation/PresentationContracts'
import { PresentationSession } from '../../core/presentation/PresentationSession'
import { OnlineSessionController } from '../session/OnlineSessionController'
import type { ReconnectOutcome } from '../session/OnlineSessionController'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

async function flushTicks(count = 8) {
  for (let i = 0; i < count; i++) {
    await Promise.resolve()
  }
}

const CONTROLLER_SOURCE = import.meta.glob('../session/OnlineSessionController.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
})['../session/OnlineSessionController.ts'] as string

function makeCoordinator(overrides: Partial<CoordinatorDeps> = {}) {
  const sessionPort = new PresentationSession()
  const renderer: RendererPort = {
    prepare: vi.fn(async () => {}),
    deactivate: vi.fn(async () => {}),
  }
  const curtain: CurtainPort = {
    close: vi.fn(async () => {}),
    open: vi.fn(async () => {}),
  }
  const assets: AssetPort = {
    ensureFor: vi.fn(async () => {}),
  }
  const coordinator = new GamePresentationCoordinator({
    sessionPort,
    renderer,
    curtain,
    assets,
    initialRoute: 'home',
    ...overrides,
  })
  return { coordinator, sessionPort, renderer, curtain, assets }
}

describe('W5-INT repro - wave-4 onResume fix integration seams', () => {
  it('coordinator.request during an in-flight transition resolves REJECTED (useBootFlow.fail retries on it)', async () => {
    const closeGate = deferred()
    const { coordinator, sessionPort, curtain } = makeCoordinator()
    curtain.close = vi.fn(async () => {
      await closeGate.promise
    })

    // A route transition is already in flight (e.g. the user clicked a
    // battle just as the authority dropped - the reconnecting overlay has
    // not necessarily been observed before the click).
    const inFlight = coordinator.request({
      target: 'combat',
      behindCurtain: () => {
        // The domain command adopts the session it produced.
        sessionPort.begin({ kind: 'combat', sessionId: 7 }, 'interactive')
        return { target: 'combat', session: { kind: 'combat', sessionId: 7 } }
      },
    })
    await flushTicks()
    expect(coordinator.getSnapshot().phase).toBe('closing')

    // The coordinator's conflict contract: the competing request
    // RESOLVES 'rejected' (no throw, no log). A fire-and-forget caller
    // cannot observe it - which is why useBootFlow.fail() now retries
    // after whenIdle() instead of void-ing once. The useBootFlow-level
    // retry is pinned in useBootFlow.test.ts.
    const failResult = await coordinator.request({ target: 'error' })
    expect(failResult.status).toBe('rejected')

    // The in-flight transition WINS: the player lands in combat (or
    // whichever route was in flight) while saveIssue stays latched
    // 'corrupted' - a dead write that hijacks the NEXT 'error' mount with
    // the destructive reset gate instead of the boot-error card.
    closeGate.resolve()
    const inFlightResult = await inFlight
    expect(inFlightResult.status).toBe('entered')
    expect(coordinator.getSnapshot().currentRoute).toBe('combat')
    expect(coordinator.getSnapshot().phase).toBe('idle')
  })

  it('an onResume THROW keeps the session reconnecting: markReady never ran, retry stays armed, sim stays paused', async () => {
    const now = 1_000_000
    const intervals = new Map<number, { ms: number; cb: () => void }>()
    const cleared = new Set<number>()
    let nextHandle = 1
    const pauses: string[] = []
    const states: string[] = []
    const resumeAttempts: string[] = []

    const controller = new OnlineSessionController({
      probe: async () => ({ status: 'ok' }),
      reconnect: async (): Promise<ReconnectOutcome> => ({
        status: 'resumed',
        lineage: 'same',
      }),
      monotonicNow: () => now,
      scheduleInterval: (cb, ms) => {
        const handle = nextHandle++
        intervals.set(handle, { ms, cb })
        return handle
      },
      clearHandle: (h) => {
        cleared.add(h)
        intervals.delete(h)
      },
      onPause: (reason) => pauses.push(reason),
      onResume: (lineage) => {
        resumeAttempts.push(lineage)
        // The wave-4 App.vue handler runs restoreGameSession (which reads
        // the pending journal + acked envelope = localStorage, can throw
        // SecurityError on storage-disabled browsers) and saveIssue.report
        // BEFORE its own 'rejected' guard can return. Any synchronous
        // throw lands here.
        throw new Error('restore exploded mid-flight')
      },
      onStateChange: (s) => states.push(s),
    })

    // Post-boot: admitted, heartbeat armed.
    controller.beginChecking()
    controller.markReady()
    expect(controller.authorityState).toBe('ready')

    // Observed authority loss -> sim paused, retry armed, pipeline runs.
    controller.pause('heartbeat-failed')
    await flushTicks()

    // Post-fix ordering (W5-INT-3): onResume runs BEFORE markReady().
    // The throw lands in the pipeline catch and is classified as
    // 'unavailable' - the session never went 'ready', the heartbeat was
    // never re-armed, and the retry interval stays live so the next tick
    // re-runs the pipeline (overlay stays up, autosave stays gated).
    expect(controller.authorityState).toBe('reconnecting')
    expect(states).toEqual(['checking', 'ready', 'reconnecting'])
    expect(resumeAttempts).toEqual(['same'])
    expect(pauses).toEqual(['heartbeat-failed'])
    // Retry interval stays armed (10s); heartbeat was NOT re-armed (30s).
    expect([...intervals.values()].find((i) => i.ms === 10_000)).toBeDefined()
    expect([...intervals.values()].find((i) => i.ms === 30_000)).toBeUndefined()

    // The mutation gate stays closed: no fake-ready, no half-restored
    // autosave over the good server save.
    expect(controller.canMutate()).toBe(false)
  })

  it('local-mode sibling: attemptReconnect calls onResume OUTSIDE the try/catch (lexical pin)', () => {
    // Executing this path live produces an unhandled rejection (verified
    // during the audit: 'restore exploded mid-flight' escaped
    // resumeFromSuspend() as an unhandled rejection). The lexical pin
    // asserts the ordering fact without destabilizing the suite.
    const source = CONTROLLER_SOURCE
    const attempt = source.slice(source.indexOf('private async attemptReconnect'))
    const localCall = attempt.indexOf("this.deps.onResume?.('same')")
    const remoteCall = attempt.indexOf('this.deps.onResume?.(outcome.lineage')
    const tryStart = attempt.indexOf('try {')
    expect(localCall).toBeGreaterThan(-1)
    expect(remoteCall).toBeGreaterThan(-1)
    expect(tryStart).toBeGreaterThan(-1)
    // W6-AUT-2 fix: local-mode onResume now sits INSIDE its own
    // try/catch - a throw is classified like 'unavailable' (stays
    // 'reconnecting') until RESUME_FAILURE_BUDGET escalates to
    // 'recovery'. markReady runs only after a successful call.
    expect(localCall).toBeGreaterThan(tryStart)
    const localMarkReady = attempt.indexOf('this.markReady()', localCall)
    expect(localMarkReady).toBeGreaterThan(localCall)
    // Remote-mode onResume runs inside the try and BEFORE markReady -
    // the ordering that makes the swallow survivable (test above).
    expect(remoteCall).toBeGreaterThan(tryStart)
    const remoteMarkReady = attempt.indexOf('this.markReady()', remoteCall)
    expect(remoteMarkReady).toBeGreaterThan(remoteCall)
    // The failure budget exists in source: consecutive throws escalate.
    expect(source.indexOf('RESUME_FAILURE_BUDGET')).toBeGreaterThan(-1)
  })
})
