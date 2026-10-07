// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { ANIMATION_FALLBACK_MS } from '../../core/game/GameManagerTurnBattleOps'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r36 INT wave. Blind integration-coherence audit of the
// r35 adjudication at bb7bc574: reconnect-'replaced' discard (App.vue:745),
// per-battle machinery clear (turnRuntime/battleBuffRegistry/combatScheduler),
// the awaitStep admin-latch gate (r35-AUT-1), and the latch-preserving restart
// in beginBattleCycle step 7 (r35-AUT-2).
//
//   (A) Latch carry across the auto-repeat restart vs its owners. The ACK
//       channel (acknowledgeTurnReady/Impact/Complete) gates ONLY on
//       isSessionBlocking - not on freeze reasons - so a turn already in
//       flight completes under an administrative latch. If that turn is
//       terminal and repeatContinuously holds, beginBattleCycle step 7
//       carries the latch into the NEW battle object. 'user-pause' is the
//       asymmetric case: CombatTopBar's watch(battle) resets userPaused on
//       battle identity change, so the latch survives while the UI flag
//       claims unpaused (R36-INT-1). 'authority-pause' and 'tab-hidden'
//       carry coherently (their owner flags persist across battle identity).
//   (B) The 'stopped' drop arm cannot hit a new battle's settle: the restart
//       is synchronous and every parked timer of the old battle dies in
//       clearCycleEntryState before step 7.
//   (C) Discard surfaces: both call sites delegate to discardInFlightBattle;
//       the 'user-pause' latch dies with the clock, getBattleBuffs reads []
//       post-discard.
//   (D) Sibling seams: setCombatClockSource runs the same stop()+start()
//       class as AUT-2 but with NO reason preservation (drops every latch,
//       including 'turn-in-flight'); the parked-forever admin gate accumulates
//       one dead handle per re-arm on a permanently wedged zombie.
//
// ASCII only (P15).
// ============================================================================

let currentMs = 1_725_160_000_000

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
 * A repeat-continuously interactive battle parked mid-turn: session held
 * then released (isSessionBlocking false), ManualClockSource installed, one
 * turn claimed. The combat clock sits frozen on the turn's own
 * 'turn-in-flight' claim - identical to the r35 harness but with the
 * auto-repeat flag on so a terminal turn runs restartTurnBattleCycle.
 */
function parkRepeatGhost(manager: GameManager) {
  const clock = new ManualClockSource()
  manager.setCombatClockSource(clock)
  manager.setPresentationActive(true)
  manager.setPresentationMode('interactive')
  const player = startAStage(manager, { repeatContinuously: true })
  const port = manager.getPresentationPort()
  const hold = port.hold(port.getCurrentSession()!)!
  port.attach(hold)
  port.release(hold)
  clock.advance(COMBAT_STEP_SECONDS * 260)

  const battle = manager.getTurnBattle()
  expect(battle).not.toBeNull()
  expect(manager.getTurnTokenState()).not.toBe('IDLE')
  expect(manager.getPendingPlaybackToken()).not.toBeNull()
  return { player, battle: battle! }
}

/**
 * Drive the public renderer ACK surface (the same calls Phaser issues on
 * animation callbacks) until `until` holds or the pending playback drains.
 * Each acknowledge consumes only its own pending stage, so issuing all three
 * in order is a no-op-safe walk through ready -> impact -> complete. The
 * await flushes the microtask drain: settleStep -> done() -> pipeline ->
 * onTurnDrained -> settleCombatOutcome -> restartTurnBattleCycle all run as
 * promise continuations, not inside the ack call's stack.
 */
async function driveAcks(
  manager: GameManager,
  until?: () => boolean,
  budget = 80,
): Promise<void> {
  for (let i = 0; i < budget; i += 1) {
    if (until?.()) return
    const token = manager.getPendingPlaybackToken()
    if (token === null) {
      if (!until) return
      await Promise.resolve()
      continue
    }
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    await Promise.resolve()
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  currentMs = 1_725_160_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => currentMs)
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) Latch carry across the auto-repeat restart (r35-AUT-2 vs latch owners).
// ----------------------------------------------------------------------------

