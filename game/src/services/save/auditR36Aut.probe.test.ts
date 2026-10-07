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
// QA probe - fixpoint r36 AUT wave. Blind adversarial audit of the r35
// adjudication at bb7bc574:
//
//   (A) The r35-AUT-1 administrative gate covers ONLY the wall-clock
//       fallback channel. The live renderer-ACK channel
//       (CombatAnimationRuntime.acknowledgeTurnReady/ActionImpact/
//       ActionComplete, driven by Phaser tween callbacks in CombatScene /
//       SkillPresentationRunner) consults deps.isSessionBlocking() and the
//       playbackToken alone - it NEVER consults
//       combatClock.getFreezeReasons(). Under 'authority-pause' /
//       'user-pause' with a released interactive session, the whole parked
//       turn resolves - including the terminal settlement mint (kill ->
//       victory -> grantBattleRewardIfNeeded -> completedStageIds) - while
//       the administrative latch still holds.
//   (B) Generation-token staleness at the pendingStepDone map: the map is
//       keyed by signal with NO cycle binding. A fallback closure armed in
//       cycle N that fires inside cycle N+1 (a timer callback already queued
//       in the macrotask queue cannot be cancelled by clearTimeout - the
//       standard uncancellable-task edge) resolves against the NEW cycle's
//       shared map: it wipes the new parked step's settle entry
//       (pendingStepDone[signal] = undefined) and drives the new battle's
//       mechanical work early via the CURRENT pending token.
//   (C) Bookkeeping + rejection controls: pendingStepTimers grows one entry
//       per re-arm while administratively parked (Nit evidence); the
//       'turn-in-flight' reason cannot survive into the beginBattleCycle
//       step-7 latch snapshot (rejection pin - clearCycleEntryState ->
//       turnToken.reset() -> IDLE -> resume fires before the snapshot).
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

/**
 * Releases the hold minted for the current interactive session so
 * isBlocking() flips false (the leave-combat-route recipe: hold+attach then
 * release on the fresh hold).
 */
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
 * them by index. clearTimeout removes the handle from the live set but the
 * captured callback is kept invocable, modelling the real uncancellable
 * queued-task edge: a timer callback already dequeued into the engine's task
 * queue ignores a later clearTimeout.
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

/** Read the ops-private step bookkeeping surfaces (QA probe internals). */
function stepInternals(manager: GameManager) {
  return manager.turnBattleOps as unknown as {
    pendingStepDone: Record<string, (() => void) | undefined>
    pendingStepTimers: Array<unknown>
  }
}

/**
 * Read the presentation runtime's pending playback phases. This is the
 * non-mutating way to ask "which phase is pending" - preparePresentationResume()
 * MUTATES (rotates playbackToken + rewinds pendingDeclaredAction back to
 * pendingReadyActor), which would corrupt the drain being probed.
 */
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

/**
 * A second wave-less enemy for the 'fresh'-policy cycle swap: mid-turn
 * startStage is refused by the stage-wave lease, so the legitimate
 * synchronous mid-turn swap primitive is startBattleWithPlayer ('fresh'
 * cycle policy - same beginBattleCycle -> clearCycleEntryState ->
 * clearPendingSteps path, minus the wave system).
 */
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
// (A) The administrative gate does not cover the live renderer-ACK channel.
//     A parked turn - and its terminal settlement mint - resolves under an
//     administrative latch whenever the presentation session is live.
// ----------------------------------------------------------------------------

