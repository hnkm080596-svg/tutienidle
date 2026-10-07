// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { defineEnemy } from '../../core/enemy/Enemy'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { asBaseStats } from '../../core/stats/StatBlock'
import type { Stage } from '../../core/stage/Stage'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { useBootFlow } from '../../composables/useBootFlow'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r39 COR wave. Blind correctness audit of the r38
// adjudication at 56098103 (code commit c3f1503a). Attack map:
//
//   (A) r39-COR-1 - the step-7 latch replay strips only 'turn-in-flight' on
//       an IDLE token. A foreign 'authority-pause' or 'tab-hidden' planted
//       through the same presentation_session_started emit window still
//       carries verbatim onto the fresh clock - a permanent in-session wedge
//       (authority-pause: resumeSimulation is gated on simPaused, which a
//       foreign plant never arms; tab-hidden: continueBattle is gated on
//       isPaused, which a foreign plant never arms). Sibling seam: a stage
//       mint emits presentation_session_started inside
//       mintCombatSessionForLaunch AFTER step-7 - a plant there lands on the
//       running clock directly and never passes through the strip.
//   (B) r39-COR-2 - recordPerfectClearIfEligible reads getStartedAtMs()
//       LIVE post-emit (:226). The r38-AUT-3 snapshot covered only the stage
//       binding; a battle_end listener minting inside the emit nulls (fresh
//       policy :1949) or restamps (stage mint :2477) turnBattleStartedAtMs,
//       so clearSeconds lands 0 - a persisted first-record that can never be
//       overwritten and that fails isValidCycleSeconds' >= 1 floor, leaving
//       the stage perfect-clear-flagged but permanently autofarm-ineligible.
//   (C) r39-COR-3 - drainBoundaryQueueIfIdle swaps the queue out before
//       running it; a queued command that itself calls a boundary API sees
//       IDLE + empty and runs INLINE, ahead of the rest of the batch - the
//       FIFO inversion the r38 length guard was written to remove, now
//       reachable from inside the drain arm.
//   (D) r39-COR-4 - setBattleManualMode records the slot at method top but
//       pushes its boundary command AFTER the stranded rescue. A nested
//       setBattleManualMode invoked inside the rescue's synchronous
//       pipeline (e.g. a listener on an op-resolution emit) enqueues BEFORE
//       the outer call's own command, so the queue drains in inverted
//       invocation order and the landed flag is the FIRST-invoked intent.
//   (E) r39-COR-5 - useBootFlow promotes entryStage to 'game' on a FAILED
//       transition whose failedRequest.target is a game route - the
//       isCombatActive gate then arms the pause curtain over the mounted
//       error surface. Bounded cosmetic (appError z-order covers the
//       curtain; the latch clears on battle teardown).
//   (F) Verified-clean pins: the isBlocking deferral re-arm keeps exactly
//       one live handle across repeated fires (hoisted splice is correct),
//       a defeat-side mid-emit mint does not credit stage completion, and a
//       non-stranded setBattleManualMode consumes its slot via the queued
//       closure.
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

