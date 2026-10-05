// W7-INT audit repro harness (temp file - not part of the suite).
//
// Wave-6 delta under attack: git diff 1bd0763f..cc4a51e7
//   (a) coordinator error-request preemption: request({target:'error'})
//       aborts the in-flight transition, awaits its settle, recurses
//       (GamePresentationCoordinator.ts:213-225).
//   (b) OnlineSessionController RESUME_FAILURE_BUDGET=3 +
//       resumeFailureStreak in both attemptReconnect branches.
//   (c) useBootFlow.fail() bound 3->10 + starvation breadcrumb.
//   (d) useAppLifecycle firstSave arm gate (payload-reject codes only).
//
// Ledger: game/docs/qa/fixpoint-codex-w7-INT.md
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import {
  GamePresentationCoordinator,
  type CoordinatorDeps,
} from '../../presentation/GamePresentationCoordinator'
import type {
  AssetPort,
  CurtainPort,
  RendererPort,
} from '../../presentation/PresentationContracts'
import type { VueRouteAdapter } from '../../presentation/VueRouteAdapter'
import { PresentationSession } from '../../core/presentation/PresentationSession'
import { OnlineSessionController } from '../session/OnlineSessionController'
import type { ReconnectOutcome } from '../session/OnlineSessionController'
import { useBootFlow } from '../../composables/useBootFlow'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

async function flushTicks(count = 12) {
  for (let i = 0; i < count; i++) {
    await Promise.resolve()
  }
}

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

// Minimal scheduler/interval rig mirroring OnlineSessionController.test.ts.
function makeControllerRig(overrides: Record<string, unknown> = {}) {
  let now = 1_000_000
  const intervals = new Map<number, { ms: number; cb: () => void }>()
  let nextHandle = 1
  const pauses: string[] = []
  const states: string[] = []
  const deps = {
    monotonicNow: () => now,
    scheduleInterval: (cb: () => void, ms: number) => {
      const handle = nextHandle++
      intervals.set(handle, { ms, cb })
      return handle
    },
    clearHandle: (h: number) => {
      intervals.delete(h)
    },
    onPause: (reason: string) => pauses.push(reason),
    onStateChange: (s: string) => states.push(s),
    ...overrides,
  }
  const controller = new OnlineSessionController(
    deps as ConstructorParameters<typeof OnlineSessionController>[0],
  )
  const fire = (ms: number) => {
    for (const { ms: iMs, cb } of [...intervals.values()]) {
      if (iMs === ms) cb()
    }
  }
  return { controller, pauses, states, intervals, fire }
}

