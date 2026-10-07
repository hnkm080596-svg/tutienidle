// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { defineEnemy, type Enemy } from '../../core/enemy/Enemy'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r38 AUT wave. Blind adversarial audit of the r37
// adjudication at de4c4fb4 (code commit 9881bc0b). Each r37 fix is assumed
// exploitable until the mechanism is traced and either broken or pinned:
//
//   (A) F4 sibling - DEFECT (Medium): beginBattleCycleCommitted's step-7
//       latch carry (:2167-2174) copies every freeze reason except
//       'user-pause' verbatim. The turnToken is ALWAYS IDLE at that read
//       (reset inside clearCycleEntryState at :1689, which also fires the
//       listener's resume and strips any pre-existing 'turn-in-flight') -
//       so a 'turn-in-flight' present at the snapshot is foreign/stale by
//       construction. The plant window is the mint's own synchronous emit
//       chain: 'fresh'/'test' mints emit presentation_session_started at
//       :2150 BEFORE the latch read - the exact channel the 'user-pause'
//       filter exists for (r36-INT-1). A carried 'turn-in-flight' freezes
//       the fresh battle permanently: the clock is frozen, so no combat
//       step ever claims the token, so the only writer of the reason
//       (attachTurnTokenToClock's listener at :517) never resumes it.
//       r37-COR-4 fixed this on the setCombatClockSource carry arm; the
//       beginBattleCycleCommitted arm is the same carry pattern with the
//       same IDLE guarantee and got no strip.
//   (B) F5 ordering edge - DEFECT (Low): a setBattleManualMode(false)
//       stranded-rescue whose beginTurnPipeline reaches COMBAT_OVER
//       synchronously (headless settle) runs onTurnDrained ->
//       dropBoundaryQueue BEFORE this call's own pendingManualMode write
//       lands (:2714 runs after beginTurnPipeline returns at :2702). The
//       drop re-lands the PRE-call pending value: a stale 'true' survives
//       the user's OFF. Bounded: the flag reads true only on the dead
//       battle; the next drop re-lands the queued last intent.
//   (C) F3 sibling - DEFECT (Low): grantTurnBattleRewards emits
//       battle_end at :149 then reads getActiveStage() LIVE at :162 (and
//       inside recordPerfectClearIfEligible at :193). A listener that
//       mints a 'fresh' battle inside the emit nulls the stage binding
//       (:1923) - the old victory's completedStageIds write is silently
//       dropped (or misattributed to a stage-minted replacement). No
//       current listener mints - latent ordering hazard, same class F3
//       moved the emit past in abandonBattle.
//   (D) F3 sibling - REJECTED as defect: a listener minting inside
//       beginBattleCycle's pre-commit emit (:1854) is cleanly superseded
//       by the outer mint (the nested cycle completes, then the outer
//       clearCycleEntryState + assignment overwrite it). Its spawned
//       enemy remains registered in EnemyManager - but every non-staged
//       mint already leaves the outgoing battle's enemies registered
//       (registry is swept only by abandon/discard), so the ghost is the
//       pre-existing envelope plus one entry. Pinned for the record.
//   (E) F1/F2 pins: a consumed step's queued fallback early-returns
//       cleanly (no re-arm, no map residue); the deferral cap-drain keeps
//       pendingStepTimers flat while completing the turn; REJECTED the
//       signal-reuse attack (each signal arms at most once per epoch -
//       beginTurnPipeline bumps pendingStepGeneration at :804).
//       Residual Nit: the drive arm (:963) and dead-battle arm (:904)
//       still retire no fired handle - <=1 dead entry per step, cleared
//       at the next pipeline head; no accumulation path exists (both
//       arms return without re-arming).
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

