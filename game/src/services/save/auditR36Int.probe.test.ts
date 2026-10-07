// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
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
//       carries the latch into the NEW battle object - EXCEPT
//       'user-pause', whose owner is battle-scoped (CombatTopBar's
//       watch(battle) resets userPaused on battle identity change without
//       resuming): it dies with the old battle, which is the pre-carry
//       semantics the UI already assumed (r36-INT-1 fixed).
//       'authority-pause' and 'tab-hidden' still carry coherently (their
//       owner flags persist across battle identity).
//   (B) The 'stopped' drop arm cannot hit a new battle's settle: the restart
//       is synchronous and every parked timer of the old battle dies in
//       clearCycleEntryState before step 7.
//   (C) Discard surfaces: both call sites delegate to discardInFlightBattle;
//       the 'user-pause' latch dies with the clock, getBattleBuffs reads []
//       post-discard.
//   (D) Sibling seams, both fixed: setCombatClockSource now preserves the
//       reason set verbatim across its stop()+start() (same-battle swap,
//       same owners - including 'turn-in-flight'); the parked-forever
//       admin gate swaps its fired handle instead of appending one dead
//       handle per re-arm on a wedged zombie.
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

describe('r36 INT - A: latch carry across the auto-repeat restart is owner-lifetime scoped', () => {
  it("'user-pause' dies with the battle it was taken on: new battle object runs, reasons [] (R36-INT-1 fixed)", async () => {
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

    // Post-fix: 'user-pause' is excluded from the step-7 carry - its owner
    // flag (CombatTopBar.userPaused) resets on battle identity change
    // without resuming, so a carried latch would strand the new battle
    // frozen behind a button claiming unpaused. The latch dies with the
    // old battle; the new cycle runs clean.
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getFreezeReasons()).toEqual([])

    // The token was reset at cycle entry (turnToken.reset() -> IDLE ->
    // resume('turn-in-flight')) BEFORE the step-7 snapshot, so the pipeline's
    // own claim can never leak into a restart's reason set.
    expect(manager.getTurnTokenState()).toBe('IDLE')
    manager.discardStaleBattle()
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
    manager.freezeCombat('authority-pause')
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
    manager.resumeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('running')
    clock.advance(COMBAT_STEP_SECONDS * 400)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])
    await driveAcks(manager, () => (newBattle.totalTurnsElapsed ?? 0) > turnsBefore)
    expect(newBattle.totalTurnsElapsed ?? 0).toBeGreaterThan(turnsBefore)
    manager.discardStaleBattle()
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
    manager.freezeCombat('authority-pause')

    await driveAcks(manager, () => manager.getTurnBattle() !== oldBattle)
    const newBattle = manager.getTurnBattle()!

    // Every pendingStepTimer of the old battle was clearTimeout'd at cycle
    // entry; whatever a stale handle could still see is dead. Ten fallback
    // windows of real time must not settle, drop, or warn.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 10 + 100)

    expect(manager.getTurnBattle()).toBe(newBattle)
    expect(newBattle.state).not.toBe('victory')
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getFreezeReasons()).toEqual(['authority-pause'])
    warn.mockRestore()
    manager.discardStaleBattle()
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

describe('r36 INT - D: sibling seams of the AUT-2 fix (both fixed)', () => {
  it('setCombatClockSource preserves every latch verbatim across the swap - same battle, same owners', () => {
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

    // Post-fix: the swap snapshots the reason set before stop() and
    // re-freezes each on the new instance - 'turn-in-flight' survives too
    // (the token listener only re-binds, it does not re-claim), so a
    // mid-turn swap keeps the token claimed AND the clock latched.
    manager.setCombatClockSource(new ManualClockSource())

    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight', 'user-pause'])
    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    // The administrative latch still gates the wall-clock fallback: real
    // time alone cannot complete the parked step...
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 8 + 100)
    expect(manager.getTurnTokenState()).not.toBe('IDLE')

    // ...and once released, the very next fallback tick drives it home.
    manager.resumeCombat('user-pause')
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 8)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    manager.discardStaleBattle()
  })

  it('the parked-forever admin gate swaps its fired handle - the timer array stays flat on a wedged zombie (fixed)', () => {
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

    // Ten fallback windows under the wedge: each re-arm splices out the
    // handle that just fired and pushes only the new live one - the array
    // stays flat forever (r36-INT-3 fix), while the live timer count stays
    // at one per parked step.
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 10 + 100)

    expect(manager.getCombatClockState()).toBe('frozen')
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(ops.pendingStepTimers.length).toBe(handlesBefore)
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1)
    expect(vi.getTimerCount()).toBeLessThanOrEqual(8)
    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (E) INT-2 source pin: the Continue curtain dies with its latch. App.vue
// watches stateVersion (bumped by every bumpState/tick path, which covers
// every teardown: discard, abandon, combat-over stop) and clears the
// composable's isPaused flag the moment 'tab-hidden' is no longer latched.
// ----------------------------------------------------------------------------
describe('r36 INT - E: the Continue curtain dies with its latch (INT-2 fix)', () => {
  it('App.vue clears isCombatPaused on any stateVersion bump once tab-hidden is gone', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../App.vue', import.meta.url)),
      'utf-8',
    )
    const watchAt = source.indexOf('watch(stateVersion')
    const pauseCheck = source.indexOf('isCombatPaused.value', watchAt)
    const reasonCheck = source.indexOf("getFreezeReasons().includes('tab-hidden')", watchAt)
    const clearAt = source.indexOf('isCombatPaused.value = false', watchAt)

    expect(watchAt).toBeGreaterThan(-1)
    expect(pauseCheck).toBeGreaterThan(watchAt)
    expect(reasonCheck).toBeGreaterThan(pauseCheck)
    expect(clearAt).toBeGreaterThan(reasonCheck)

    // The overlay reads the same flag the watch clears.
    const overlayAt = source.indexOf('v-if="isCombatPaused"')
    expect(overlayAt).toBeGreaterThan(-1)
  })
})
