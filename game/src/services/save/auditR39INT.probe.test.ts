// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../../core/battle/turn/CombatClock'
import { startAStage } from '../../core/game/__fixtures__/startAStage'
import { defineEnemy, enemyToCombatEntity, type Enemy } from '../../core/enemy/Enemy'
import { toTurnBattleParticipant } from '../../core/game/TurnBattleAdapter'
import { enemyBasicAttackFor } from '../../data/skill/TurnBasicAttacks'
import type { Stage } from '../../core/stage/Stage'
import { createDefaultPlayer, type PlayerData } from '../../core/player/Player'
import { asBaseStats } from '../../core/stats/StatBlock'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// ============================================================================
// QA probe - fixpoint r39 INT wave. Blind integration-coherence audit of the
// r38 adjudication at 56098103 (code c3f1503a, codex/hoa-cau-fireball-vfx).
// The r38 batch changed: (F1) step-7 IDLE-token 'turn-in-flight' strip in
// beginBattleCycleCommitted's latch replay, (F2) boundary-queue FIFO guard,
// (F3) drain try/catch in drainBoundaryQueueIfIdle, (F4) hoisted fired-handle
// splice in awaitStep, (F5) intent-slot hoist at setBattleManualMode top,
// (F6) enemyManager.clear() at committed step-1, (F7) stage snapshot before
// publishBattleEnd, (F8) entryStage admission gate for isCombatActive.
//
// INT surface verified here:
//   (A) The two latch-carry arms agree: a legit 'turn-in-flight' on a
//       non-IDLE token carries across setCombatClockSource; a foreign plant
//       inside the mint's emit window is stripped at step-7. Third carry
//       path search: the ONLY verbatim reason-carry sites are
//       setCombatClockSource and beginBattleCycleCommitted step-7;
//       abandon/discard erase reasons via stop() instead (see INT-3).
//   (B) The intent triple (boundaryQueue + pendingManualMode slot +
//       battleManualMode flag): drop re-lands the slot on the flag at
//       combat-over/abandon; the drain consumes the slot last-writer-wins.
//   (C) The hoisted splice vs a same-closure second fire: the settled check
//       runs before the splice, so a stale refire cannot eat the handle
//       freshly armed by the pipeline's next step.
//   (D) enemyManager.clear() ordering vs registry consumers: the clear runs
//       before any spawn of the new cycle; the ONLY live reader is
//       BattleLootSystem.processDefeatedEnemies' deps.enemySystem.get.
//   (E) The snapshot fix's own class, unclosed siblings: getPlayerData(),
//       getStartedAtMs() and the loot-session pendingTechniqueMastery buffer
//       are still read (or wiped) AFTER the emit a nested mint can rebind.
//   (F) assert-bug probes for r39-INT-1/2/3/4 - each is an `it.fails` pin:
//       it goes red the moment the defect is fixed (asserts CORRECT
//       behavior; the suite stays green while the defect stands).
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

interface OpsInternals {
  pendingStepTimers: Array<ReturnType<typeof setTimeout>>
  pendingStepDone: Record<string, (() => void) | undefined>
  pendingManualMode: boolean | null
  boundaryQueue: Array<() => void>
}

interface LootInternals {
  deps: { battleLoot: { pendingTechniqueMastery: number } }
}

function opsInternals(manager: GameManager): OpsInternals {
  return manager.turnBattleOps as unknown as OpsInternals
}

function lootInternals(manager: GameManager) {
  return (
    manager.turnBattleOps as unknown as { rewardOps: LootInternals }
  ).rewardOps.deps.battleLoot
}

function makePlayer(): PlayerData {
  const base = createDefaultPlayer()
  return {
    ...base,
    baseStats: asBaseStats({ ...base.baseStats, might: 100, speed: 100 }),
  }
}

function makeDummyEnemy(id: string, signatureDrops?: Enemy['signatureDrops']) {
  return defineEnemy({
    id,
    name: id,
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
    signatureDrops,
  })
}

/** A parked interactive battle, non-repeat, one turn parked on 'ready'. */
function parkGhost(manager: GameManager) {
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
  expect(manager.getPendingPlaybackToken()).not.toBeNull()
  return { player, battle: battle!, clock, port }
}

/** Drive the renderer ACK surface until `until` holds (microtask drain). */
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

