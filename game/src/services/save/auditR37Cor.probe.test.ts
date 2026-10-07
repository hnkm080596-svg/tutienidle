// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { ANIMATION_FALLBACK_MS } from '../../core/game/GameManagerTurnBattleOps'
import { defineEnemy } from '../../core/enemy/Enemy'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r37 COR wave. Blind correctness audit of the r36
// adjudication at 796df2ee. Sections:
//
//   (A) Freeze-reason census: the closed 5-reason union classified by owner
//       scope. 'user-pause' is the only battle-scoped latch (dropped by the
//       step-7 filter); 'authority-pause'/'tab-hidden' are session-scoped
//       carries; 'turn-in-flight' is scrubbed by turnToken.reset() before
//       the snapshot (the listener emits on EVERY reset - even a foreign
//       latch dies by name); 'not-revealed' is re-derived by
//       syncOffScreenFreeze. A2b pins the swap-path misuse edge
//       (r37-COR-4): setCombatClockSource has no token reset, so a foreign
//       'turn-in-flight' latch carries verbatim and can never be resumed.
//   (B) Cycle-epoch coverage: pendingStepGeneration bumps on every teardown
//       funnel (discard / abandon / restart / same-battle re-pipeline), and
//       the abandonBattle mid-emit re-mint hazard (r37-COR-3): battle_end is
//       emitted before the teardown tail runs, so a synchronous battle-start
//       inside a subscriber mints a cycle that the tail then tears down.
//   (C) pendingStepTimers "live handles only" invariant residuals
//       (r37-COR-1): the admin-latch arm swaps handles correctly (identity
//       pinned, not just length), but the isBlocking deferral arm and the
//       settle path both leave dead handles behind - bounded, self-cleaning.
//   (D) setCombatClockSource preservation: mid-turn swap keeps the claimed
//       token AND the 'turn-in-flight' latch coherent on the rebound
//       listener, verbatim order is preserved, stopped stays stopped.
//   (E) Curtain-watch data contract: every teardown clears 'tab-hidden'
//       synchronously, so the App.vue stateVersion watch's input is always
//       satisfied one bump later (the bump-starvation gap is report-only).
//   (F) r36-AUT-1 bounds: the renderer-ACK channel cannot exceed the
//       in-flight turn's residual (replay rejects), cannot land on a
//       different owner (stale token rejects post-re-mint), and cannot
//       survive a discard (playbackToken is wiped to '').
//
// ASCII only (P15).
// ============================================================================

function registeredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

/**
 * A battle parked mid-turn under an interactive presentation whose session
 * hold was released (released + interactive => isBlocking() false). The
 * parked 'ready' step freezes the clock via 'turn-in-flight'. Returns the
 * live playback token so callers can drive the live ACK channel.
 */
function parkInteractiveGhost(manager: GameManager) {
  const clock = new ManualClockSource()
  manager.setCombatClockSource(clock)
  manager.setPresentationActive(true)
  manager.setPresentationMode('interactive')
  const player = startAStage(manager)
  const port = manager.getPresentationPort()
  const hold = port.hold(port.getCurrentSession()!)!
  port.attach(hold)
  port.release(hold)
  clock.advance(COMBAT_STEP_SECONDS * 260)

  const battle = manager.getTurnBattle()
  expect(battle).not.toBeNull()
  expect(manager.getTurnTokenState()).not.toBe('IDLE')
  const token = manager.getPendingPlaybackToken()
  expect(token).not.toBeNull()
  expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])
  return { player, battle: battle!, token: token!, clock }
}

/** Releases the current session's hold so isBlocking() flips false. */
function releaseCurrentSessionHold(manager: GameManager) {
  const port = manager.getPresentationPort()
  const session = port.getCurrentSession()
  expect(session).not.toBeNull()
  const hold = port.hold(session!)!
  port.attach(hold)
  port.release(hold)
}

/**
 * Queue-capture setTimeout replacement. Armed callbacks land in `queue` in
 * insertion order and are NEVER invoked automatically - the test invokes
 * them by index. clearTimeout is a no-op so a captured callback stays
 * invocable, modelling the uncancellable queued-task edge.
 */