describe('r36 AUT - A: the live ACK channel resolves turns under an administrative latch', () => {
  it('a full ACK drain completes the parked turn while authority-pause stays latched', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token } = parkInteractiveGhost(manager)
    const hpBefore = battle.enemies[0]!.entity.currentHp

    manager.freezeCombat('authority-pause')
    expect(manager.getFreezeReasons()).toEqual(
      expect.arrayContaining(['authority-pause', 'turn-in-flight']),
    )
    expect(manager.getCombatClockState()).toBe('frozen')

    // The live channel: Phaser tween callbacks keep firing while the combat
    // clock is frozen (the scene stays mounted during 'reconnecting' and
    // 'user-pause'). Fake timers are never advanced, so the r35 fallback
    // gate provably cannot run - anything that resolves here arrived
    // through acknowledge*.
    manager.acknowledgeTurnReady(token)
    expect(runtimeInternals(manager).pendingDeclaredAction).not.toBeNull()

    manager.acknowledgeActionImpact(token)
    expect(battle.enemies[0]!.entity.currentHp).toBeLessThan(hpBefore)
    expect(runtimeInternals(manager).pendingImpact).not.toBeNull()
    // The mechanical mint (damage on the enemy entity) landed while the
    // administrative latch was still latched.
    expect(manager.getFreezeReasons()).toContain('authority-pause')

    manager.acknowledgeActionComplete(token)

    expect(battle.totalTurnsElapsed).toBe(1)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    // The battle's own 'turn-in-flight' released with the resolution; the
    // administrative latch survives untouched.
    expect(manager.getFreezeReasons()).toEqual(['authority-pause'])
    expect(manager.getCombatClockState()).toBe('frozen')
  })

  it('a killing impact under authority-pause mints the terminal settlement (victory + rewards)', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { player, battle, token } = parkInteractiveGhost(manager)
    const ends: string[] = []
    manager.eventBus.on('battle_end', (e: { state: string }) => ends.push(e.state))

    battle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('authority-pause')

    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    // The impact killed the last enemy but the settlement chain (complete
    // step -> drain -> onTurnDrained -> token.resolve -> settleCombatOutcome)
    // has not run yet - 'authority-pause' is still latched.
    expect(manager.getFreezeReasons()).toContain('authority-pause')

    manager.acknowledgeActionComplete(token)

    // The whole terminal mint ran under the latch: kill rewards, stage
    // completion, battle_end, terminal state. The terminal's own
    // combatClock.stop() is what finally clears the reason set.
    expect(battle.state).toBe('victory')
    expect(player.completedStageIds).toContain('fixture_stage')
    expect(ends).toEqual(['victory'])
    expect(manager.getCombatClockState()).toBe('stopped')
  })

  it('user-pause leaks the same channel (tab-hidden is unreachable - its RAF-driven channel dies with the tab)', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token } = parkInteractiveGhost(manager)
    const hpBefore = battle.enemies[0]!.entity.currentHp

    manager.freezeCombat('user-pause')
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    expect(battle.enemies[0]!.entity.currentHp).toBeLessThan(hpBefore)
    expect(manager.getFreezeReasons()).toContain('user-pause')
  })

  it('control: the same ACK drain without a latch is the legitimate primary path', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token } = parkInteractiveGhost(manager)

    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)

    expect(battle.totalTurnsElapsed).toBe(1)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getFreezeReasons()).toEqual([])
  })
})

// ----------------------------------------------------------------------------
// (B) Stale-cycle fallback closures: the pendingStepDone map is signal-keyed
//     with no cycle binding. A queued-but-uncancellable fallback armed in the
//     old cycle resolves against the NEW battle's map and the CURRENT token.
// ----------------------------------------------------------------------------