async function flushMicrotasks(rounds = 8): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve()
  }
}

/** Captured setTimeout callbacks - models the dequeued-then-clearTimeout shape. */
let capturedCallbacks: Array<{ handle: ReturnType<typeof setTimeout>; cb: () => void }> = []

function captureTimeouts(): void {
  const inner = globalThis.setTimeout
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(
    ((cb: () => void, ms?: number) => {
      const handle = inner(cb, ms)
      capturedCallbacks.push({ handle, cb })
      return handle
    }) as typeof setTimeout,
  )
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(Date, 'now').mockImplementation(() => 1_725_160_000_000)
  vi.spyOn(Math, 'random').mockReturnValue(0)
  capturedCallbacks = []
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ----------------------------------------------------------------------------
// (A) F1 - the latch-carry arms. Legit carry preserved; foreign plant stripped.
// ----------------------------------------------------------------------------
describe('r39 INT - A: latch-carry arms agree (step-7 vs source swap)', () => {
  it('a legit turn-in-flight on a non-IDLE token carries across setCombatClockSource', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { clock } = parkGhost(manager)

    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')

    const next = new ManualClockSource()
    manager.setCombatClockSource(next)

    // Non-IDLE at the snapshot: the reason is the token's own, so the
    // IDLE-token strip must NOT eat it.
    expect(manager.getTurnTokenState()).not.toBe('IDLE')
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')
    expect(manager.getCombatClockState()).toBe('frozen')

    // Resolving the turn still unfreezes the swapped-in clock.
    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    expect(manager.getFreezeReasons()).not.toContain('turn-in-flight')

    manager.discardStaleBattle()
    void clock
  })

  it('a foreign turn-in-flight planted inside the mint emit window is stripped at step-7', () => {
    const manager = registeredManager()
    parkGhost(manager)

    // A battle_end-free mint path: replace the live battle with a fresh
    // mint whose presentation_session_started emit plants the foreign
    // reason while the token is already reset to IDLE.
    manager.eventBus.on('presentation_session_started', () => {
      manager.freezeCombat('turn-in-flight')
    })

    const player = makePlayer()
    manager.turnBattleOps.startBattleWithPlayer(player, makeDummyEnemy('plant_mint'))

    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.getFreezeReasons()).not.toContain('turn-in-flight')
    // 'not-revealed' is the owned post-mint freeze (fresh session not yet
    // revealed) - any remaining freeze is that one, not the planted wedge.
    expect(manager.getFreezeReasons()).toContain('not-revealed')

    manager.discardStaleBattle()
  })

  it('a plant on the OLD clock set before the mint is equally stripped (IDLE at read)', async () => {
    const manager = registeredManager()
    parkGhost(manager)

    // Resolving the parked turn brings the token to IDLE; a plant now
    // wedges the current clock until something resumes it.
    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    manager.freezeCombat('turn-in-flight')
    expect(manager.getFreezeReasons()).toContain('turn-in-flight')
    expect(manager.getCombatClockState()).toBe('frozen')

    // A fresh mint with the plant still latched: the step-7 snapshot sees
    // IDLE + foreign reason and strips it.
    manager.turnBattleOps.startBattleWithPlayer(makePlayer(), makeDummyEnemy('after_plant'))
    expect(manager.getFreezeReasons()).not.toContain('turn-in-flight')

    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (B) F2/F5 - the intent triple: queue + slot + flag invariants pairwise.
// ----------------------------------------------------------------------------
describe('r39 INT - B: queue + slot + flag stay pairwise consistent', () => {
  it('queued double-toggle drains in FIFO order; flag lands last intent; slot empties', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const { clock } = parkGhost(manager)
    const ops = opsInternals(manager)

    manager.setBattleManualMode(true)
    manager.setBattleManualMode(false)

    // Both closures queue behind the live turn; the slot mirrors the LAST
    // top-of-method write (false), not the queued pair.
    expect(ops.boundaryQueue.length).toBe(2)
    expect(ops.pendingManualMode).toBe(false)

    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    clock.advance(COMBAT_STEP_SECONDS * 260)
    await flushMicrotasks()

    expect(ops.boundaryQueue.length).toBe(0)
    expect(ops.pendingManualMode).toBeNull()
    expect(manager.isBattleManualMode()).toBe(false)

    manager.discardStaleBattle()
  })

  it('a queued toggle then combat-over re-lands the slot onto the flag via dropBoundaryQueue', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)
    const ops = opsInternals(manager)

    manager.setBattleManualMode(true)
    expect(ops.pendingManualMode).toBe(true)
    expect(ops.boundaryQueue.length).toBe(1)

    // Force a terminal state: the queue drops and the slot re-lands on
    // the session flag (intent survives the battle that queued it).
    const battle = manager.getTurnBattle()!
    battle.state = 'defeat'
    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    await flushMicrotasks()

    expect(ops.boundaryQueue.length).toBe(0)
    expect(ops.pendingManualMode).toBeNull()
    expect(manager.isBattleManualMode()).toBe(true)

    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (C) F4 - the hoisted splice vs a same-closure second fire.
// ----------------------------------------------------------------------------
describe('r39 INT - C: same-closure refire dies before the splice', () => {
  it('a second fire of the same fallback cannot splice the handle a later step just armed', async () => {
    vi.useFakeTimers()
    captureTimeouts()
    const manager = registeredManager()
    parkGhost(manager)
    const ops = opsInternals(manager)

    const readyFallback = capturedCallbacks.at(-1)!
    expect(ops.pendingStepDone['ready']).toBeTypeOf('function')

    // First fire (dequeued-callback shape): settles + drives the 'ready'
    // step; the pipeline advances and arms the NEXT step's timer.
    clearTimeout(readyFallback.handle)
    readyFallback.cb()
    await flushMicrotasks()

    const nextArmed = capturedCallbacks.at(-1)
    const timersAfterDrive = ops.pendingStepTimers.length
    const doneKeysAfterDrive = Object.keys(ops.pendingStepDone).length

    // Second fire of the SAME closure: the ===undefined settled check
    // must kill it BEFORE the splice - the handle just armed by the next
    // step is not eaten.
    readyFallback.cb()
    await flushMicrotasks()

    expect(ops.pendingStepTimers.length).toBe(timersAfterDrive)
    expect(Object.keys(ops.pendingStepDone).length).toBe(doneKeysAfterDrive)
    expect(ops.pendingStepTimers).toContain(nextArmed?.handle)

    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (D) F6 - enemyManager.clear() ordering vs registry consumers.
// ----------------------------------------------------------------------------
describe('r39 INT - D: committed clear ordering vs the shared registry', () => {
  it('committed step-1 clear sweeps the outgoing battle leftovers; the new mint spawn registers after it', () => {
    const manager = registeredManager()
    const { battle } = parkGhost(manager)

    // A registry entry owned by the outgoing battle / a stray spawn:
    // the committed clear must sweep it.
    const stray = manager.turnBattleOps.spawnEnemy(makeDummyEnemy('stray_spawn'))
    expect(manager.enemySystem.get(stray.id)).toBeTruthy()
    const outgoingEnemyIds = battle.enemies.map((enemy) => enemy.entity.id)

    // Re-mint: the committed clear runs BEFORE the new cycle's own spawn
    // registration, so the new enemy must still be present after the mint.
    const player = makePlayer()
    const freshEnemy = makeDummyEnemy('fresh_spawn')
    manager.turnBattleOps.startBattleWithPlayer(player, freshEnemy)

    const newBattle = manager.getTurnBattle()!
    const newEnemyId = newBattle.enemies[0]?.entity.id

    expect(manager.enemySystem.get(stray.id)).toBeUndefined()
    for (const id of outgoingEnemyIds) {
      expect(manager.enemySystem.get(id)).toBeUndefined()
    }
    expect(newEnemyId).toBeTruthy()
    expect(manager.enemySystem.get(newEnemyId!)).toBeTruthy()

    manager.discardStaleBattle()
  })

  // r39-INT-2 - ASSERT-BUG: a listener minting inside the kill batch's own
  // emit ('reward_particle' at BattleLootSystem per-kill grant) runs the
  // nested committed mint's enemyManager.clear() mid-iteration; every
  // kill AFTER that emit hits enemySystem.get -> undefined and skips its
  // entire drop block while still being marked rewardGranted.
  it.fails('a mid-batch mint must not cancel the rest of the batch drops', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99) // pool lines miss; signature (chance 1) lands
    const manager = registeredManager()

    const player = makePlayer()
    manager.setActivePlayer(player)
    const tplA = makeDummyEnemy('batch_a', [
      { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: { min: 1, max: 1 }, chance: 1 },
    ])
    const tplB = makeDummyEnemy('batch_b', [
      { kind: 'material', itemId: 'tinh_hoa_pham_the', amount: { min: 1, max: 1 }, chance: 1 },
    ])
    manager.catalogOps.registerEnemyTemplates([tplA, tplB])
    manager.turnBattleOps.startBattleWithPlayer(player, tplA)

    const battle = manager.getTurnBattle()!
    // Register a second dead enemy in the same battle so one
    // processDefeatedEnemies call pays both.
    const spawnedB = manager.turnBattleOps.spawnEnemy(tplB)
    const entityB = enemyToCombatEntity(spawnedB)
    battle.enemies.push(toTurnBattleParticipant(entityB, 1, enemyBasicAttackFor(entityB)))
    for (const enemy of battle.enemies) {
      enemy.entity.alive = false
      enemy.alive = false
    }

    let minted = false
    manager.eventBus.on('reward_particle', () => {
      if (!minted) {
        minted = true
        manager.turnBattleOps.startBattleWithPlayer(player, makeDummyEnemy('nested_mint'))
      }
    })

    manager.turnBattleOps.rewardOps.grantBattleRewardIfNeeded()
    expect(minted).toBe(true)

    // Both kills carried the same guaranteed signature material. The
    // second kill is consumed unpaid (rewardGranted set, get() undefined
    // after the nested clear) - correct behavior pays both.
    expect(manager.materialBag.getAmount('tinh_hoa_pham_the')).toBe(2)

    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (E) F7 - the stage snapshot fix vs the same class's remaining live reads.
// ----------------------------------------------------------------------------
describe('r39 INT - E: post-emit live reads a nested mint still rebinds', () => {
  const pcStage: Stage = {
    id: 'pc_stage',
    name: 'pc_stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: 'pc_dummy', weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
    perfectClearTurnLimit: 10,
  }

  function startPerfectClearStage(manager: GameManager) {
    const player = makePlayer()
    manager.catalogOps.registerEnemyTemplates([makeDummyEnemy('pc_dummy')])
    manager.catalogOps.registerStages([pcStage])
    manager.setActivePlayer(player)
    if (!manager.turnBattleOps.startStage(player, pcStage, false)) {
      throw new Error('pc stage mint failed')
    }
    return player
  }

  function forceVictory(manager: GameManager) {
    const battle = manager.getTurnBattle()!
    battle.state = 'victory'
    battle.roundsElapsed = 1
  }

  // r39-INT-1a - ASSERT-BUG: a battle_end listener minting a raw-entity
  // 'test' battle leaves playerDataForTurnBattle null, so the POST-emit
  // getPlayerData() inside recordPerfectClearIfEligible drops a perfect
  // clear that the PRE-emit playerData write (completedStageIds) still
  // credits - the same misattribution class the stage snapshot fixed.
  it.fails('perfect clear credits the battle that finished even when a listener mints mid-emit', () => {
    const manager = registeredManager()
    const player = startPerfectClearStage(manager)
    forceVictory(manager)

    manager.eventBus.on('battle_end', () => {
      // raw-entity 'test' mint inside the emit: playerDataForTurnBattle -> null
      manager.turnBattleOps.startBattle(
        enemyToCombatEntity(manager.turnBattleOps.spawnEnemy(makeDummyEnemy('test_p'))),
        makeDummyEnemy('test_e'),
      )
    })

    manager.turnBattleOps.rewardOps.grantBattleRewardIfNeeded()

    // The pre-emit read still credits the completion (playerData was
    // captured before the emit) - proving the branch ran.
    expect(player.completedStageIds).toContain('pc_stage')
    // The post-emit getPlayerData() read sees the nested mint's null and
    // the perfect clear is silently dropped.
    expect(player.perfectClearStageIds).toContain('pc_stage')

    manager.discardStaleBattle()
  })

  // r39-INT-1b - ASSERT-BUG: pendingTechniqueMastery is consumed at :164
  // AFTER publishBattleEnd; a nested mint's beginBattle() zeroes the
  // buffer mid-function, so the victory settle pays nothing.
  it.fails('pending technique mastery survives a listener mint inside battle_end', () => {
    const manager = registeredManager()
    startPerfectClearStage(manager)
    const spy = vi.spyOn(manager.techniqueSystem, 'gainMastery')
    lootInternals(manager).pendingTechniqueMastery = 7
    forceVictory(manager)

    manager.eventBus.on('battle_end', () => {
      manager.turnBattleOps.startBattleWithPlayer(makePlayer(), makeDummyEnemy('nested_e'))
    })

    manager.turnBattleOps.rewardOps.grantBattleRewardIfNeeded()

    expect(spy).toHaveBeenCalledWith(7, 'mortal', expect.anything())

    manager.discardStaleBattle()
  })
})

// ----------------------------------------------------------------------------
// (F) Siblings of each fixed class that the batch left unclosed.
// ----------------------------------------------------------------------------
describe('r39 INT - F: unclosed siblings of the fixed classes', () => {
  // r39-INT-3 - ASSERT-BUG: abandonBattle/discardInFlightBattle stop() the
  // clock, which erases owner-held latches ('authority-pause',
  // 'tab-hidden') without notifying their owners. The next mint's step-7
  // snapshot is therefore EMPTY - an abandon->restart inside an owned
  // pause window runs the new battle unlatched while the pause surface
  // still believes it is paused. Reachability in production is narrow:
  // the authority overlay inerts every surface during reconnect/terminal
  // pauses, but the update-install flush pause (useUpdates pauseAdmission)
  // shows no overlay, and the seam is also live for any programmatic
  // abandon under an owned freeze.
  it.fails('an owned authority-pause latch carries through abandon -> restart', () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    parkGhost(manager)

    manager.freezeCombat('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    expect(manager.abandonBattle()).toBe(true)
    startAStage(manager, { stageId: 'post_abandon' })

    // The pause owner never released - the new clock should still be held.
    expect(manager.getFreezeReasons()).toContain('authority-pause')
    expect(manager.getCombatClockState()).toBe('frozen')

    manager.discardStaleBattle()
  })

  // r39-INT-4 - ASSERT-BUG: reentrant setBattleManualMode inside the
  // stranded-rescue's synchronous emit window overtakes the outer call's
  // queued closure. Outer setBattleManualMode(false) runs the rescue
  // (submitChoice -> RESOLVING -> flag=false -> beginTurnPipeline); the
  // pipeline's 'ready' step emits turn_ready synchronously, inside which a
  // nested setBattleManualMode(true) enqueues closure_true BEFORE the
  // outer call enqueues closure_false. The drain then applies enqueue
  // order [true, false] - enqueue order != intent order - and the flag
  // ends on the STALE intent.
  it.fails('a mid-rescue reentrant toggle keeps last intent (FIFO by intent, not enqueue order)', async () => {
    vi.useFakeTimers()
    const manager = registeredManager()
    const clock = new ManualClockSource()
    manager.setCombatClockSource(clock)
    manager.setPresentationActive(true)
    manager.setPresentationMode('interactive')

    // Arm manual mode BEFORE the mint so the first claim routes to
    // AWAITING_INPUT - the stranded-rescue precondition.
    manager.setBattleManualMode(true)
    startAStage(manager)
    const port = manager.getPresentationPort()
    const hold = port.hold(port.getCurrentSession()!)!
    port.attach(hold)
    port.release(hold)
    clock.advance(COMBAT_STEP_SECONDS * 260)
    await flushMicrotasks()

    expect(manager.getTurnTokenState()).toBe('AWAITING_INPUT')

    // The rescue's beginTurnPipeline emits turn_ready synchronously; the
    // nested toggle inside it is the LATER intent.
    let nestedRan = false
    manager.eventBus.on('turn_ready', () => {
      if (!nestedRan) {
        nestedRan = true
        manager.setBattleManualMode(true)
      }
    })

    manager.setBattleManualMode(false)
    expect(nestedRan).toBe(true)

    // Resolve the turn so the queued pair drains at the next boundary.
    await driveAcks(manager, () => manager.getTurnTokenState() === 'IDLE')
    clock.advance(COMBAT_STEP_SECONDS * 260)
    await flushMicrotasks()

    const ops = opsInternals(manager)
    expect(ops.boundaryQueue.length).toBe(0)
    // The later intent (true) must win; today the stale outer closure
    // lands last and leaves the flag false.
    expect(manager.isBattleManualMode()).toBe(true)

    manager.discardStaleBattle()
  })
})