function stubTimersToQueue() {
  const queue: Array<{ id: number; cb: () => void; ms: number }> = []
  let seq = 0
  vi.stubGlobal(
    'setTimeout',
    ((cb: () => void, ms: number) => {
      const id = ++seq
      queue.push({ id, cb, ms })
      return id
    }) as unknown as typeof setTimeout,
  )
  vi.stubGlobal('clearTimeout', (() => undefined) as unknown as typeof clearTimeout)
  return queue
}

/** Ops-private step bookkeeping surfaces (QA probe internals). */
function stepInternals(manager: GameManager) {
  return manager.turnBattleOps as unknown as {
    pendingStepDone: Record<string, (() => void) | undefined>
    pendingStepTimers: Array<unknown>
    pendingStepGeneration: number
    turnBattle: { state: string } | null
    combatClock: { getState(): string }
    restartTurnBattleCycle(): void
    settleStep(signal: 'ready' | 'impact' | 'complete'): void
    presentationOps: { session: { isBlocking(): boolean } }
  }
}

/** Live view of the runtime's pending playback phases (non-mutating). */
function runtimeInternals(manager: GameManager) {
  return (
    manager.turnBattleOps as unknown as {
      presentationOps: {
        runtime: {
          pendingReadyActor: unknown
          pendingDeclaredAction: unknown
          pendingImpact: unknown
        }
      }
    }
  ).presentationOps.runtime
}

/** A second wave-less enemy for the synchronous 'fresh'-policy swap. */
function secondEnemy() {
  return defineEnemy({
    id: 'fixture_enemy_2',
    name: 'Fixture Dummy 2',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) Freeze-reason census: owner-scope classification of the step-7 carry.
// ----------------------------------------------------------------------------

describe('r37 COR - A: freeze-reason census vs the step-7 carry', () => {
  it("A1 mid-turn swap: 'user-pause' drops, session-scoped reasons carry, 'turn-in-flight' cleared by token reset, 'not-revealed' re-derives", () => {
    const manager = registeredManager()
    const { player } = parkInteractiveGhost(manager)

    // All five producers latched at once: token claim gave 'turn-in-flight';
    // freeze the remaining admin + user + pipeline latches verbatim.
    manager.freezeCombat('authority-pause')
    manager.freezeCombat('tab-hidden')
    manager.freezeCombat('user-pause')
    expect(manager.getFreezeReasons()).toEqual([
      'turn-in-flight',
      'authority-pause',
      'tab-hidden',
      'user-pause',
    ])

    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())

    const carried = manager.getFreezeReasons()
    // The only battle-scoped owner dropped. Session-scoped latches carried.
    // 'turn-in-flight' never enters the snapshot (turnToken.reset() -> IDLE
    // -> resume fires inside clearCycleEntryState, before the step-7 read).
    expect(carried).toContain('authority-pause')
    expect(carried).toContain('tab-hidden')
    expect(carried).not.toContain('user-pause')
    expect(carried).not.toContain('turn-in-flight')
    expect(manager.getTurnTokenState()).toBe('IDLE')
    // The fresh session is held => blocking => 'not-revealed' re-derived.
    expect(carried).toContain('not-revealed')

    // Releasing the hold drops the re-derived latch; the carried pair stays.
    releaseCurrentSessionHold(manager)
    expect(manager.getFreezeReasons()).toEqual(
      expect.arrayContaining(['authority-pause', 'tab-hidden']),
    )
    expect(manager.getFreezeReasons()).not.toContain('not-revealed')

    // And the carried latches really are latched: the new battle does not
    // advance until they are resumed.
    manager.resumeCombat('authority-pause')
    manager.resumeCombat('tab-hidden')
    expect(manager.getFreezeReasons()).toEqual([])
    manager.discardStaleBattle()
  })

  it("A2a restart strips even a FOREIGN 'turn-in-flight': token.reset() emits unconditionally, the by-name resume scrubs it before the snapshot", () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager)

    // Foreign latch: the token is IDLE and nothing claims it. The carry
    // still cannot receive it - turnToken.reset() -> setState('IDLE') ->
    // listener fires resume('turn-in-flight') on EVERY reset (TurnToken
    // emits unconditionally, no change check), deleting the reason by name
    // on the old clock before step 7 reads the set.
    manager.freezeCombat('turn-in-flight')
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')

    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())

    expect(manager.getFreezeReasons()).not.toContain('turn-in-flight')
    expect(manager.getTurnTokenState()).toBe('IDLE')
    releaseCurrentSessionHold(manager)
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')
    manager.discardStaleBattle()
  })

  it("A2b swap strips a FOREIGN 'turn-in-flight' (r37-COR-4 fixed): an IDLE-token latch is incoherent and dies at the re-freeze", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager)
    manager.resumeCombat('not-revealed')

    // Foreign latch: freezeCombat is public and does not distinguish owner
    // latches from foreign ones, but the swap's re-freeze now skips
    // 'turn-in-flight' when the token is IDLE (no transition could ever
    // resume it).
    manager.freezeCombat('turn-in-flight')
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])

    const newSource = new ManualClockSource()
    manager.setCombatClockSource(newSource)

    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('running')

    // The clock is free again: steps land and the token eventually claims
    // (which re-derives 'turn-in-flight' coherently on the new instance).
    newSource.advance(COMBAT_STEP_SECONDS * 500)
    expect(manager.getElapsedCombatSteps()).toBeGreaterThan(0)
    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (B) Cycle-epoch coverage: every teardown funnel bumps pendingStepGeneration.