describe('r36 INT - A: an in-flight turn completing under an administrative latch carries the latch into the repeated battle', () => {
  it("'user-pause' survives the auto-repeat restart: new battle object, clock frozen, owner flag reset (R36-INT-1)", async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle: oldBattle } = parkRepeatGhost(manager)

    // One hit kills the only enemy - the in-flight turn is terminal.
    oldBattle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('user-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    // The ACK channel does not consult freeze reasons (CombatAnimationRuntime
    // acknowledge* gates on isSessionBlocking only), so the parked turn
    // completes under 'user-pause', the kill lands, victory settles, and the
    // repeat restart mints a new TurnBattle inside this drive.
    await driveAcks(manager, () => manager.getTurnBattle() !== oldBattle)

    const newBattle = manager.getTurnBattle()
    expect(newBattle).not.toBeNull()
    expect(newBattle).not.toBe(oldBattle)

    // r35-AUT-2 carry: the external latch is snapshotted before stop()+start()
    // and re-frozen on the new cycle.
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toEqual(['user-pause'])

    // The token was reset at cycle entry (turnToken.reset() -> IDLE ->
    // resume('turn-in-flight')) BEFORE the step-7 snapshot, so the pipeline's
    // own claim can never leak into a restart's reason set.
    expect(manager.getTurnTokenState()).toBe('IDLE')

    // The latch itself still works - a manual release unfreezes the new
    // battle. The defect is upstream: CombatTopBar's watch(battle) already
    // reset its userPaused ref, so nothing on screen tells the user the new
    // battle is frozen on 'user-pause'.
    manager.resumeCombat('user-pause')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')
  })

  it("'authority-pause' carries too - coherently: the lifecycle simPaused flag persists across the restart and resumeSimulation still owns the release", async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle: oldBattle } = parkRepeatGhost(manager)

    oldBattle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('authority-pause')

    await driveAcks(manager, () => manager.getTurnBattle() !== oldBattle)

    expect(manager.getTurnBattle()).not.toBe(oldBattle)
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getFreezeReasons()).toEqual(['authority-pause'])

    // resumeSimulation releases it - the latch owner's flag (simPaused) is
    // lifecycle-scoped, not battle-scoped, so owner and latch stay in sync.
    manager.resumeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getFreezeReasons()).toEqual([])
  })

  it("'tab-hidden' carries too - coherently: useCombatPause's isPaused ref persists and Continue releases it", async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle: oldBattle } = parkRepeatGhost(manager)

    oldBattle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('tab-hidden')

    await driveAcks(manager, () => manager.getTurnBattle() !== oldBattle)

    expect(manager.getTurnBattle()).not.toBe(oldBattle)
    expect(manager.getFreezeReasons()).toEqual(['tab-hidden'])
    manager.resumeCombat('tab-hidden')
    expect(manager.getCombatClockState()).toBe('running')
  })

  it('the carried latch actually freezes the new battle: no ticks, no new turn claim while held', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    startAStage(manager, { repeatContinuously: true })
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    clock.advance(COMBAT_STEP_SECONDS * 260)

    const oldBattle = manager.getTurnBattle()!
    oldBattle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('user-pause')
    await driveAcks(manager, () => manager.getTurnBattle() !== oldBattle)

    const newBattle = manager.getTurnBattle()!
    const turnsBefore = newBattle.totalTurnsElapsed ?? 0

    // Frozen clock: the new battle receives no combat steps.
    clock.advance(COMBAT_STEP_SECONDS * 400)
    expect(newBattle.totalTurnsElapsed ?? 0).toBe(turnsBefore)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('frozen')

    // Release: the clock runs again, the new battle claims a turn
    // ('turn-in-flight' latch appears), and driving the ACK channel settles
    // it - the carried latch was the only thing holding the battle.
    manager.resumeCombat('user-pause')
    expect(manager.getCombatClockState()).toBe('running')
    clock.advance(COMBAT_STEP_SECONDS * 400)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])
    await driveAcks(manager, () => (newBattle.totalTurnsElapsed ?? 0) > turnsBefore)
    expect(newBattle.totalTurnsElapsed ?? 0).toBeGreaterThan(turnsBefore)
  })
})

