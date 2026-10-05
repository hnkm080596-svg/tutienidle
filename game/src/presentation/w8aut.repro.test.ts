// @vitest-environment jsdom
// W8-AUT audit repro harness (temp file - not part of the suite).
//
// Attacks the wave-7-adjudicated aborted-transition compensation
// @4f456cfd: runAdmitted fires options.compensate on
// 'rejected' | ('failed' && aborted) (createGamePresentation.ts:164-177)
// - but the ONLY session-kind caller that passes no compensate is
// useTribulation.triggerBreakthroughAction (useTribulation.ts:60-75).
// An 'error' request preemption during the tribulation transition leaves
// the accepted session detached with policy 'hold'
// (GamePresentationCoordinator.ts:502-503): held -> isBlocking() true ->
// TribulationDirector.update() early-returns and .active never clears ->
// start() refuses forever. Tribulation's own comment (:56-59) argues
// "orphaning is prevented up front" - that predates error-route
// preemption.
//
// EXECUTED here against the real coordinator + PresentationSession:
//   (a) tribulation-shaped call (no compensate): aborted -> session
//       stays held and current -> retry() cannot reach it (the error
//       transition clears the failed request record at its own step-3).
//   (b) combat-shaped call (compensate -> sessionPort.end): the orphan
//       is reaped AND retry() still rejects -> no double-compensation.

import { describe, expect, it, vi } from 'vitest'

import {
  GamePresentationCoordinator,
  type CoordinatorDeps,
} from './GamePresentationCoordinator'
import { CompositeRenderer } from './VueRouteAdapter'
import type { AssetPort, CurtainPort, TransitionResult } from './PresentationContracts'
import { PresentationSession, type SessionRef } from '../core/presentation/PresentationSession'
import { PhaserSceneAdapter } from './PhaserSceneAdapter'
import { createGamePresentation } from './createGamePresentation'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}

async function flushTicks(count = 10) {
  for (let i = 0; i < count; i++) {
    await Promise.resolve()
  }
}

function makeRig(assetsGate: { promise: Promise<void> }) {
  const sessionPort = new PresentationSession()
  const phaserAdapter = new PhaserSceneAdapter()
  phaserAdapter.prepare = vi.fn(async () => {})
  phaserAdapter.deactivate = vi.fn(async () => {})
  const compositeRenderer = new CompositeRenderer(phaserAdapter)
  const curtain: CurtainPort = {
    close: vi.fn(async () => {}),
    open: vi.fn(async () => {}),
  }
  const assets: AssetPort = {
    ensureFor: vi.fn(async () => {
      await assetsGate.promise
    }),
  }
  const deps: CoordinatorDeps = {
    sessionPort,
    renderer: compositeRenderer,
    curtain,
    assets,
    initialRoute: 'home',
  }
  const coordinator = new GamePresentationCoordinator(deps)
  return { sessionPort, compositeRenderer, coordinator, assets }
}

const SESSION: SessionRef = { kind: 'tribulation', sessionId: 7 }

describe('W8-AUT-2 repro - aborted tribulation transition orphans the held session', () => {
  it('no compensate (useTribulation shape): aborted -> session stays held+current, retry() rejected', async () => {
    const gate = deferred()
    const { sessionPort, compositeRenderer, coordinator, assets } = makeRig(gate)
    const presentation = createGamePresentation({ coordinator })

    // The domain side allocated + began the session inside start();
    // interactive mode holds it until a scene attaches.
    sessionPort.begin(SESSION, 'interactive')
    compositeRenderer.markRouteMounted('error')

    // useTribulation's exact call shape: no options, no compensate.
    const admitted = presentation.runAdmitted('tribulation', () => ({
      target: 'tribulation',
      session: SESSION,
    }))

    // Wait until the transition is parked at the assets step (hold
    // already taken), then preempt with the terminal-error request.
    await vi.waitFor(() => expect(assets.ensureFor).toHaveBeenCalledTimes(1))
    void coordinator.request({ target: 'error' })
    gate.resolve()

    const result = await admitted
    await flushTicks()

    expect(result.status).toBe('failed')
    expect(result.aborted).toBe(true)

    // detach('hold') keeps the session held: the domain's isBlocking()
    // gate freezes update() and active stays - a zombie session.
    expect(sessionPort.isBlocking()).toBe(true)
    expect(sessionPort.getCurrentSession()).toEqual(SESSION)

    // The transient 'failed' card was cleared by the error transition's
    // own step-3 - retry() cannot reach the orphan.
    expect(coordinator.getSnapshot().error).toBeNull()
    const retry = await coordinator.retry()
    expect(retry.status).toBe('rejected')

    presentation.dispose()
  })

  it('combat-shaped call (compensate = session end): orphan reaped once, retry() still rejects', async () => {
    const gate = deferred()
    const { sessionPort, compositeRenderer, coordinator, assets } = makeRig(gate)
    const presentation = createGamePresentation({ coordinator })

    const combat: SessionRef = { kind: 'combat', sessionId: 9 }
    sessionPort.begin(combat, 'interactive')
    compositeRenderer.markRouteMounted('error')
    compositeRenderer.markRouteMounted('combat')

    // Mirrors useBattleActions: compensate ends the domain session
    // (abandonBattle -> session.end -> held released).
    const compensate = vi.fn(() => sessionPort.end(combat))

    const admitted = presentation.runAdmitted(
      'combat',
      () => ({ target: 'combat', session: combat }),
      { compensate },
    )

    await vi.waitFor(() => expect(assets.ensureFor).toHaveBeenCalledTimes(1))
    void coordinator.request({ target: 'error' })
    gate.resolve()

    const result = await admitted
    await flushTicks()

    expect(result.status).toBe('failed')
    expect(result.aborted).toBe(true)
    expect(compensate).toHaveBeenCalledTimes(1)
    expect(sessionPort.isBlocking()).toBe(false)
    expect(sessionPort.getCurrentSession()).toBeNull()

    // No double-compensation: the aborted card cannot be retried - the
    // error transition's step-3 cleared the failed request, and even a
    // raced retry() rejects on the ended session's liveness check.
    const retry = await coordinator.retry()
    expect(retry.status).toBe('rejected')
    expect(compensate).toHaveBeenCalledTimes(1)

    presentation.dispose()
  })
})