// ----------------------------------------------------------------------------

describe('r37 COR - B: epoch-guard coverage enumeration', () => {
  it('B1 all four wipe paths bump the generation: same-battle re-pipeline, abandon, discard, restart', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    startAStage(manager, { repeatContinuously: true })
    releaseCurrentSessionHold(manager)
    const ops = stepInternals(manager)

    const gen0 = ops.pendingStepGeneration

    // Same-battle re-pipeline: a second claim calls beginTurnPipeline ->
    // clearPendingSteps -> bump. Drive it publicly: let the first turn
    // park, resolve its three steps through the wall-clock fallback, then
    // advance to the next claim.
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    const genClaim1 = ops.pendingStepGeneration
    expect(genClaim1).toBeGreaterThan(gen0)
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 12 + 100)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    expect(ops.pendingStepGeneration).toBeGreaterThan(genClaim1)

    // abandonBattle -> clearCycleEntryState -> bump.
    const genBeforeAbandon = ops.pendingStepGeneration
    manager.abandonBattle()
    expect(ops.pendingStepGeneration).toBeGreaterThan(genBeforeAbandon)

    // discardStaleBattle -> discardInFlightBattle -> clearCycleEntryState.
    const genBeforeDiscard = ops.pendingStepGeneration
    manager.discardStaleBattle()
    expect(ops.pendingStepGeneration).toBeGreaterThan(genBeforeDiscard)

    // restartTurnBattleCycle (repeat) -> beginBattleCycleCommitted ->
    // clearCycleEntryState.
    startAStage(manager, { repeatContinuously: true })
    manager.resumeCombat('not-revealed')
    const genBeforeRestart = ops.pendingStepGeneration
    ops.turnBattle!.state = 'victory'
    ops.restartTurnBattleCycle()
    expect(ops.pendingStepGeneration).toBeGreaterThan(genBeforeRestart)
    manager.discardStaleBattle()
  })

  it('B2 abandonBattle emits AFTER teardown (r37-COR-3 fixed): a synchronous battle-start inside battle_end survives and owns the clock', () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player = startAStage(manager)
    const abandoned = manager.getTurnBattle()!

    // emitAbandonEnd now runs after clearCycleEntryState + combatClock
    // .stop() - a subscriber mint inside the emit lands on a clean slate
    // and is NOT torn down by the abandoned battle's tail.
    manager.eventBus.on('battle_end', () => {
      manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    })

    manager.abandonBattle()

    const aftermath = manager.getTurnBattle()
    expect(aftermath).not.toBeNull()
    expect(aftermath).not.toBe(abandoned)
    expect(manager.getCombatClockState()).not.toBe('stopped')
    // The re-minted cycle is live: combat steps land on it (until its own
    // turn claim freezes the clock on 'turn-in-flight').
    clock.advance(COMBAT_STEP_SECONDS * 500)
    expect(manager.getElapsedCombatSteps()).toBeGreaterThan(0)
    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) pendingStepTimers "live handles only" invariant (r37-COR-1 evidence).
