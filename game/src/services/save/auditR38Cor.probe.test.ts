// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { defineEnemy } from '../../core/enemy/Enemy'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { useCombatPause } from '../../composables/useCombatPause'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r38 COR wave. Blind correctness audit of the r37
// adjudication at de4c4fb4 (code commit 9881bc0b). Attack map:
//
//   (A) r38-COR-1 - F6 isCombatActive gate. The reported zombie is a KEPT
//       battle + frozen clock (the boot-fail/rejected-restore arms return
//       BEFORE discardStaleBattle, so turnBattle stays non-null), and the
//       battle-less frozen shape is unreachable (every discard also stops
//       the clock; freeze() no-ops on 'stopped'). FIXED at r38: the gate
//       moved to the discriminator the zombie actually lacks - entryStage
//       'game' (the fail arm lands on 'error').
//   (B) r38-COR-2 - boundaryQueue FIFO vs inline-immediate asymmetry.
//       enqueueAtTurnBoundary runs a command synchronously on IDLE while an
//       earlier queued command is still pending its fighting-branch drain:
//       a later toggle lands BEFORE the queued earlier one.
//   (C) r38-COR-3 - live-handles asymmetry: the fallback's drive arm and
//       dead-battle drop leave the just-fired handle in pendingStepTimers;
//       the settle arm and both re-arm arms splice it. Bounded residue.
//   (D) r38-COR-4 - the OTHER emitAbandonEnd site (beginBattleCycle
//       pre-commit, ~:1854) retains the re-mint-during-emit class F3 moved
//       past in abandonBattle: a nested mint is orphaned by the outer mint,
//       and clearCycleEntryState never touches enemyManager, so the nested
//       battle's spawned enemies leak.
//   (E) r38-COR-5 - step-7 latch replay (~:2167) carries reasons verbatim:
//       'turn-in-flight' can only arrive via a foreign plant inside the
//       synchronous window (the presentation_session_started emit sits
//       between token.reset() and the snapshot) - same class as F4, one
//       narrow seam.
//   (F) r38-COR-6 - drainBoundaryQueueIfIdle runs queued commands bare: a
//       throwing foreign command aborts the rest of the drained batch (the
//       queue is already emptied, so trailing commands are lost silently;
//       pendingManualMode self-heals at the next dropBoundaryQueue).
//   (G) Acceptance evidence for the claims that verified clean: emit-after-
//       teardown ordering (F3), same-generation settled-check (F2), the
//       IDLE-token 'turn-in-flight' strip (F4), pendingManualMode re-land
//       (F5), and the r37-COR-5 curtain bound.
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

/** Parked 'ready' step under a released interactive session (not blocking). */
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

function releaseCurrentSessionHold(manager: GameManager) {
  const port = manager.getPresentationPort()
  const session = port.getCurrentSession()
  expect(session).not.toBeNull()
  const hold = port.hold(session!)!
  port.attach(hold)
  port.release(hold)
}