// ----------------------------------------------------------------------------
// (B) The 'stopped' drop arm vs the synchronous restart.
// ----------------------------------------------------------------------------

describe('r36 INT - B: no parked fallback of the old battle survives into the new cycle', () => {
  it('post-restart, real-time fallback ticks settle nothing on the frozen new battle and no stale drop fires', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { battle: oldBattle } = parkRepeatGhost(manager)
    oldBattle.enemies[0]!.entity.currentHp = 1
    manager.freezeCombat('user-pause')

    await driveAcks(manager, () => manager.getTurnBattle() !== oldBattle)
    const newBattle = manager.getTurnBattle()!

    // Every pendingStepTimer of the old battle was clearTimeout'd at cycle
    // entry; whatever a stale handle could still see is dead. Ten fallback
    // windows of real time must not settle, drop, or warn.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 10 + 100)

    expect(manager.getTurnBattle()).toBe(newBattle)
    expect(newBattle.state).not.toBe('victory')
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getFreezeReasons()).toEqual(['user-pause'])
    warn.mockRestore()
  })
})

// ----------------------------------------------------------------------------
// (C) Discard surfaces: both call sites converge on discardInFlightBattle.
// ----------------------------------------------------------------------------

describe('r36 INT - C: discardStaleBattle aftermath under a latched ghost', () => {
  it('a discard under user-pause leaves the designed surface: stopped clock, empty reasons, dead machinery', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle } = parkRepeatGhost(manager)
    const enemyId = battle.enemies[0]!.entity.id
    manager.freezeCombat('user-pause')

    manager.discardStaleBattle()

    expect(manager.getTurnBattle()).toBeNull()
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getPendingPlaybackToken()).toBeNull()
    // r35-INT-2 fix: per-battle machinery is null, so the stale-read leak is
    // gone - getBattleBuffs answers [] for the dead battle's entity ids.
    expect(manager.getBattleBuffs(enemyId)).toEqual([])
  })

  it('abandon (non-repeat teardown) clears user-pause too: the restart arm is the ONLY entry that can carry it', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkRepeatGhost(manager)
    manager.freezeCombat('user-pause')

    manager.abandonBattle()

    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])
  })
})

// ----------------------------------------------------------------------------
// (D) Sibling seams.
// ----------------------------------------------------------------------------

describe('r36 INT - D: sibling seams of the AUT-2 fix', () => {
  it('setCombatClockSource runs stop()+start() WITHOUT reason preservation - every latch dies on swap', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    startAStage(manager)
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getPendingPlaybackToken()).not.toBeNull()

    manager.freezeCombat('user-pause')
    expect(manager.getFreezeReasons()).toContain('user-pause')

    // Source swap = CombatClock.replace: stop() clears the reason set on the
    // old instance and the new instance starts empty. 'turn-in-flight' is
    // lost too: the token listener only fires on FUTURE state changes, so a
    // mid-turn swap leaves the token claimed but the new clock unlatched.
    manager.setCombatClockSource(new ManualClockSource())

    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    // Consequence: the parked real-time fallback is no longer gated - the
    // next tick drives the step through with no latch at all.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 3 + 100)
    expect(manager.getTurnTokenState()).toBe('IDLE')
  })

  it('the parked-forever admin gate churns one dead handle per re-arm on a permanently wedged zombie', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    startAStage(manager)
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    clock.advance(COMBAT_STEP_SECONDS * 260)

    manager.freezeCombat('authority-pause')
    const ops = manager.turnBattleOps as unknown as {
      pendingStepTimers: Array<ReturnType<typeof setTimeout>>
    }
    const handlesBefore = ops.pendingStepTimers.length

    // Ten fallback windows: each re-arm pushes a handle into
    // pendingStepTimers without removing the dead one (cleared only in
    // clearPendingSteps). Live timer count stays at 1 per parked step - the
    // leak is the handle array, bounded but real on a designed-forever wedge.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 10 + 100)

    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(ops.pendingStepTimers.length).toBeGreaterThan(handlesBefore + 5)
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1)
    expect(vi.getTimerCount()).toBeLessThanOrEqual(8)
  })
})
