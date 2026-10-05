// W5-INT audit repro harness (temp file - not part of the suite).
// Attacks the wave-4 onResume-reject fix at the integration seams it
// composes, not the lines it edited:
//
//  (a) useBootFlow.fail() === `void coordinator.request({target:'error'})`.
//      When ANY route transition is already in flight the coordinator
//      resolves the request {status:'rejected'} (never throws), and the
//      void-swallow drops it silently - the wave-4 "unmount the game on
//      resume-reject" fix is a no-op in exactly the race window it was
//      written for, so the saveIssue dead-write + stale-latch hijack
//      (W4-INT-1 class) survives in that window.
//  (b) OnlineSessionController.attemptReconnect calls markReady() BEFORE
//      deps.onResume(). An onResume that THROWS (rather than returning
//      'rejected') is swallowed by the pipeline catch - after markReady
//      already transitioned to 'ready', re-armed the heartbeat and
//      cleared the retry handle. The catch's "still unavailable - keep
//      retrying" assumption is false: nothing retries, the sim stays
//      paused forever, and canMutate() keeps the autosave path open for
//      the half-restored state.
//  (c) The local-mode sibling of (b): attemptReconnect's !reconnect
//      branch runs markReady()+onResume OUTSIDE the try/catch, so the
//      throw escapes as an unhandled rejection on a `void`-floated
//      promise. Pinned lexically - executing it live registers an
//      unhandled rejection that vitest flags as a suite error.
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
  it('bootFlow.fail() during an in-flight transition resolves REJECTED and is silently dropped', async () => {
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

    // The wave-4 fix fires here: useBootFlow.fail() ===
    // `void coordinator.request({target:'error'})`.
    const failResult = await coordinator.request({ target: 'error' })

    // Silently dropped: it RESOLVES 'rejected' (no throw, no log), so the
    // `void` in bootFlow.fail() hides the drop entirely. No caller can
    // observe that the error transition never happened.
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

  it('an onResume THROW lands after markReady(): ready + heartbeat armed + retry cleared + sim never resumed', async () => {
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

    // The reconnect pipeline RESOLVED 'resumed'. markReady() ran first:
    // state 'ready', heartbeat re-armed, retry cleared. THEN onResume
    // threw - and the catch block's comment ("still unavailable - keep
    // retrying") is wrong: the retry handle markReady() just cleared was
    // the last retry there will ever be.
    expect(controller.authorityState).toBe('ready')
    expect(states).toEqual(['checking', 'ready', 'reconnecting', 'ready'])
    expect(resumeAttempts).toEqual(['same'])
    expect(pauses).toEqual(['heartbeat-failed']) // sim paused...
    // ...and NEVER resumed. No retry interval is live; only the heartbeat
    // remains - it keeps renewing the health lease and holding 'ready'
    // forever because the SERVER is fine; the crash was client-side.
    expect([...intervals.values()].find((i) => i.ms === 10_000)).toBeUndefined()
    expect([...intervals.values()].find((i) => i.ms === 30_000)).toBeDefined()

    // The mutation gate still says YES. The overlay is down ('ready'),
    // the sim is permanently frozen, and the next persistProgress() can
    // autosave the half-restored state over the good server save - with
    // no error surface anywhere.
    expect(controller.canMutate()).toBe(true)
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
    // Local-mode onResume runs BEFORE the try opens - a throw rejects the
    // `void`-floated attemptReconnect() promise (unhandled rejection) and
    // still leaves the same markReady-then-crash dead session as the
    // remote path above.
    expect(localCall).toBeLessThan(tryStart)
    // Remote-mode onResume runs inside the try but AFTER markReady() -
    // which is what makes the swallow fatal (test above).
    expect(remoteCall).toBeGreaterThan(tryStart)
    const markReadyIdx = attempt.indexOf('this.markReady()', tryStart)
    expect(markReadyIdx).toBeGreaterThan(tryStart)
    expect(remoteCall).toBeGreaterThan(markReadyIdx)
  })
})