// ----------------------------------------------------------------------------

describe('r37 COR - C: pendingStepTimers residual writers', () => {
  it('C1 admin-latch re-arm swaps the exact fired handle (identity pin, N re-arms)', () => {
    const manager = registeredManager()
    const timers = stubTimersToQueue()
    parkInteractiveGhost(manager)
    const ops = stepInternals(manager)
    expect(ops.pendingStepTimers.length).toBe(1)

    manager.freezeCombat('authority-pause')
    // Each fire splices its OWN just-fired handle and pushes the re-arm:
    // [id0] -> fire id0 -> [id1] -> fire id1 -> [id2]. Exact identity, not
    // just length.
    const first = timers[timers.length - 1]!
    first.cb()
    expect(ops.pendingStepTimers).toEqual([timers[timers.length - 1]!.id])
    const second = timers[timers.length - 1]!
    second.cb()
    expect(ops.pendingStepTimers).toEqual([timers[timers.length - 1]!.id])
    manager.discardStaleBattle()
  })

  it('C2 settle path splices the cleared handle (r37-COR-1 fixed): the array holds live timers only', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)
    const ops = stepInternals(manager)
    expect(ops.pendingStepTimers.length).toBe(1)

    // ACK-channel settle: parkedDone clearTimeout()s AND splices the
    // handle - nothing dead is left behind.
    ops.settleStep('ready')
    expect(ops.pendingStepDone['ready']).toBeUndefined()
    // The pipeline parked the next step: only its live handle remains.
    expect(ops.pendingStepTimers.length).toBe(1)
    manager.discardStaleBattle()
  })

  it('C3 isBlocking deferral re-arm splices the fired handle too (r37-COR-1 fixed): flat like the admin arm', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)
    const ops = stepInternals(manager)
    const armed = ops.pendingStepTimers.length
    expect(armed).toBe(1)

    // Force the deferral arm: session reports blocking while the only latch
    // is the pipeline-exempt 'turn-in-flight'.
    vi.spyOn(ops.presentationOps.session, 'isBlocking').mockReturnValue(true)

    // Two fires: each splices the just-fired handle before pushing the
    // re-arm - the array stays flat.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 2 + 100)
    expect(ops.pendingStepTimers.length).toBe(armed)

    // The bound: deferredMs hits AWAIT_STEP_DEFERRAL_CAP_MS (32000) and the
    // arm force-drains instead of growing forever - the leak is capped at
    // ~8 dead handles per parked step and wiped by the next
    // clearPendingSteps.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 8)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("blocked"),
    )
    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (D) setCombatClockSource preservation: token claim + latch coherence.
// ----------------------------------------------------------------------------

describe('r37 COR - D: source-swap latch preservation', () => {
  it("D1 mid-turn swap keeps the claimed token and 'turn-in-flight' coherent - the rebound listener unlatches the NEW clock at turn end", () => {
    const manager = registeredManager()
    const { token } = parkInteractiveGhost(manager)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])

    const newSource = new ManualClockSource()
    manager.setCombatClockSource(newSource)

    // Same battle, same claim: 'turn-in-flight' carried verbatim; the token
    // listener re-bound without re-claiming.
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    expect(manager.getPendingPlaybackToken()).toBe(token)

    // The ACK channel still drains on the surviving token claim.
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')

    // Rebind coherence: the IDLE transition fired resume('turn-in-flight')
    // on the NEW clock instance - the latch released and steps land on the
    // new source.
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')
    newSource.advance(COMBAT_STEP_SECONDS * 10)
    expect(manager.getElapsedCombatSteps()).toBeGreaterThan(0)
    manager.discardStaleBattle()
  })

  it("D2 'stopped' clock is not restarted and carries nothing - stop() already emptied the reason set", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager)
    manager.discardStaleBattle()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])

    manager.setCombatClockSource(new ManualClockSource())
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
  })

  it('D3 re-freeze order is the snapshot insertion order (verbatim Set semantics)', () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.resumeCombat('not-revealed')

    manager.freezeCombat('user-pause')
    manager.freezeCombat('authority-pause')
    manager.freezeCombat('tab-hidden')
    expect(manager.getFreezeReasons()).toEqual([
      'user-pause',
      'authority-pause',
      'tab-hidden',
    ])

    manager.setCombatClockSource(new ManualClockSource())
    expect(manager.getFreezeReasons()).toEqual([
      'user-pause',
      'authority-pause',
      'tab-hidden',
    ])
    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (E) Curtain-watch data contract: teardown clears 'tab-hidden' synchronously.
// ----------------------------------------------------------------------------

describe('r37 COR - E: curtain-watch input is always satisfied by teardown', () => {
  it("E1 abandonBattle clears 'tab-hidden' synchronously (clock stop empties the reason set)", () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.resumeCombat('not-revealed')
    manager.freezeCombat('tab-hidden')
    expect(manager.getFreezeReasons()).toContain('tab-hidden')

    manager.abandonBattle()
    // The App.vue stateVersion watch reads getFreezeReasons() - the data
    // side is consistent immediately; only the flag clear waits one bump.
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('stopped')
    manager.discardStaleBattle()
  })

  it("E2 discardStaleBattle clears 'tab-hidden' synchronously (session-replacement teardown)", () => {
    const manager = registeredManager()
    manager.setCombatClockSource(new ManualClockSource())
    startAStage(manager)
    manager.resumeCombat('not-revealed')
    manager.freezeCombat('tab-hidden')

    manager.discardStaleBattle()
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('stopped')
  })
})

