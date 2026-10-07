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
// QA probe - fixpoint r39 AUT wave. Blind adversarial audit of the r38
// adjudication at 56098103 (code commit c3f1503a plus report docs). Each r38
// fix is assumed exploitable until the mechanism is traced and either broken
// or pinned:
//
//   (A) r38-AUT-1 sibling - DEFECT (Medium): the step-7 IDLE-token strip at
//       :2191 covers only latch sets that pass THROUGH the carry. The
//       launch-path presentation_session_started emit at
//       mintCombatSessionForLaunch :2487 runs AFTER beginBattleCycleCommitted
//       returns - every 'stage' mint (the common real path) and every
//       hidden-trial replacement emit there, with no carry downstream to
//       filter a planted reason. A 'turn-in-flight' plant in that emit lands
//       on the fresh clock verbatim: token stays IDLE (a frozen token never
//       claims), only the token listener clears that reason -> permanent
//       wedge, the exact class r38 eliminated at the :2174 in-mint emit.
//       Wider seam noted: freezeCombat accepts machine-owned reasons at ANY
//       time the token is IDLE - a mid-battle plant wedges the live battle
//       the same way (bounded by the next mint's carry, which strips it).
//   (B) r38 latch-carry sibling - DEFECT (Medium): the :2191 snapshot can
//       only carry reasons still armed at the read. Every terminal/teardown
//       path stops the clock BEFORE any carry: settleCombatOutcome :1132
//       (non-repeat victory and all defeat), abandonBattle :2662,
//       discardInFlightBattle :1785. CombatClock.stop() clears the whole
//       reason set unconditionally (:88). Honest repro with public APIs
//       only: park a manual turn (AWAITING_INPUT), authority latches
//       'authority-pause', the user answers the choice anyway -
//       submitTurnChoice drives the pipeline directly and ignores the
//       frozen clock -> victory -> stop() erases the still-owned
//       'authority-pause' with no resume -> the next mint runs unlatched
//       while useAppLifecycle still believes the latch holds. Same
//       silent-divergence shape as r35-AUT-2, at the battle boundary
//       instead of the mint boundary.
//   (C) r38-AUT-1 regression pin: a 'turn-in-flight' plant inside the
//       'fresh' mint's OWN emit at :2174 still dies at the strip.
//   (D) F2/F3/F5/F6/F7/F8 - REJECTED with mechanism notes (see report):
//       FIFO guard is airtight (single-threaded; IDLE+empty inline arm is
//       correct); drain try/catch is bounded (queued closures only flip
//       the flag + null the slot, cannot reach COMBAT_OVER mid-drain; a
//       throw leaves the slot for the next dropBoundaryQueue to re-land);
//       the hoisted splice is correct (the closed-over `timer` always
//       aliases the handle whose task is executing; same-epoch stale
//       fires die on the settled check, old-epoch fires die on the gen
//       check, both before the splice); pendingManualMode slot hoist is
//       bounded (only readers are dropBoundaryQueue's re-land; writers
//       enumerated :307/:2744/:2759, all consistent); enemyManager.clear
//       at :1914 precedes every spawn of the new cycle (:1983+) and the
//       nested-mint sweep is adjudicated-intended; stageSnapshot is bound
//       pre-emit and completedStageIds dedups via includes() :175;
//       entryStage 'game' on the 'failed' card is deliberate (retry keeps
//       the Phaser host via error.failedRequest.target pin) and the
//       gate's second clause (clock non-stopped) discriminates - no
//       reachable state has entryStage 'game' + non-stopped clock +
//       non-game surface.
//   (E) Adjudicated-accepted bounds verified: verbatim-parked stamps,
//       NaN-in-park wedge, boot discard contract, dangling internals
//       write-guards, mounted-by-design systems, nested-mint wholesale
//       orphaning, markReady injected-fault class - all hold as stated.
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
// (A) The post-cycle launch emit at mintCombatSessionForLaunch :2487 is the
//     same plant window r38 fixed at the in-mint emit - but here the fresh
//     clock is already restarted, so nothing downstream strips a foreign
//     'turn-in-flight'. It wedges verbatim.
// ----------------------------------------------------------------------------