describe('r36 AUT - B: expired fallback closures fire into the next cycle', () => {
  it('a stale-cycle fallback wipes the new parked settle and drives the new battle early', () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')

    const timers = stubTimersToQueue()

    // Cycle 1: park a turn - its 'ready' fallback arms queued[0].
    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    expect(timers.length).toBeGreaterThanOrEqual(1)
    const staleCb = timers[0]!.cb

    const starts: string[] = []
    manager.eventBus.on('turn_cast_start', (e: { actorId: string }) => starts.push(e.actorId))

    // Cycle swap: the 'fresh' policy terminalizes the old battle and
    // clearCycleEntryState clears pendingStepTimers + pendingStepDone - but
    // the already-queued callback object cannot be un-queued.
    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    expect(manager.getTurnBattle()!.state).not.toBe('victory')
    releaseCurrentSessionHold(manager)

    // Cycle 2 reaches its own parked 'ready' step: queued[last] is the NEW
    // settle's fallback; pendingStepDone['ready'] is the NEW registration.
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    expect(manager.getPendingPlaybackToken()).not.toBeNull()
    const internals = stepInternals(manager)
    expect(typeof internals.pendingStepDone['ready']).toBe('function')
    const newSettleCb = timers[timers.length - 1]!.cb
    expect(newSettleCb).not.toBe(staleCb)

    // The stale closure fires inside the new cycle (the queued-task edge):
    // it lands in the drive arm (new battle live, clock running, no admin
    // latch, session not blocking), wipes the NEW parked settle, and runs
    // the new turn's declare mechanics early via the CURRENT token.
    staleCb()

    expect(internals.pendingStepDone['ready']).toBeUndefined()
    expect(runtimeInternals(manager).pendingDeclaredAction).not.toBeNull()
    expect(starts).toHaveLength(1)

    // Bound evidence: the wiped settle is what the real renderer ACK would
    // have needed - the parked step now completes only through its own
    // fallback timer. Invoking it heals the park (done() still fires).
    newSettleCb()
    expect(manager.getTurnTokenState()).toBe('RESOLVING') // parked at 'impact'
    expect(manager.getPendingPlaybackToken()).not.toBeNull()

    manager.abandonBattle()
  })

  it('a stale fallback firing before the new battle claims is a clean no-op', () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const timers = stubTimersToQueue()

    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    const staleCb = timers[0]!.cb

    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    // New battle is in 'intro'/'countdown'; no pending step and no pending
    // playback. The stale drive arm finds nothing to corrupt.
    staleCb()

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getPendingPlaybackToken()).toBeNull()
    expect(manager.getTurnBattle()).not.toBeNull()

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) Bookkeeping + rejection controls.
// ----------------------------------------------------------------------------

describe('r36 AUT - C: bookkeeping and rejection pins', () => {
  it('pendingStepTimers grows one entry per re-arm while administratively parked (Nit)', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkInteractiveGhost(manager)
    const internals = stepInternals(manager)

    manager.freezeCombat('authority-pause')
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 3 + 100)

    // Each fallback fire pushes ONE more timer handle into the array; fired
    // handles are never pruned - growth is one entry per ANIMATION_FALLBACK_MS
    // for as long as the administrative latch holds.
    expect(internals.pendingStepTimers.length).toBeGreaterThanOrEqual(4)
  })

  it("rejection pin: 'turn-in-flight' cannot enter the step-7 snapshot - the new cycle claims cleanly", () => {
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
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')

    // Mid-turn cycle swap: clearCycleEntryState -> turnToken.reset() -> IDLE
    // -> resume('turn-in-flight') fires at cycle entry, BEFORE the step-7
    // snapshot - so the restart clock never re-freezes the stale claim.
    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getFreezeReasons()).not.toContain('turn-in-flight')

    // The fresh cycle claims and resolves normally - no accumulated wedge.
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('RESOLVING')
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 3 + 100)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(1)

    manager.abandonBattle()
  })

  it('the restored snapshot re-freezes only what was latched - not-revealed still derives from the live session', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    clock.advance(COMBAT_STEP_SECONDS * 260)

    manager.freezeCombat('user-pause')
    manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())

    // 'user-pause' survived the stop+start via the snapshot; the freshly
    // minted held session (step 6 for 'fresh'/'test' kinds) re-derives
    // 'not-revealed' via syncOffScreenFreeze.
    expect(manager.getFreezeReasons()).toContain('user-pause')
    expect(manager.getFreezeReasons()).toContain('not-revealed')
    expect(manager.getFreezeReasons()).not.toContain('turn-in-flight')
    expect(manager.getCombatClockState()).toBe('frozen')

    manager.resumeCombat('user-pause')
    manager.abandonBattle()
  })
})