// ----------------------------------------------------------------------------
// (F) r36-AUT-1 bounds: the ACK channel cannot exceed the residual, cannot
//     land on a different owner, cannot survive a discard.
// ----------------------------------------------------------------------------

describe('r37 COR - F: renderer-ACK drain bounds', () => {
  it('F1 residual bound: a replayed ACK after the turn resolved is a silent reject (no re-claim, no re-mint)', () => {
    const manager = registeredManager()
    const { token } = parkInteractiveGhost(manager)

    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(runtimeInternals(manager).pendingReadyActor).toBeNull()
    expect(runtimeInternals(manager).pendingDeclaredAction).toBeNull()
    expect(runtimeInternals(manager).pendingImpact).toBeNull()

    // The drain already consumed every phase. A replayed ACK of the same
    // token finds nothing pending and dies silently - the channel cannot
    // exceed the in-flight turn's residual.
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(runtimeInternals(manager).pendingReadyActor).toBeNull()
    expect(runtimeInternals(manager).pendingImpact).toBeNull()
    manager.discardStaleBattle()
  })

  it('F2 owner bound: a stale token cannot land on the NEXT cycle minted after a discard', () => {
    const manager = registeredManager()
    const { token: staleToken } = parkInteractiveGhost(manager)

    manager.discardStaleBattle()
    expect(manager.getPendingPlaybackToken()).toBeNull()

    // A new owner mints a fresh cycle and its own token.
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    const liveToken = manager.getPendingPlaybackToken()
    expect(liveToken).not.toBeNull()
    expect(liveToken).not.toBe(staleToken)
    expect(runtimeInternals(manager).pendingReadyActor).not.toBeNull()

    // The stale token is rejected; the pending phase survives untouched.
    manager.acknowledgeTurnReady(staleToken)
    expect(runtimeInternals(manager).pendingReadyActor).not.toBeNull()
    expect(runtimeInternals(manager).pendingDeclaredAction).toBeNull()

    // The live token still drains the live pending.
    manager.acknowledgeTurnReady(liveToken!)
    expect(runtimeInternals(manager).pendingDeclaredAction).not.toBeNull()
    manager.discardStaleBattle()
  })

  it('F3 discard bound: an ACK fired after discardStaleBattle cannot mint - pending state and token are wiped', () => {
    const manager = registeredManager()
    const { token } = parkInteractiveGhost(manager)
    expect(runtimeInternals(manager).pendingReadyActor).not.toBeNull()

    manager.discardStaleBattle()
    expect(manager.getPendingPlaybackToken()).toBeNull()
    expect(runtimeInternals(manager).pendingReadyActor).toBeNull()

    // The token string survives in the caller, but the runtime token is ''
    // and every pending phase is null - the ACK rejects on both gates.
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(runtimeInternals(manager).pendingDeclaredAction).toBeNull()
    expect(manager.getTurnBattle()).toBeNull()
  })
})