function enemyWith(id: string): Enemy {
  return defineEnemy({
    id,
    name: `Fixture Dummy ${id}`,
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

function stepInternals(manager: GameManager) {
  return manager.turnBattleOps as unknown as {
    pendingStepDone: Record<string, (() => void) | undefined>
    pendingStepTimers: Array<unknown>
    pendingStepGeneration: number
    deps: { enemySystem: { getAliveEnemies(): Array<{ templateId?: string }> } }
  }
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
// (A) F4 sibling - the cycle-mint latch carry has no IDLE-token strip for
//     'turn-in-flight'. The token is always IDLE when the latch set is read
//     (:2167, after clearCycleEntryState's turnToken.reset() at :1689), so a
//     'turn-in-flight' in the set is foreign by construction - planted inside
//     the mint's own emit chain (presentation_session_started :2150, the same
//     window the 'user-pause' filter covers). Carried -> the minted battle
//     freezes on a reason no live transition will ever clear.
// ----------------------------------------------------------------------------

describe('r38 AUT - A: step-7 latch carry now strips a foreign turn-in-flight on an always-IDLE token (r38 fix)', () => {
  it("a 'turn-in-flight' planted inside the mint's own presentation_session_started emit dies with the snapshot", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player = startAStage(manager)
    clock.advance(COMBAT_STEP_SECONDS * 300)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getCombatClockState()).toBe('running')

    // The plant channel: the 'fresh' mint's emit at :2150 runs BEFORE the
    // step-7 snapshot at :2167 - a listener's freeze lands inside the carry
    // window exactly like r36-INT-1's 'user-pause'.
    const plant = () => manager.freezeCombat('turn-in-flight')
    manager.eventBus.on('presentation_session_started', plant)
    manager.turnBattleOps.startBattleWithPlayer(player, enemyWith('nested_carry'))
    manager.eventBus.off('presentation_session_started', plant)

    // FIXED at r38: the step-7 filter now strips 'turn-in-flight' when the
    // token is IDLE (always true at that read) - the plant dies with the
    // old battle's snapshot instead of wedging the fresh one.
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getTurnTokenState()).toBe('IDLE')

    const minted = manager.getTurnBattle()!
    expect(minted.state).toBe('intro')
    const ticksBefore = minted.introTurnsRemaining as number
    clock.advance(COMBAT_STEP_SECONDS * 600)
    // The fresh battle lives: intro ticks down and the pipeline progresses.
    expect(manager.getTurnBattle()!.introTurnsRemaining).toBeLessThan(ticksBefore)

    manager.abandonBattle()
  })

  it("control: an OWNED reason ('authority-pause') carried by the same arm unlatches normally", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player = startAStage(manager)
    clock.advance(COMBAT_STEP_SECONDS * 300)
    expect(manager.getCombatClockState()).toBe('running')

    const plant = () => manager.freezeCombat('authority-pause')
    manager.eventBus.on('presentation_session_started', plant)
    manager.turnBattleOps.startBattleWithPlayer(player, enemyWith('owned_carry'))
    manager.eventBus.off('presentation_session_started', plant)

    // The carry itself is the designed latch-preserving restart - an owned
    // reason survives, then its owner unlatches it and the battle ticks.
    expect(manager.getFreezeReasons()).toEqual(['authority-pause'])
    expect(manager.getCombatClockState()).toBe('frozen')

    manager.resumeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('running')

    const minted = manager.getTurnBattle()!
    const ticksBefore = minted.introTurnsRemaining as number
    clock.advance(COMBAT_STEP_SECONDS * 10)
    expect(manager.getTurnBattle()!.introTurnsRemaining).toBeLessThan(ticksBefore)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (B) F5 ordering edge - the rescue's own synchronous COMBAT_OVER drains the
//     queue through dropBoundaryQueue BEFORE the OFF call's pending write.
//     pendingManualMode at that instant is still the previous toggle's value
//     (:2714 of the earlier call), so the re-land applies the stale intent.
// ----------------------------------------------------------------------------

describe('r38 AUT - B: rescue pipeline reaching COMBAT_OVER now reads this call\'s pending intent (r38 fix)', () => {
  it('queued ON + OFF-rescue ending the battle leaves the flag false - the slot write moved above the rescue', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player = startAStage(manager)

    // Manual on while the token is IDLE: the write lands immediately.
    manager.setBattleManualMode(true)
    expect(manager.isBattleManualMode()).toBe(true)

    // The player's claim parks in AWAITING_INPUT (player speed dominates).
    clock.advance(COMBAT_STEP_SECONDS * 300)
    expect(manager.getTurnTokenState()).toBe('AWAITING_INPUT')

    // A redundant ON while parked queues applyTrue and leaves pending=true.
    manager.setBattleManualMode(true)

    // The OFF rescue: pendingManualMode is now written at method top, so
    // submitChoice -> flag=false -> beginTurnPipeline -> the 1hp enemy
    // dies -> onTurnDrained hits COMBAT_OVER and dropBoundaryQueue
    // re-lands THIS call's intent (false), not the stale queued ON.
    manager.getTurnBattle()!.enemies[0]!.entity.currentHp = 1
    manager.setBattleManualMode(false)

    // FIXED at r38: the session flag reads the user's last intent even on
    // the dead battle.
    expect(manager.getTurnBattle()!.state).toBe('victory')
    expect(manager.getTurnTokenState()).toBe('COMBAT_OVER')
    expect(manager.isBattleManualMode()).toBe(false)

    // The next mint keeps the correct intent.
    manager.turnBattleOps.startBattleWithPlayer(player, enemyWith('heal_check'))
    expect(manager.isBattleManualMode()).toBe(false)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) F3 sibling - grantTurnBattleRewards' post-emit reads still bind to
//     whatever a listener-minted cycle installed. publishBattleEnd runs at
//     :149; the victory branch then reads getActiveStage() LIVE at :162.
// ----------------------------------------------------------------------------

describe('r38 AUT - C: a mint inside the victory emit rebinds the post-emit stage reads', () => {
  it("a listener minting a 'fresh' battle inside battle_end drops the ended stage's completion write", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player = startAStage(manager)
    clock.advance(COMBAT_STEP_SECONDS * 300)
    const ended = manager.getTurnBattle()!
    expect(ended.state).toBe('fighting')

    const mint = () => {
      manager.turnBattleOps.startBattleWithPlayer(player, enemyWith('emit_mint'))
    }
    manager.eventBus.on('battle_end', mint)

    ended.enemies[0]!.entity.currentHp = 1
    clock.advance(COMBAT_STEP_SECONDS * 300)
    manager.eventBus.off('battle_end', mint)

    // The listener's mint survived: settleCombatOutcome re-read the live
    // turnBattle at :1082 (non-terminal 'intro') and skipped the clock stop.
    const minted = manager.getTurnBattle()!
    expect(minted).not.toBe(ended)

    // FIXED at r38: grantTurnBattleRewards snapshots the active stage
    // BEFORE publishBattleEnd, so the listener's mint no longer rebinds
    // the completion write - fixture_stage records as cleared even though
    // a 'fresh' battle now owns the slot.
    expect(player.completedStageIds).toContain('fixture_stage')

    // Control witness: the minted replacement is a fresh battle, not the
    // ended one re-flagged.
    expect(minted.state).not.toBe('victory')

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (D) F3 sibling rejected - the cycle's own pre-commit emit at :1854 is the
//     mirror of abandonBattle's old ordering, but the post-emit code is the
//     whole rebuild: a listener-minted battle is fully constructed then
//     fully replaced by the outer mint. Evidence pinned below.
// ----------------------------------------------------------------------------

describe('r38 AUT - D: a mint inside the cycle pre-commit emit is superseded, not zombied', () => {
  it("the listener's mint completes then the outer mint replaces it - residue is only an extra EnemyManager ghost", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player = startAStage(manager)
    clock.advance(COMBAT_STEP_SECONDS * 300)
    expect(manager.getTurnBattle()!.state).toBe('fighting')

    const mint = () => {
      manager.turnBattleOps.startBattleWithPlayer(player, enemyWith('superseded'))
    }
    manager.eventBus.on('battle_end', mint)

    // The outer mint emits 'defeat' for the outgoing battle at :1854; the
    // listener mints inside that emit; the outer committed section then
    // overwrites everything the nested mint built.
    manager.turnBattleOps.startBattleWithPlayer(player, enemyWith('outer'))
    manager.eventBus.off('battle_end', mint)

    // The outer battle is the live one; the nested mint left no live
    // machinery of its own (same session slot ended and re-begun, same
    // token, same clock - all re-owned by the outer cycle).
    const live = manager.getTurnBattle()!
    expect(live.state).toBe('intro')
    expect(manager.getCombatClockState()).toBe('running')

    // FIXED at r38: the committed mint's enemyManager.clear() at step 1
    // sweeps the nested mint's spawn (and the outgoing battle's leftovers)
    // - the registry holds only the outer battle's live enemy.
    const aliveIds = stepInternals(manager)
      .deps.enemySystem.getAliveEnemies()
      .map((e) => e.templateId)
    expect(aliveIds).not.toContain('superseded')
    expect(aliveIds).toContain('outer')

    // The live battle still ticks normally.
    clock.advance(COMBAT_STEP_SECONDS * 60)
    expect(manager.getTurnBattle()!.state).not.toBe('intro')

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (E) F1/F2 pins + residual Nit evidence.
// ----------------------------------------------------------------------------

describe('r38 AUT - E: fallback bookkeeping pins', () => {
  it('a consumed step queued fallback early-returns: no re-arm, no map residue, no new timer', () => {
    const manager = registeredManager()
    const timers = stubTimersToQueue()
    const { token } = parkInteractiveGhost(manager)
    const internals = stepInternals(manager)

    const armedAtPark = internals.pendingStepTimers.length
    expect(armedAtPark).toBe(1)
    expect(internals.pendingStepDone['ready']).toBeDefined()
    const queueDepthAtPark = timers.length

    // The real settle channel consumes the parked entry (ACK -> declare ->
    // sink -> settleStep): 'ready' vacates, its handle is spliced, and the
    // pipeline re-arms 'impact'.
    manager.acknowledgeTurnReady(token)
    expect(internals.pendingStepDone['ready']).toBeUndefined()
    expect(internals.pendingStepDone['impact']).toBeDefined()
    expect(internals.pendingStepTimers).toHaveLength(1)

    // Now the stale 'ready' fallback fires from the task queue: the epoch
    // matches, so the r37 settled-check is what stops it - no new map
    // entry, no re-armed timer, no cap-drain.
    timers[0]!.cb()
    expect(internals.pendingStepDone['ready']).toBeUndefined()
    expect(internals.pendingStepDone['impact']).toBeDefined()
    expect(internals.pendingStepTimers).toHaveLength(1)
    expect(timers).toHaveLength(queueDepthAtPark + 1)

    manager.abandonBattle()
  })

  it('Nit evidence: the live-drive arm consumes the entry but leaves the fired handle parked (bounded, no accumulation)', () => {
    const manager = registeredManager()
    const timers = stubTimersToQueue()
    parkInteractiveGhost(manager)
    const internals = stepInternals(manager)

    expect(internals.pendingStepTimers).toHaveLength(1)
    const firedHandle = internals.pendingStepTimers[0]

    // Live battle, no admin latch, session released: the fallback takes the
    // drive arm - r38 hoisted the splice so the just-fired handle retires
    // before the next arm; the array stays flat.
    timers[0]!.cb()

    expect(internals.pendingStepDone['ready']).toBeUndefined()
    expect(internals.pendingStepTimers).toHaveLength(1)
    expect(internals.pendingStepTimers[0]).not.toBe(firedHandle)
    // 'impact' armed live as the single resident handle.
    expect(internals.pendingStepDone['impact']).toBeDefined()

    manager.abandonBattle()
  })
})