/**
 * Queue-capture setTimeout replacement: armed callbacks land in `queue` and
 * are never auto-invoked; the test fires them by index. clearTimeout removes
 * the handle but the captured callback stays invocable - the real
 * uncancellable queued-task edge.
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

function opsInternals(manager: GameManager) {
  return manager.turnBattleOps as unknown as {
    pendingStepDone: Record<string, (() => void) | undefined>
    pendingStepTimers: Array<unknown>
    pendingStepGeneration: number
    boundaryQueue: Array<() => void>
    pendingManualMode: boolean | null
  }
}

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
    rewards: { techniqueMastery:0, spiritStone: 0 },
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
// (A) r38-COR-1 (Medium) - the F6 gate does not exclude the zombie it was
//     written for. The reported zombie shape is KEPT battle + frozen clock
//     (fail arms return before any discard), and the gate's added predicate
//     is exactly what that shape still satisfies. The battle-less frozen
//     shape the gate does exclude cannot be produced: every discard also
//     stops the clock, and freeze() is a no-op on 'stopped'.
// ----------------------------------------------------------------------------

describe('r38 COR - A: isCombatActive gates on the admitted route, not battle presence (r38 fix)', () => {
  it('the kept-battle zombie fails the game-stage clause - the curtain never arms over the error surface', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)

    // Boot-fail zombie shape verbatim: pauseSimulation latched
    // 'authority-pause'; the fail arm returned before discardStaleBattle,
    // so the battle object is kept and the clock stays frozen - and the
    // entry stage is 'error', which is the clause that now carries the
    // discrimination.
    manager.freezeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getTurnBattle()).not.toBeNull()

    // The post-r38 App.vue wiring: entryStage is the App-side route
    // admission signal the zombie lacks.
    let entryStage: 'game' | 'error' = 'error'
    const isCombatActive = () =>
      entryStage === 'game' && manager.getCombatClockState() !== 'stopped'

    expect(isCombatActive()).toBe(false)

    // End-to-end through the real composable: a hidden tab on the error
    // surface arms nothing.
    const handlers = new Map<string, () => void>()
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: (type: string, fn: () => void) => handlers.set(type, fn),
      removeEventListener: () => undefined,
    })
    const pause = useCombatPause(manager, { isCombatActive })
    handlers.get('visibilitychange')!()
    expect(pause.isPaused.value).toBe(false)
    expect(manager.getFreezeReasons()).not.toContain('tab-hidden')

    // Control: the SAME frozen parked battle on the admitted 'game' route
    // still arms - the stage, not the battle, is the discriminator.
    entryStage = 'game'
    handlers.get('visibilitychange')!()
    expect(pause.isPaused.value).toBe(true)
    expect(manager.getFreezeReasons()).toContain('tab-hidden')
    pause.dispose()

    manager.resumeCombat('tab-hidden')
    manager.resumeCombat('authority-pause')
    manager.abandonBattle()
  })

  it('control: the battle-less frozen shape the gate guards is unreachable - discard stops the clock and freeze is a no-op on stopped', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)

    // discardStaleBattle is the only path to a battle-less world - and it
    // stops the clock in the same synchronous block as the null-out.
    manager.discardStaleBattle()
    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])

    // No caller can manufacture battle-less + frozen: freeze() no-ops on
    // 'stopped', and the only combatClock.start() sites are inside the
    // committed mint (same synchronous block as the battle assignment).
    manager.freezeCombat('authority-pause')
    manager.freezeCombat('turn-in-flight')
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
  })
})

// ----------------------------------------------------------------------------
// (B) r38-COR-2 (Low) - queued intents are not arrival-ordered: a command
//     arriving in the IDLE window between a queued command's push and its
//     fighting-branch drain runs synchronously, so the queued earlier intent
//     lands LAST. For setBattleManualMode the landed value is the opposite
//     of the last user intent, and the flag is session-scoped (it survives
//     the rest of the battle and into the next claim-time read).
// ----------------------------------------------------------------------------

describe('r38 COR - B: IDLE-window commands preserve FIFO behind a pending queue (r38 fix)', () => {
  it('toggle ON queued mid-turn, toggle OFF queues behind it at IDLE - last intent lands last', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token, clock } = parkInteractiveGhost(manager)
    const internals = opsInternals(manager)

    // Mid-turn (RESOLVING): the first toggle queues, flag unchanged.
    manager.setBattleManualMode(true)
    expect(manager.isBattleManualMode()).toBe(false)
    expect(internals.boundaryQueue.length).toBe(1)
    expect(internals.pendingManualMode).toBe(true)

    // Resolve the turn non-terminally: token returns to IDLE while the
    // queued intent still waits for the next fighting-step drain.
    battle.enemies[0]!.entity.currentHp = 1_000_000
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(battle.state).toBe('fighting')
    expect(internals.boundaryQueue.length).toBe(1)

    // The second toggle arrives while the queue is still pending: the
    // IDLE-token branch now requires an EMPTY queue, so it queues behind.
    manager.setBattleManualMode(false)
    expect(manager.isBattleManualMode()).toBe(false)
    expect(internals.pendingManualMode).toBe(false)
    expect(internals.boundaryQueue.length).toBe(2)

    // Next fighting step drains FIFO: ON lands, then OFF - the landed
    // flag matches the user's LAST action.
    clock.advance(COMBAT_STEP_SECONDS)
    expect(manager.isBattleManualMode()).toBe(false)
    expect(internals.pendingManualMode).toBeNull()
    expect(internals.boundaryQueue.length).toBe(0)

    manager.abandonBattle()
  })

  it('order is preserved only when no IDLE window intervenes: two queued toggles drain FIFO', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token, clock } = parkInteractiveGhost(manager)

    manager.setBattleManualMode(true)
    manager.setBattleManualMode(false)
    battle.enemies[0]!.entity.currentHp = 1_000_000
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)

    clock.advance(COMBAT_STEP_SECONDS)
    // FIFO drain: true then false -> last intent wins.
    expect(manager.isBattleManualMode()).toBe(false)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) r38-COR-3 (Nit) - the live-handles fix leaves two asymmetric arms:
//     a fallback that takes the drive path (or the dead-battle drop) never
//     splices its just-fired handle out of pendingStepTimers. Bounded to
//     <= 3 dead handles per epoch (one per signal), wiped by the next
//     clearPendingSteps - no functional wedge, but the "live timers only"
//     invariant is only true on the splice-covered paths.
// ----------------------------------------------------------------------------

describe('r38 COR - C: the drive arm leaves the fired handle resident', () => {
  it('a fired fallback that drives the step splices its handle - the array stays flat (r38 fix)', () => {
    const manager = registeredManager()
    const timers = stubTimersToQueue()
    parkInteractiveGhost(manager)

    const internals = opsInternals(manager)
    expect(internals.pendingStepTimers.length).toBe(1)
    expect(typeof internals.pendingStepDone['ready']).toBe('function')

    // Fire the parked 'ready' fallback: the hoisted splice retires the
    // just-fired handle before the drive arm runs, so only the freshly
    // armed 'impact' handle is resident afterwards.
    timers[timers.length - 1]!.cb()

    // The work actually landed (declare minted through the live channel).
    expect(internals.pendingStepDone['ready']).toBeUndefined()
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)

    // Flat array: exactly the new live 'impact' handle.
    expect(internals.pendingStepTimers.length).toBe(1)
    expect(internals.pendingStepTimers[0]).toBe(timers[1]!.id)
    expect(typeof internals.pendingStepDone['impact']).toBe('function')

    // Same on 'impact': the drive fires, its handle is retired, the next
    // arm owns the single resident slot.
    timers[timers.length - 1]!.cb()
    expect(internals.pendingStepTimers.length).toBe(1)

    manager.abandonBattle()
  })

  it('control: the settle arm splices - an ACK-settled step leaves the array flat', () => {
    const manager = registeredManager()
    stubTimersToQueue()
    parkInteractiveGhost(manager)

    const internals = opsInternals(manager)
    const token = manager.getPendingPlaybackToken()!
    manager.acknowledgeTurnReady(token)

    // 'ready' settled via the ACK channel: fired handle spliced, the newly
    // armed 'impact' handle is the only resident.
    expect(internals.pendingStepTimers.length).toBe(1)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (D) r38-COR-4 (Low) - beginBattleCycle's pre-commit emitAbandonEnd (~:1854)
//     still fires on the pre-teardown world: the outgoing battle's reference
//     is live and committed has not run yet. A battle_end listener that mints
//     a new battle inside the emit completes a full nested cycle; the outer
//     committed block then overwrites the battle reference WITHOUT clearing
//     enemyManager, so the nested mint's spawned enemies leak (here, a
//     duplicate-id entry that shadows the live battle's enemy).
// ----------------------------------------------------------------------------

describe('r38 COR - D: the committed mint clears the enemy registry (r38 fix)', () => {
  it('a nested mint inside the emit still leaks nothing - the outer clear sweeps its spawned enemy', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { player } = parkInteractiveGhost(manager)

    let reminted = false
    manager.eventBus.on('battle_end', () => {
      if (reminted) return
      reminted = true
      // Foreign re-mint while the outer beginBattleCycle is mid-emit: the
      // nested committed block runs a full cycle and mints battle A.
      manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    })

    // Mid-fight replace: pre-commit terminalizes the parked battle and emits
    // before teardown - the listener mints inside that emit.
    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    expect(reminted).toBe(true)

    // The live battle is the OUTER mint and references exactly one enemy.
    const live = manager.getTurnBattle()!
    expect(live.enemies).toHaveLength(1)

    // r38 fix: beginBattleCycleCommitted step 1 clears enemyManager, so the
    // nested mint's spawn was swept before the outer spawn - the registry
    // holds exactly the live battle's enemy (every prior entry swept too).
    const all = manager.enemyManager.getAll()
    expect(all.length).toBe(1)
    expect(all[0]!.id).toBe(live.enemies[0]!.entity.id)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (E) r38-COR-5 (Low) - the step-7 latch replay carries every non-user-pause
//     reason verbatim; the r37-COR-4 IDLE-token strip exists only on the
//     setCombatClockSource path. token.reset()'s unconditional emit normally
//     clears 'turn-in-flight' before the snapshot - the remaining window is
//     the synchronous presentation_session_started emit inside the same
//     committed block. A foreign 'turn-in-flight' planted there is carried
//     onto the new clock and wedges the fresh battle permanently (the token
//     listener only clears it on a transition that can never start).
// ----------------------------------------------------------------------------

describe('r38 COR - E: a mid-cycle foreign turn-in-flight can no longer ride the step-7 replay', () => {
  it('a turn-in-flight planted inside presentation_session_started is stripped - the fresh battle runs', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')

    // Foreign plant inside the synchronous mint window - the same listener
    // seam the r37-B probe used for 'user-pause' (which IS filtered).
    manager.eventBus.on('presentation_session_started', () => {
      manager.freezeCombat('turn-in-flight')
    })

    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())

    // r38 fix: the step-7 replay strips 'turn-in-flight' on an IDLE token
    // (the same predicate the source-swap arm already uses) - the plant
    // died with the old battle's snapshot.
    expect(manager.getFreezeReasons()).not.toContain('turn-in-flight')

    // Release the new session's own 'not-revealed' latch: the fresh clock
    // runs clean - no foreign carry.
    releaseCurrentSessionHold(manager)
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')

    // The battle lives: the same 260-step window the wedge proved dead now
    // claims the turn pipeline - token parks at 'ready' on a real pending
    // playback, and the ACK chain completes the turn.
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    const liveToken = manager.getPendingPlaybackToken()!
    manager.acknowledgeTurnReady(liveToken)
    manager.acknowledgeActionImpact(liveToken)
    manager.acknowledgeActionComplete(liveToken)
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBeGreaterThan(0)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (F) r38-COR-6 (Nit) - drainBoundaryQueueIfIdle empties the queue before
//     running its commands, with no guard around each command(): a throwing
//     command drops the rest of the batch silently. The pendingManualMode
//     slot stays armed and self-heals at the next dropBoundaryQueue. Only
//     manual-mode closures enqueue today (they cannot throw); the exposure
//     is the public enqueueAtTurnBoundary seam for future commands.
// ----------------------------------------------------------------------------

describe('r38 COR - F: a throwing boundary command no longer drops the drain batch (r38 fix)', () => {
  it('the queued manual intent behind a throwing command lands in the same drain', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token, clock } = parkInteractiveGhost(manager)
    const internals = opsInternals(manager)

    // Queue order: [throwing foreign command, manual toggle].
    manager.enqueueAtTurnBoundary(() => {
      throw new Error('foreign boundary command')
    })
    manager.setBattleManualMode(true)
    expect(internals.boundaryQueue.length).toBe(2)

    battle.enemies[0]!.entity.currentHp = 1_000_000
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')

    // r38 fix: the drain catches per-command - the throw is logged and
    // the manual intent behind it still lands in the same batch.
    clock.advance(COMBAT_STEP_SECONDS)
    expect(manager.isBattleManualMode()).toBe(true)
    expect(internals.boundaryQueue.length).toBe(0)
    expect(internals.pendingManualMode).toBeNull()

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (G) Acceptance evidence - the r37 claims that verified clean.
// ----------------------------------------------------------------------------

describe('r38 COR - G: verified-correct pins', () => {
  it('F3: battle_end fires AFTER teardown in abandonBattle - a listener sees a stopped clock + terminal battle', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)

    const seen = { clockState: '', battleState: '' as string | null }
    manager.eventBus.on('battle_end', () => {
      seen.clockState = manager.getCombatClockState()
      seen.battleState = manager.getTurnBattle()?.state ?? 'null'
    })

    manager.abandonBattle()

    expect(seen.clockState).toBe('stopped')
    expect(seen.battleState).toBe('defeat')
    expect(manager.getFreezeReasons()).toEqual([])
  })

  it('F2: a stale same-generation fallback after the real settle is a clean no-op (no re-arm, no residue)', () => {
    const manager = registeredManager()
    const timers = stubTimersToQueue()
    parkInteractiveGhost(manager)

    const internals = opsInternals(manager)
    const staleReadyCb = timers[0]!.cb
    const token = manager.getPendingPlaybackToken()!

    manager.acknowledgeTurnReady(token)
    expect(internals.pendingStepDone['ready']).toBeUndefined()
    expect(typeof internals.pendingStepDone['impact']).toBe('function')
    const timersAfterSettle = internals.pendingStepTimers.length

    // Uncancellable queued task fires inside the same epoch: the ===
    // undefined guard bails before the admin-latch arm can re-arm.
    staleReadyCb()
    staleReadyCb()

    expect(internals.pendingStepDone['ready']).toBeUndefined()
    expect(typeof internals.pendingStepDone['impact']).toBe('function')
    expect(internals.pendingStepTimers.length).toBe(timersAfterSettle)
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)

    manager.abandonBattle()
  })

  it('F4: a foreign turn-in-flight on an IDLE token is stripped on source swap; the token-owned latch carries', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token } = parkInteractiveGhost(manager)

    // Resolve the turn: token IDLE, its own latch already resumed away.
    battle.enemies[0]!.entity.currentHp = 1_000_000
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getFreezeReasons()).toEqual([])

    // Foreign plant on the IDLE token: r39 adjudication - refused at the
    // latch (token not holding), so the swap strip is backstop.
    manager.freezeCombat('turn-in-flight')
    expect(manager.getFreezeReasons()).toEqual([])
    const next = new ManualClockSource()
    manager.setCombatClockSource(next)
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')
    next.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).not.toBe('IDLE') // the battle lives

    manager.abandonBattle()
  })

  it('F5: a mid-turn toggle whose battle ends undrained still re-lands on the session flag', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token } = parkInteractiveGhost(manager)

    manager.setBattleManualMode(true)
    expect(manager.isBattleManualMode()).toBe(false)

    battle.enemies[0]!.entity.currentHp = 1
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(battle.state).toBe('victory')

    // dropBoundaryQueue at COMBAT_OVER re-landed the pending intent.
    expect(manager.isBattleManualMode()).toBe(true)

    manager.abandonBattle()
  })

  it('r37-COR-5 bound: a tab-hidden latch armed on the zombie still dies with the battle teardown', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)
    manager.freezeCombat('authority-pause')

    const isCombatActive = () =>
      manager.getCombatClockState() !== 'stopped' && manager.getTurnBattle() !== null
    const handlers = new Map<string, () => void>()
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: (type: string, fn: () => void) => handlers.set(type, fn),
      removeEventListener: () => undefined,
    })
    const pause = useCombatPause(manager, { isCombatActive })
    handlers.get('visibilitychange')!()
    expect(pause.isPaused.value).toBe(true)
    expect(manager.getFreezeReasons()).toContain('tab-hidden')

    // Bound: the armed curtain's own latch cannot outlive the battle - the
    // teardown stop() clears 'tab-hidden', so the stateVersion watch clears
    // isPaused on the next bump (the accepted bump-starved window is the
    // only residual, and it stays cosmetic). The pinned isCombatActive
    // shape below is the admitted-route equivalent of this test's zombie.
    // (Post-r38 the real gate also requires entryStage 'game' - kept out
    // here because this pin documents the latch's own teardown bound.)
    manager.abandonBattle()
    expect(manager.getFreezeReasons()).not.toContain('tab-hidden')
    pause.dispose()
  })
})