describe('W7-INT repro - wave-6 delta seams', () => {
  // ------------------------------------------------------------------
  // W7-INT-1: resumeFailureStreak is only cleared by a SUCCESSFUL
  // onResume. acknowledge() (the owned user reset back to sign-in),
  // beginChecking()/markReady() (a fresh admission), and enterTerminal
  // itself all leave the counter armed. Two throws in admission A,
  // one acknowledge/re-auth cycle, then a SINGLE throw in admission B
  // escalates straight to 'recovery' - the retry cadence never got a
  // chance to run in the new admission. Post-escalation the ratchet is
  // permanent: every later single throw re-escalates instantly.
  // ------------------------------------------------------------------
  it('W7-INT-1a (local branch): resume-failure streak leaks across acknowledge() + re-admission', async () => {
    const { controller, states } = makeControllerRig({
      onResume: () => {
        throw new Error('restore exploded mid-flight')
      },
    })

    controller.beginChecking()
    controller.markReady()
    expect(controller.authorityState).toBe('ready')

    // Admission A: two consecutive onResume throws -> streak 2, still
    // retrying ('reconnecting'), correctly below the budget.
    controller.suspend()
    controller.resumeFromSuspend()
    await flushTicks()
    controller.resumeFromSuspend()
    await flushTicks()
    expect(controller.authorityState).toBe('reconnecting')

    // Owned acknowledgement + a full re-admission cycle.
    controller.acknowledge()
    expect(controller.authorityState).toBe('signed-out')
    controller.beginChecking()
    controller.markReady()
    expect(controller.authorityState).toBe('ready')

    // Admission B: ONE throw should land 'reconnecting' (streak 1 of a
    // fresh admission); the leaked counter makes it the third and
    // escalates to 'recovery' before the new admission retried once.
    controller.suspend()
    controller.resumeFromSuspend()
    await flushTicks()
    expect(controller.authorityState).toBe('recovery')
    expect(states.filter((s) => s === 'recovery')).toHaveLength(1)

    // The ratchet is permanent until an onResume actually succeeds:
    // acknowledge + re-admit + ONE throw -> straight back to 'recovery'.
    controller.acknowledge()
    controller.beginChecking()
    controller.markReady()
    controller.suspend()
    controller.resumeFromSuspend()
    await flushTicks()
    expect(controller.authorityState).toBe('recovery')
  })

  it('W7-INT-1b (remote branch): same leak through the reconnect pipeline + retry cadence', async () => {
    const { controller, fire } = makeControllerRig({
      reconnect: async (): Promise<ReconnectOutcome> => ({
        status: 'resumed',
        lineage: 'same',
      }),
      onResume: () => {
        throw new Error('restore exploded mid-flight')
      },
    })

    controller.beginChecking()
    controller.markReady()

    controller.pause('suspend')
    await flushTicks() // attempt 1 -> throw, streak 1
    fire(10_000) // retry tick -> attempt 2 -> throw, streak 2
    await flushTicks()
    expect(controller.authorityState).toBe('reconnecting')

    controller.acknowledge()
    controller.beginChecking()
    controller.markReady()

    // Fresh admission, single throw -> 'recovery' instead of
    // 'reconnecting': the budget carried over from the old admission.
    controller.pause('suspend')
    await flushTicks()
    expect(controller.authorityState).toBe('recovery')
  })

  // ------------------------------------------------------------------
  // W7-INT-2: the preempt path awaits the aborted transition's promise
  // with no deadline. The catch-path curtain reopen
  // (executeTransition:523-524) calls curtain.open with a FRESH signal
  // and NO withTimeout - a CurtainPort whose open never settles wedges
  // the preempting error request forever. The shipped overlay self-heals
  // via its 600ms safety timeout, so this is a contract-level hole, but
  // it is the same silent-hang class wave-6 was built to kill - now
  // relocated onto the request itself (fail()'s first await never
  // returns; its retry loop and breadcrumb never even start).
  // ------------------------------------------------------------------
  it('W7-INT-2: error preemption hangs forever when the aborted catch-path reopen never settles', async () => {
    const stuckOpen = deferred()
    const { coordinator, curtain, assets } = makeCoordinator()
    let openCalls = 0
    curtain.open = vi.fn(() => {
      openCalls++
      return openCalls === 1 ? stuckOpen.promise : Promise.resolve()
    })
    // ensureFor throws only for the in-flight request's target - the
    // 'error' route itself carries no bundles (AssetBundleCatalog:774)
    // and must be allowed to mount once the hang releases.
    assets.ensureFor = vi.fn(async (req) => {
      if (req.target !== 'error') {
        throw new Error('asset pipeline exploded')
      }
    })

    // behindCurtain work request: close resolves, domain work passes,
    // ensureFor throws -> catch path -> behindCurtain && curtainClosed
    // -> curtain.open (call 1) hangs forever -> the transition promise
    // NEVER settles.
    const a = coordinator.request({ target: 'home', behindCurtain: () => true })
    await flushTicks()

    let aSettled = false
    let eSettled = false
    void a.then(() => {
      aSettled = true
    })
    const e = coordinator.request({ target: 'error' })
    void e.then(() => {
      eSettled = true
    })
    await flushTicks(24)

    // The aborted transition never settled; the error request is parked
    // on `await inFlightPromise` - no 'rejected', no error route, no
    // breadcrumb. Silent wedging, identical externally to the pre-fix
    // starvation shape.
    expect(aSettled).toBe(false)
    expect(eSettled).toBe(false)
    expect(coordinator.getSnapshot().currentRoute).toBe('home')
    expect(coordinator.getSnapshot().phase).toBe('loading') // frozen mid-catch

    // Recovery only exists if the port eventually settles: release the
    // reopen, the aborted transition lands 'failed', the recursion
    // re-enters and mounts 'error'.
    stuckOpen.resolve()
    const eResult = await e
    expect(eResult.status).toBe('entered')
    expect(coordinator.getSnapshot().currentRoute).toBe('error')
    const aResult = await a
    expect(aResult.status).toBe('failed')
  })

  // ------------------------------------------------------------------
  // W7-INT-3: the wave-6 comment claims the preempting request "takes
  // the cleared slot first" because its .then continuation "was
  // registered BEFORE the competitor's settle continuation". False for
  // the competitor shape it cites: a caller chained on the aborted
  // request's OUTER promise resumes inside request()'s finally - one
  // microtask hop EARLIER than the preemptor's .then-wrapped await on
  // the inner executeTransition promise. The competitor lands the
  // cleared slot, runs a fresh transition, and is itself aborted
  // ('failed' + transient 'Transition aborted' error record) before the
  // recursion re-preempts. Convergent, but the stated invariant is
  // falsified and each chained hop costs an aborted-transition cycle.
  // Also: the preempted session-route transition's adopted hold is
  // detached 'hold' and its failedRequest pin is wiped by the error
  // transition at step 3 - the combat session survives as an
  // uncommitted zombie with no retry surface.
  // ------------------------------------------------------------------
  it('W7-INT-3: a settle-chained competitor lands the cleared slot before the preempting error request', async () => {
    const prepareGate = deferred()
    const { coordinator, sessionPort, renderer, curtain } = makeCoordinator()
    renderer.prepare = vi.fn(async () => {
      await prepareGate.promise
    })
    const errors: string[] = []
    coordinator.subscribe((s) => {
      if (s.error) errors.push(s.error.message)
    })

    // A combat session route parked at 'awaiting-ready'.
    sessionPort.begin({ kind: 'combat', sessionId: 7 }, 'interactive')
    const a = coordinator.request({
      target: 'combat',
      session: { kind: 'combat', sessionId: 7 },
    })
    await flushTicks()
    expect(coordinator.getSnapshot().phase).toBe('awaiting-ready')

    // Competitor chained on the aborted request's settle - the exact
    // retry shape the wave-6 comment describes.
    const b = a.then(() => coordinator.request({ target: 'home' }))
    const e = coordinator.request({ target: 'error' })

    prepareGate.resolve()
    const [aResult, bResult, eResult] = await Promise.all([a, b, e])

    expect(aResult.status).toBe('failed')
    // The competitor did NOT get 'rejected' at admission - it took the
    // cleared slot, ran a transition (curtain.close invoked for it), and
    // was aborted by the error request's recursion.
    expect(bResult.status).toBe('failed')
    expect(eResult.status).toBe('entered')
    expect(coordinator.getSnapshot().currentRoute).toBe('error')
    // close() ran for A, the landed competitor B, and the error
    // transition E: three close invocations prove a real transition was
    // executed between A's settle and E's admission, not a refused one.
    expect(curtain.close).toHaveBeenCalledTimes(3)
    // Each abort recorded the generic 'Transition aborted' failure (the
    // error card flashes it until E's step-3 error clear).
    expect(errors.filter((m) => m === 'Transition aborted').length).toBeGreaterThanOrEqual(1)
    // The preempted combat session stays live-but-detached ('hold'
    // policy): nobody committed it, nobody retried it, and E's step-3
    // clear dropped the failedRequest that could have resumed it.
    expect(sessionPort.isCurrentSession({ kind: 'combat', sessionId: 7 })).toBe(true)
    expect(coordinator.getSnapshot().error).toBeNull()
  })

  // ------------------------------------------------------------------
  // Control matrix (dispatched surfaces, all CLEAN):
  //  - two concurrent error requests dedup-share the same in-flight
  //    transition (isSameRequest matches on target+session only).
  //  - a non-error conflicting request is still admission-'rejected'.
  //  - a same-target request shares the in-flight promise unchanged.
  //  - abort during 'awaiting-ready' lands 'failed' via checkAborted
  //    (covered inside W7-INT-3's rig).
  // ------------------------------------------------------------------
  it('control: concurrent error requests share; non-error conflict rejected; same-target shares', async () => {
    const closeGate = deferred()
    const { coordinator, curtain } = makeCoordinator()
    curtain.close = vi.fn(async () => {
      await closeGate.promise
    })

    const a = coordinator.request({ target: 'auth' })
    await flushTicks()
    expect(coordinator.getSnapshot().phase).toBe('closing')

    // Two concurrent error requests -> one preempt chain; both callers
    // resolve on the SAME transition (dedup shares the in-flight slot).
    const e1 = coordinator.request({ target: 'error' })
    const e2 = coordinator.request({ target: 'error' })
    // A non-error conflicting request is still refused at admission.
    const conflict = coordinator.request({ target: 'character' })
    // A same-target request shares A's promise unchanged.
    const dup = coordinator.request({ target: 'auth' })

    closeGate.resolve()
    const [e1r, e2r, cR, dR, aR] = await Promise.all([e1, e2, conflict, dup, a])
    expect(aR.status).toBe('failed')
    expect(e1r.status).toBe('entered')
    expect(e2r.status).toBe('entered')
    expect(e1r.transitionId).toBe(e2r.transitionId) // shared transition
    expect(cR.status).toBe('rejected')
    expect(dR.status).toBe('failed') // shared A's aborted transition
    expect(coordinator.getSnapshot().currentRoute).toBe('error')
  })

  // ------------------------------------------------------------------
  // W7-INT-4: dispose() mid-preempt-await resolves 'rejected' (safe),
  // but against a merely-disposed coordinator fail() burns its whole
  // 10-attempt budget and logs "stayed busy through the retry budget" -
  // the coordinator was dead, not busy: the breadcrumb's stated cause is
  // wrong precisely when it fires. For a live coordinator 'rejected' is
  // unreachable for {target:'error'} (edge always allowed, isUnchanged
  // returns 'unchanged', preemption never rejects), so the loop is
  // vestigial rather than protective - the residual hang moved to the
  // request itself (W7-INT-2).
  // ------------------------------------------------------------------
  it('W7-INT-4a: dispose() mid-preempt-await settles the error request REJECTED, not hung', async () => {
    const loadGate = deferred()
    const openGate = deferred()
    const { coordinator, assets, curtain } = makeCoordinator()
    assets.ensureFor = vi.fn(async () => {
      await loadGate.promise
    })
    // Park the aborted catch-path reopen: A settles only after dispose()
    // has run, so the preempt recursion re-enters request() post-dispose.
    curtain.open = vi.fn(async () => {
      await openGate.promise
    })

    const a = coordinator.request({ target: 'home', behindCurtain: () => true })
    await flushTicks()
    const e = coordinator.request({ target: 'error' })
    await flushTicks()

    coordinator.dispose()
    openGate.resolve()
    loadGate.resolve()
    const [aResult, eResult] = await Promise.all([a, e])
    expect(aResult.status).toBe('failed')
    // The preempting request's recursion landed after dispose() -> the
    // request() disposed guard rejected it. (A preempting request that
    // lands its own transition BEFORE dispose instead ends 'failed' via
    // the dispose-abort - both settle; neither hangs.)
    expect(eResult.status).toBe('rejected')
  })

  it('W7-INT-4b: fail() on a disposed coordinator burns the full budget then logs a misleading starvation breadcrumb', async () => {
    const { coordinator } = makeCoordinator()
    const routeAdapter = {
      activeRoute: ref('home'),
      phase: ref('idle'),
      error: ref(null),
      targetRoute: ref(null),
    } as unknown as VueRouteAdapter
    const flow = useBootFlow(coordinator, routeAdapter)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    coordinator.dispose()
    flow.fail()
    await flushTicks(40)

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0]?.[0]).toContain('stayed busy')
    errorSpy.mockRestore()
  })

  // ------------------------------------------------------------------
  // W7-INT-5 (latent, pre-existing): request()'s in-flight slot is
  // double-booked during executeTransition's synchronous head.
  // inFlightRequest is assigned at :243 but inFlightPromise only at
  // :249 - AFTER executeTransition's sync head ran (targetRoute set +
  // notify at :300). A subscriber that calls request() inside notify()
  // sees `inFlightRequest && inFlightPromise` === false, skips the
  // dedup/preempt/reject block entirely, and allocates a SECOND live
  // transition that overwrites inFlightRequest/currentAbortController;
  // line 249 then re-overwrites inFlightPromise with A's. Two concurrent
  // executeTransition bodies mutate shared phase/route state. No
  // production subscriber calls request() inside notify() today (all
  // only write refs), so this is a latent contract gap, not a live bug.
  // ------------------------------------------------------------------
  it('W7-INT-5: a request() issued inside the sync-head notify() double-allocates the single-flight slot', async () => {
    const { coordinator, curtain } = makeCoordinator()
    let nestedResult: { status: string } | undefined
    let fired = false
    coordinator.subscribe((s) => {
      if (!fired && s.targetRoute === 'home' && s.phase === 'idle') {
        fired = true
        // Re-entrant request inside the transition's sync head: the
        // in-flight slot's promise is not yet assigned, so the guard is
        // skipped and a second transition is allocated.
        void coordinator.request({ target: 'error' }).then((r) => {
          nestedResult = r
        })
      }
    })

    const aResult = await coordinator.request({ target: 'home', behindCurtain: () => true })
    await flushTicks()

    // Both transitions ran: the curtain closed twice (A's close plus the
    // nested E's close) even though the slot is documented single-flight.
    expect(curtain.close).toHaveBeenCalledTimes(2)
    expect(aResult.status).toBe('entered')
    expect(nestedResult?.status).toBe('entered')
    expect(coordinator.getSnapshot().currentRoute).toBe('error')
  })

  // ------------------------------------------------------------------
  // W7-INT-6: the firstSave arm at useAppLifecycle:632 fires
  // markFailed('recovery') AFTER observeSaveResult(:615) already
  // classified the same result - SAVE_INVALID/SAVE_TOO_LARGE map to
  // 'recovery' via authorityStateForError. Each enterTerminal bumps
  // generation and fires onPause('terminal') again: the arm's work is a
  // second, redundant terminal entry (plus saveIssue.report + fail(),
  // which are the arm's actual purpose). Harmless but duplicated
  // lifecycle evidence.
  // ------------------------------------------------------------------
  it('W7-INT-6: SAVE_INVALID first-save enters terminal twice (observeSaveResult + arm markFailed)', () => {
    const { controller, pauses } = makeControllerRig({
      reconnect: async (): Promise<ReconnectOutcome> => ({
        status: 'resumed',
        lineage: 'same',
      }),
    })
    controller.beginChecking()
    controller.markReady()
    const generationBefore = controller.currentGeneration

    // The arm path replays exactly what useAppLifecycle:615+632 do.
    controller.observeSaveResult({
      status: 'unavailable',
      code: 'SAVE_INVALID',
      message: 'rejected',
      retryable: false,
    })
    controller.markFailed('recovery')

    expect(controller.authorityState).toBe('recovery')
    // Two terminal entries: two onPause('terminal'), generation +2.
    expect(pauses).toEqual(['terminal', 'terminal'])
    expect(controller.currentGeneration).toBe(generationBefore + 2)
  })
})
