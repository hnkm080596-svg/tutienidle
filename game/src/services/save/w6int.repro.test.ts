// @vitest-environment jsdom
// W6-INT audit repro harness (temp file - not part of the suite).
//
// Attacks the wave-5 delta @1bd0763f at the integration seams:
//
//  (a) useBootFlow.fail()'s bounded retry (3 attempts, whenIdle waits
//      only the CURRENT in-flight transition). A competing request
//      issued in a microtask chained to each settling transition wins
//      the in-flight slot before fail()'s continuation runs - three
//      such transitions exhaust the bound and the terminal error route
//      NEVER mounts (silent give-up: the async loop simply returns).
//  (b) The same caller-side class the wave-5 fix closed for fail() is
//      still open at the sibling fire-and-forget seams
//      (useTribulation receipt drain / useBattleActions teardown),
//      which are themselves the likeliest competing requests.

import { describe, expect, it, vi } from 'vitest'

import {
  GamePresentationCoordinator,
  type CoordinatorDeps,
} from '../../presentation/GamePresentationCoordinator'
import {
  CompositeRenderer,
  createVueRouteAdapter,
} from '../../presentation/VueRouteAdapter'
import type {
  AssetPort,
  CurtainPort,
  TransitionResult,
} from '../../presentation/PresentationContracts'
import { PresentationSession } from '../../core/presentation/PresentationSession'
import { PhaserSceneAdapter } from '../../presentation/PhaserSceneAdapter'
import { useBootFlow } from '../../composables/useBootFlow'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}

async function flushTicks(count = 8) {
  for (let i = 0; i < count; i++) {
    await Promise.resolve()
  }
}

function makeRig(closeGate: { promise: Promise<void> }) {
  const sessionPort = new PresentationSession()
  const phaserAdapter = new PhaserSceneAdapter()
  // Headless rig: no Phaser.Game host exists, so PRIMARY_SCENE_ROUTES
  // targets (home/combat/tribulation) would block forever in
  // waitForGameReady. Stub the scene-ready half of prepare(); the Vue
  // waiter half is still exercised through markRouteMounted.
  phaserAdapter.prepare = vi.fn(async () => {})
  phaserAdapter.deactivate = vi.fn(async () => {})
  const compositeRenderer = new CompositeRenderer(phaserAdapter)
  const curtain: CurtainPort = {
    close: vi.fn(async () => {
      await closeGate.promise
    }),
    open: vi.fn(async () => {}),
  }
  const assets: AssetPort = { ensureFor: vi.fn(async () => {}) }
  const deps: CoordinatorDeps = {
    sessionPort,
    renderer: compositeRenderer,
    curtain,
    assets,
    initialRoute: 'home',
  }
  const coordinator = new GamePresentationCoordinator(deps)
  const routeAdapter = createVueRouteAdapter(coordinator, compositeRenderer)
  const flow = useBootFlow(coordinator, routeAdapter)
  return { coordinator, compositeRenderer, flow }
}

describe('W6-INT - useBootFlow.fail() vs microtask-chained competitors', () => {
  it('post-fix: an error request preempts the in-flight transition - the error route always mounts (W6-INT-1)', async () => {
    // Pre-fix this shape starved fail() forever: a competitor chained on
    // each settle re-took the in-flight slot inside the microtask gap
    // before any retry continuation ran. Post-fix the coordinator aborts
    // the in-flight on a conflicting 'error' request - the preempted
    // transition lands 'failed' and the error transition takes the slot.
    const gate = deferred()
    const { coordinator, compositeRenderer, flow } = makeRig(gate)

    // Transition A (home -> auth) is in flight, held at the curtain.
    const a: Promise<TransitionResult> = coordinator.request({ target: 'auth' })
    await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('closing'))

    // Competitor: a caller chaining off its own request's promise - the
    // exact shape a queued domain flow has (await request -> request the
    // next leg).
    const competitor = async (
      start: Promise<TransitionResult>,
      targets: Array<'auth' | 'character' | 'home'>,
    ) => {
      let prior = start
      for (const target of targets) {
        await prior
        prior = coordinator.request({ target })
      }
    }
    void competitor(a, ['character', 'home'])

    // fail()'s first attempt now ABORTS transition A instead of being
    // rejected - A's catch settles it 'failed' (curtain reopen included).
    flow.fail()
    await flushTicks()

    // Release the curtain so A's aborted close settles, then witness the
    // error mount the preempted transition yields to.
    gate.resolve()
    await flushTicks()
    compositeRenderer.markRouteMounted('error')
    await vi.waitFor(() => expect(coordinator.getSnapshot().currentRoute).toBe('error'))

    const snapshot = coordinator.getSnapshot()
    expect(flow.stage.value).toBe('error')
    expect(compositeRenderer.isRouteMounted('error')).toBe(true)

    // The aborted transition A resolved 'failed', and the competitor's
    // chained requests either rejected or are themselves preempted by
    // the error request that follows - 'error' always wins the slot.
    await a
    await flushTicks(16)
    await vi.waitFor(() => expect(coordinator.getSnapshot().currentRoute).toBe('error'))
  })

  it('CONTROL: without the chained competitor, the retry DOES mount the error route (fix works for one conflict)', async () => {
    const gate = deferred()
    const { coordinator, compositeRenderer, flow } = makeRig(gate)

    const a = coordinator.request({ target: 'auth' })
    await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('closing'))

    flow.fail()
    await flushTicks()

    gate.resolve()
    await flushTicks()
    compositeRenderer.markRouteMounted('auth')
    await flushTicks()
    compositeRenderer.markRouteMounted('error')
    await vi.waitFor(() => expect(coordinator.getSnapshot().currentRoute).toBe('error'))
    expect(flow.stage.value).toBe('error')
    await a
  })
})