describe("r39 AUT - A: 'turn-in-flight' plant inside the post-cycle launch emit is refused at the latch (post-adjudication pin)", () => {
  it("the planted reason dies at freezeCombat and the fresh battle runs", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')

    // 'stage' mints emit presentation_session_started past step-7's strip -
    // the latch's intrinsic token owner now refuses the plant while IDLE.
    const plant = () => manager.freezeCombat('turn-in-flight')
    manager.eventBus.on('presentation_session_started', plant)
    startAStage(manager)
    manager.eventBus.off('presentation_session_started', plant)

    // Only the mint's own 'not-revealed' is armed - the plant never landed.
    expect(manager.getFreezeReasons()).toEqual(['not-revealed'])

    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    expect(manager.getFreezeReasons()).toEqual([])

    // The battle ticks: no wedge - the intro countdown advances. Mid-turn
    // the clock may legitimately hold 'turn-in-flight', so progress is the
    // pin, not the instantaneous state; no admin reason may be latched.
    const minted = manager.getTurnBattle()!
    const introAtStart = minted.introTurnsRemaining as number
    clock.advance(COMBAT_STEP_SECONDS * 600)
    expect(manager.getTurnBattle()!.introTurnsRemaining).toBeLessThan(introAtStart)
    expect(manager.getFreezeReasons()).toEqual(
      expect.not.arrayContaining(['authority-pause', 'tab-hidden', 'user-pause', 'not-revealed']),
    )

    manager.abandonBattle()
  })

  it('control: the same launch without the plant ticks normally after reveal', () => {
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
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')

    const minted = manager.getTurnBattle()!
    const introBefore = minted.introTurnsRemaining as number
    clock.advance(COMBAT_STEP_SECONDS * 600)
    expect(manager.getTurnBattle()!.introTurnsRemaining).toBeLessThan(introBefore)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (B) Terminal/teardown stop() erases an armed owned latch before any carry
//     can snapshot it. submitTurnChoice resolves the parked manual turn while
//     the authority latch holds; the victory terminal stops the clock and
//     silently drops 'authority-pause' - the next mint restarts unlatched.
// ----------------------------------------------------------------------------

describe("r39 AUT - B: a terminal combat-over parks the armed 'authority-pause' and the next mint carries it (post-adjudication pin)", () => {
  it('parked manual turn + authority latch + submitted choice -> victory parks the latch, the next mint stays held until the owner releases', () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player = startAStage(manager) // repeatContinuously=false by default

    // Park a manual turn: manual ON, then the player's claim waits.
    manager.setBattleManualMode(true)
    clock.advance(COMBAT_STEP_SECONDS * 300)
    expect(manager.getTurnTokenState()).toBe('AWAITING_INPUT')
    expect(manager.getCombatClockState()).toBe('frozen') // 'turn-in-flight'

    // The authority latch arms mid-wait (owner edge-triggered; the probe
    // acts as the owner - no truth registered, so the latch fails open).
    manager.freezeCombat('authority-pause')
    expect(manager.getFreezeReasons()).toEqual(
      expect.arrayContaining(['authority-pause', 'turn-in-flight']),
    )

    // The user answers the parked choice anyway: victory -> settle parks
    // both live reasons before combatClock.stop() clears the live set.
    manager.getTurnBattle()!.enemies[0]!.entity.currentHp = 1
    expect(manager.submitTurnChoice('basic')).toBe(true)

    expect(manager.getTurnBattle()!.state).toBe('victory')
    expect(manager.getCombatClockState()).toBe('stopped')
    expect(manager.getFreezeReasons()).toEqual([])

    // The next mint carries the parked latch: 'authority-pause' re-lands
    // while 'turn-in-flight' dies on the IDLE-token strip - the battle
    // stays frozen until the owner releases it.
    manager.turnBattleOps.startBattleWithPlayer(player, enemyWith('post_wipe'))
    expect(manager.getFreezeReasons()).toEqual(['authority-pause'])
    expect(manager.getCombatClockState()).toBe('frozen')

    manager.resumeCombat('authority-pause')
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')

    manager.abandonBattle()
  })

  it('sibling form: abandonBattle under an armed authority latch parks + carries it the same way', () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player = startAStage(manager)
    clock.advance(COMBAT_STEP_SECONDS * 300)
    expect(manager.getCombatClockState()).toBe('running')

    manager.freezeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    expect(manager.abandonBattle()).toBe(true)
    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('stopped')

    // The parked latch carries into the next mint.
    manager.turnBattleOps.startBattleWithPlayer(player, enemyWith('post_abandon'))
    expect(manager.getFreezeReasons()).toEqual(['authority-pause'])
    expect(manager.getCombatClockState()).toBe('frozen')

    manager.resumeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('running')

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) Regression pin: the r38 strip still kills a 'turn-in-flight' plant
//     made inside the 'fresh' mint's own :2174 emit window.
// ----------------------------------------------------------------------------

describe("r39 AUT - C: the in-mint emit plant still dies (r38 strip + r39 latch refusal)", () => {
  it("a 'turn-in-flight' planted inside a 'fresh' mint's emit is refused - token IDLE means nothing arms it", () => {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player = startAStage(manager)
    clock.advance(COMBAT_STEP_SECONDS * 300)
    expect(manager.getCombatClockState()).toBe('running')

    const plant = () => manager.freezeCombat('turn-in-flight')
    manager.eventBus.on('presentation_session_started', plant)
    manager.turnBattleOps.startBattleWithPlayer(player, enemyWith('fresh_plant'))
    manager.eventBus.off('presentation_session_started', plant)

    expect(manager.getFreezeReasons()).toEqual([])
    expect(manager.getCombatClockState()).toBe('running')
    expect(manager.getTurnTokenState()).toBe('IDLE')

    const minted = manager.getTurnBattle()!
    const ticksBefore = minted.introTurnsRemaining as number
    clock.advance(COMBAT_STEP_SECONDS * 600)
    expect(manager.getTurnBattle()!.introTurnsRemaining).toBeLessThan(ticksBefore)

    manager.abandonBattle()
  })
})