function opsInternals(manager: GameManager) {
  return manager.turnBattleOps as unknown as {
    pendingStepDone: Record<string, (() => void) | undefined>
    pendingStepTimers: Array<unknown>
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
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

/**
 * Spy on the session runtime's manual-mode flag writer: every write
 * (immediate rescue write, drain-time closure write) lands in `writes` in
 * order. Reaches through the same internals channel opsInternals uses.
 */
function spyRuntimeFlagWrites(manager: GameManager) {
  const internals = manager.turnBattleOps as unknown as {
    presentationOps: { runtime: { setBattleManualMode: (enabled: boolean) => void } }
  }
  const writes: boolean[] = []
  const runtime = internals.presentationOps.runtime
  const original = runtime.setBattleManualMode.bind(runtime)
  runtime.setBattleManualMode = (enabled: boolean) => {
    writes.push(enabled)
    original(enabled)
  }
  return writes
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
// (A) r39-COR-1 (Medium) - the step-7 strip covers only 'turn-in-flight'.
//     A foreign 'authority-pause' or 'tab-hidden' planted through the same
//     synchronous presentation_session_started emit window carries verbatim
//     onto the fresh clock, and neither has an in-session unlatch for a
//     foreign latch: resumeCombat('authority-pause') runs only inside
//     resumeSimulation (gated on simPaused, which a plant never arms) and
//     resumeCombat('tab-hidden') runs only inside continueBattle (gated on
//     isPaused, likewise never armed). The frozen clock cannot produce a
//     token transition, so no owner ever clears the plant.
// ----------------------------------------------------------------------------

describe('r39 COR - A: foreign reason carry through the step-7 replay', () => {
  it.each(['authority-pause', 'tab-hidden'] as const)(
    "a foreign '%s' planted inside presentation_session_started carries verbatim and wedges the fresh battle",
    (reason) => {
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

      // Same listener seam the fixed 'turn-in-flight' probe used: the emit
      // sits between token.reset() and the step-7 latch snapshot.
      manager.eventBus.on('presentation_session_started', () => {
        manager.freezeCombat(reason)
      })

      manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())

      // The replay's filter only strips 'user-pause' and the IDLE-token
      // 'turn-in-flight' - this reason rides through verbatim.
      const carried = manager.getFreezeReasons()
      expect(carried).toContain(reason)

      // Release the mint's own 'not-revealed' latch: the wedge is the
      // foreign reason, not the presentation hold.
      releaseCurrentSessionHold(manager)
      expect(manager.getCombatClockState()).toBe('frozen')
      expect(manager.getFreezeReasons()).toEqual([reason])

      // Wedge evidence: a full claim window produces no pipeline advance.
      clock.advance(COMBAT_STEP_SECONDS * 260)
      expect(manager.getTurnTokenState()).toBe('IDLE')
      expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(0)
      expect(manager.getFreezeReasons()).toEqual([reason])
    },
  )

  it("a 'turn-in-flight' planted in a stage mint's post-step-7 emit lands on the running clock - the strip never sees it", () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')

    // The stage-mint emit lives in mintCombatSessionForLaunch (:2487), which
    // runs AFTER the committed block's step-7 snapshot - a plant here lands
    // directly on the new running clock and never passes the strip. Arming
    // the listener before the stage's own launch exercises exactly that
    // seam.
    manager.eventBus.on('presentation_session_started', () => {
      manager.freezeCombat('turn-in-flight')
    })

    startAStage(manager)

    releaseCurrentSessionHold(manager)
    expect(manager.getFreezeReasons()).toEqual(['turn-in-flight'])
    expect(manager.getCombatClockState()).toBe('frozen')

    // The token is IDLE, so no token transition will ever clear the latch.
    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// (B) r39-COR-2 (Medium) - the post-emit live read of getStartedAtMs() was
//     left out of the r38-AUT-3 snapshot fix. A battle_end listener that
//     mints inside the emit rewrites turnBattleStartedAtMs (fresh: null ->
//     ?? Date.now(); stage: restamped at :2477), so the just-ended battle's
//     clear is recorded at ~0 seconds. First-record semantics mean the bogus
//     0 is permanent, and isValidCycleSeconds' >= 1 floor leaves the stage
//     autofarm-ineligible forever.
// ----------------------------------------------------------------------------

describe('r39 COR - B: recordPerfectClearIfEligible reads the timer binding post-emit', () => {
  const PC_STAGE: Stage = {
    id: 'pc_stage',
    name: 'PC Stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: 'pc_dummy', weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
    perfectClearTurnLimit: 50,
  }
  const PC_ENEMY = defineEnemy({
    id: 'pc_dummy',
    name: 'PC Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })

  function pcHarness() {
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    const player: PlayerData = createDefaultPlayer()
    player.baseStats = asBaseStats({ ...player.baseStats, might: 100 })
    manager.catalogOps.registerEnemyTemplates([PC_ENEMY])
    manager.catalogOps.registerStages([PC_STAGE])
    manager.setActivePlayer(player)
    return { manager, player, clock }
  }

  function driveToVictory(manager: GameManager, clock: ManualClockSource) {
    // The victory emit may synchronously re-mint the live battle, so track
    // the ENDED battle object, not the live slot.
    const battle = manager.getTurnBattle()!
    for (let i = 0; i < 400 && battle.state !== 'victory'; i++) {
      clock.advance(COMBAT_STEP_SECONDS)
    }
    expect(battle.state).toBe('victory')
  }

  it('a fresh mint inside battle_end records a 0-second perfect clear on the ended stage', () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const { manager, player, clock } = pcHarness()

    manager.turnBattleOps.startStage(player, PC_STAGE, false)
    // Wall-clock advances while the battle runs (the honest measurement).
    now += 5000

    let minted = false
    manager.eventBus.on('battle_end', () => {
      if (minted) return
      minted = true
      // Foreign re-mint inside the emit: the fresh policy nulls
      // turnBattleStartedAtMs at :1949, so the post-emit read falls to
      // ?? Date.now() and clearSeconds lands 0.
      manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    })

    driveToVictory(manager, clock)
    expect(minted).toBe(true)

    // The stage binding itself is correctly snapshotted (r38-AUT-3): the
    // record lands on the ENDED battle's stage. What lands wrong is the
    // seconds value - and first-record semantics make it permanent.
    expect(player.perfectClearStageIds).toContain('pc_stage')
    expect(player.perfectClearSeconds['pc_stage']).toBe(0)

    manager.abandonBattle()
  })

  it('control: without a mid-emit mint the same battle records the honest elapsed seconds', () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const { manager, player, clock } = pcHarness()

    manager.turnBattleOps.startStage(player, PC_STAGE, false)
    now += 5000

    driveToVictory(manager, clock)

    expect(player.perfectClearStageIds).toContain('pc_stage')
    expect(player.perfectClearSeconds['pc_stage']).toBe(5)

    manager.abandonBattle()
  })

  it('a stage mint inside battle_end restamps the timer - the ended battle records ~0', () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const { manager, player, clock } = pcHarness()

    const stage2: Stage = {
      id: 'pc_stage_2',
      name: 'PC Stage 2',
      description: '',
      floor: 1,
      enemyPool: [{ enemyId: 'pc_dummy', weight: 1 }],
      totalEnemyCount: 1,
      waves: [1],
      spawnIntervalSeconds: 0,
    }
    manager.catalogOps.registerStages([stage2])

    manager.turnBattleOps.startStage(player, PC_STAGE, false)
    now += 5000

    let minted = false
    manager.eventBus.on('battle_end', () => {
      if (minted) return
      minted = true
      // Stage mint: mintCombatSessionForLaunch restamps
      // turnBattleStartedAtMs = Date.now() at :2477, so the ended battle's
      // post-emit read sees the NESTED launch's timestamp.
      manager.turnBattleOps.startStage(player, stage2, false)
    })

    driveToVictory(manager, clock)
    expect(minted).toBe(true)

    expect(player.perfectClearStageIds).toContain('pc_stage')
    expect(player.perfectClearSeconds['pc_stage']).toBe(0)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) r39-COR-3 (Low) - the drain arm creates the exact window the r38 guard
//     closed on the enqueue arm: during drainBoundaryQueueIfIdle the live
//     boundaryQueue is already empty and the token is IDLE, so a queued
//     command that calls back into a boundary API takes the INLINE arm and
//     lands ahead of commands that were queued before it.
// ----------------------------------------------------------------------------

describe('r39 COR - C: a boundary call inside a draining command runs inline ahead of the batch', () => {
  it('a queued command invoking setBattleManualMode lands before the earlier-queued intent', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token, clock } = parkInteractiveGhost(manager)
    const internals = opsInternals(manager)
    const writes = spyRuntimeFlagWrites(manager)

    // Mid-turn (RESOLVING): a foreign command and a manual toggle queue in
    // order [foreign, applyFalse].
    manager.enqueueAtTurnBoundary(() => {
      // Re-entrant boundary call mid-drain: the live queue is already
      // empty and the token is IDLE, so the INLINE arm runs it now -
      // ahead of the applyFalse command queued before this nested intent
      // existed.
      manager.setBattleManualMode(true)
    })
    manager.setBattleManualMode(false)
    expect(internals.boundaryQueue.length).toBe(2)

    battle.enemies[0]!.entity.currentHp = 1_000_000
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    expect(manager.getTurnTokenState()).toBe('IDLE')

    clock.advance(COMBAT_STEP_SECONDS)

    // Actual drain order: foreign -> nested INLINE true -> queued false.
    // FIFO-correct (nested intent queues behind the batch) would end true.
    expect(writes).toEqual([true, false])
    expect(manager.isBattleManualMode()).toBe(false)
    expect(internals.boundaryQueue.length).toBe(0)
    expect(internals.pendingManualMode).toBeNull()

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (D) r39-COR-4 (Low) - the intent-slot hoist records the LAST-invoked
//     intent in pendingManualMode, but the outer call's queued command is
//     pushed only after its synchronous rescue returns. A nested toggle
//     invoked inside the rescue's pipeline (a listener on an op-resolution
//     emit) enqueues first, so the drain lands the FIRST-invoked intent last
//     - the queue order inverts the invocation order.
// ----------------------------------------------------------------------------

describe('r39 COR - D: a nested toggle inside the stranded rescue inverts queue order', () => {
  it("the later-invoked nested intent enqueues before the outer call's own command", () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')
    const player = startAStage(manager)
    releaseCurrentSessionHold(manager)
    const internals = opsInternals(manager)
    const writes = spyRuntimeFlagWrites(manager)

    // Manual ON while the token is IDLE: the inline arm lands it now, so
    // the next claim parks the actor as a manual AWAITING_INPUT turn.
    manager.setBattleManualMode(true)
    expect(manager.isBattleManualMode()).toBe(true)

    clock.advance(COMBAT_STEP_SECONDS * 260)
    expect(manager.getTurnTokenState()).toBe('AWAITING_INPUT')

    // Outer call (invoked FIRST): setBattleManualMode(false) rescues the
    // stranded manual turn - token submitChoice + the flag write + the
    // re-park's beginTurnPipeline run synchronously. Inside that run
    // notifyReadyActor emits 'turn_ready', which fires the nested caller
    // (invoked SECOND): setBattleManualMode(true) sees a RESOLVING token
    // and queues its command BEFORE the outer call's own.
    let nested = false
    manager.eventBus.on('turn_ready', () => {
      if (nested) return
      nested = true
      manager.setBattleManualMode(true)
    })

    manager.setBattleManualMode(false)
    expect(nested).toBe(true)

    // Queue order is [applyTrue(nested), applyFalse(outer)] - inverse of
    // the invocation order. pendingManualMode holds the nested (LAST-
    // invoked) intent, which the queued commands will contradict.
    expect(internals.boundaryQueue.length).toBe(2)

    // ACK the re-parked 'ready' so the turn drains, then the next fighting
    // step runs the boundary queue.
    const token2 = manager.getPendingPlaybackToken()!
    manager.acknowledgeTurnReady(token2)
    manager.acknowledgeActionImpact(token2)
    manager.acknowledgeActionComplete(token2)
    if (manager.getTurnBattle()!.state === 'fighting') {
      clock.advance(COMBAT_STEP_SECONDS * 260)
    }

    // Drain lands [true, false]: the flag ends on the FIRST-invoked intent
    // while the slot (had a drop intervened) would have re-landed the
    // nested one - two arms of the same latch disagree.
    expect(writes).toEqual([true, false, true, false])
    expect(manager.isBattleManualMode()).toBe(false)

    manager.abandonBattle()
  })
})

// ----------------------------------------------------------------------------
// (E) r39-COR-5 (Nit) - a FAILED transition into a game route keeps
//     entryStage 'game' through the error-fallback promotion, so the
//     isCombatActive gate still arms the pause curtain while the mounted
//     surface is the error card. Bounded: the error layer covers the
//     curtain visually and the latch dies with the battle's teardown.
// ----------------------------------------------------------------------------

describe('r39 COR - E: failed game-route transitions keep entryStage on the admitted side', () => {
  it('activeRoute error + failedRequest.target combat still derives stage game', () => {
    const routeAdapter = {
      activeRoute: ref('error'),
      phase: ref('idle'),
      targetRoute: ref<string | null>(null),
      error: ref({ failedRequest: { target: 'combat' } }),
    }
    const flow = useBootFlow({} as never, routeAdapter as never)

    // The failedRequest fallback keeps 'game' while the surface is the
    // error card - the isCombatActive gate's 'game' clause still passes.
    expect(flow.stage.value).toBe('game')
  })
})

// ----------------------------------------------------------------------------
// (F) Verified-clean pins.
// ----------------------------------------------------------------------------

describe('r39 COR - F: verified-correct pins', () => {
  it('the isBlocking deferral re-arm keeps exactly one live handle across repeated fires', () => {
    const manager = registeredManager()
    const queue: Array<{ id: number; cb: () => void }> = []
    let seq = 0
    vi.stubGlobal('setTimeout', ((cb: () => void) => {
      const id = ++seq
      queue.push({ id, cb })
      return id
    }) as unknown as typeof setTimeout)
    vi.stubGlobal('clearTimeout', (() => undefined) as unknown as typeof clearTimeout)

    // Park at 'ready' (released, non-blocking), then RE-HOLD the session:
    // the fallback now takes the isBlocking deferral arm - each fire
    // splices the just-fired handle and re-arms a fresh one, so the array
    // stays exactly one deep.
    parkInteractiveGhost(manager)
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)

    const internals = opsInternals(manager)
    const turnsBefore = manager.getTurnBattle()!.totalTurnsElapsed
    expect(internals.pendingStepTimers.length).toBe(1)

    for (let fires = 0; fires < 4; fires++) {
      const armed = queue[queue.length - 1]!
      armed.cb()
      // The hoisted splice retired the fired handle; the deferral re-arm
      // pushed exactly one new live handle. The re-held session keeps
      // isBlocking true, so the deferral arm (not the drive arm) ran: the
      // 'ready' settle entry stays armed and the turn never advanced.
      expect(internals.pendingStepTimers.length).toBe(1)
      expect(internals.pendingStepTimers[0]).not.toBe(armed.id)
      expect(typeof internals.pendingStepDone['ready']).toBe('function')
      expect(manager.getTurnBattle()!.totalTurnsElapsed).toBe(turnsBefore)
    }

    port.release(hold)
    manager.abandonBattle()
  })

  it('a defeat-side mid-emit mint does not credit stage completion to either binding', () => {
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

    const token = manager.getPendingPlaybackToken()!
    const battle = manager.getTurnBattle()!
    const playerEntity = battle.players[0]!

    let minted = false
    manager.eventBus.on('battle_end', () => {
      if (minted) return
      minted = true
      manager.turnBattleOps.startBattleWithPlayer(player, secondEnemy())
    })

    // Player dies: defeat terminal + mid-emit foreign mint. The snapshot
    // is only consumed by the victory branch, so neither stage gets
    // completion credit from a defeat emit.
    playerEntity.entity.alive = false
    playerEntity.alive = false
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)

    expect(minted).toBe(true)
    expect(player.completedStageIds).toEqual([])
    expect(player.perfectClearStageIds).toEqual([])

    manager.abandonBattle()
  })

  it('a non-stranded setBattleManualMode consumes the slot through its queued closure', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { battle, token, clock } = parkInteractiveGhost(manager)
    const internals = opsInternals(manager)

    // Mid-turn, no stranded actor (auto turn): the slot arms at method top
    // and only the queued closure consumes it.
    manager.setBattleManualMode(true)
    expect(internals.pendingManualMode).toBe(true)

    battle.enemies[0]!.entity.currentHp = 1_000_000
    manager.acknowledgeTurnReady(token)
    manager.acknowledgeActionImpact(token)
    manager.acknowledgeActionComplete(token)
    clock.advance(COMBAT_STEP_SECONDS)

    expect(manager.isBattleManualMode()).toBe(true)
    expect(internals.pendingManualMode).toBeNull()

    manager.abandonBattle()
  })
})
