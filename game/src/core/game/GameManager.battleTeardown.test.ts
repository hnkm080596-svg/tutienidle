import { describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { CombatEntityId } from '../battle/contracts/ids'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import type { TurnBattle, TurnBattleSystem } from '../battle/turn/TurnBattleSystem'
import type { ReactionVfxResolvedEvent } from '../battle/BattleEvents'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { VAN_PHAP_THAN_HOA_ID } from '../../data/buff/ReactionStatusBuffs'

// P3-M1 - cross-battle teardown audit (production combat vertical
// slice). battleCycle.test.ts proves player-side field freshness; this
// file audits the boundary BETWEEN cycles: every terminal path must
// leave the next battle with fresh per-cycle machinery (buff registry /
// elemental boards / scheduler / runtime minted per cycle by
// mintCycleScheduler + the engine re-mint at beginBattleCycle) and no
// transient state carried over. Leak sentinel: a transient seal applied
// in battle 1 must never appear on battle-2 targets, while expected
// entry buffs (the ngo_dao aura) are freshly RE-granted per battle -
// absence would mean a different leak (entry declarations dropped).

const LING_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

function harness() {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createDefaultPlayer()
  gameManager.setActivePlayer(player)
  return { gameManager, combatSource, player }
}

function createCombatPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 50, speed: 100, criticalRate: 0 })
  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 4,
    alive: true,
  }
}

// A raw entity that dies in one hit - drives a REAL natural defeat
// terminal (engine decides), not the ops-forced abandon path.
function createWeakPlayer(): CombatEntity {
  const stats = createBaseStats({ maxHp: 5, might: 0, speed: 1, criticalRate: 0 })
  return { ...createCombatPlayer(), baseStats: stats, stats, currentHp: 5, maxHp: 5 }
}

const FAST_ENEMY = defineEnemy({
  id: 'teardown_fast_mob', name: 'Fast Mob', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 5, spiritStone: 3 },
})

const STRONG_ENEMY = defineEnemy({
  id: 'teardown_boss', name: 'Teardown Boss', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: {
    maxHp: 1_000_000, might: 9_999, attackSpeed: 1,
    criticalRate: 0, criticalDamage: 1.5, armor: 0, evasionRate: 0,
  },
  rewards: { techniqueInsight: 0, spiritStone: 0 },
})

// Immortal + harmless: a battle against it stays in 'fighting' until
// abandoned, giving a deterministic window for manual seal application
// (no organic procs - the fixture strips skillLevels).
const PUNCHING_BAG = defineEnemy({
  id: 'teardown_bag', name: 'Punching Bag', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: {
    maxHp: 1_000_000, might: 0, attackSpeed: 1,
    criticalRate: 0, criticalDamage: 1.5, armor: 0, evasionRate: 0,
  },
  rewards: { techniqueInsight: 0, spiritStone: 0 },
})

const TEARDOWN_STAGE: Stage = {
  id: 'teardown_stage', name: 'Teardown Stage', description: '',
  floor: 1, enemyPool: [{ enemyId: FAST_ENEMY.id, weight: 1 }],
  totalEnemyCount: 3, waves: [3],
  spawnIntervalSeconds: 0,
}

function makeNgoDaoPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { linh_bao: LING_BAO_L3 }
  return player
}

function registerNgoDaoCatalogs(gameManager: GameManager, player: PlayerData) {
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  gameManager.setActivePlayer(player)
  expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu', 'ngo_dao', player)).toBe(true)
}

function fightUntil(combatSource: ManualClockSource, predicate: () => boolean, label: string) {
  for (let i = 0; i < 3000; i++) {
    if (predicate()) return
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
  throw new Error(`${label}: predicate not reached within 3000 combat steps`)
}

/** Apply a transient canonical seal to the battle-1 enemy through the
    authored op lane - the leak sentinel. */
function applySentinelSeal(gameManager: GameManager) {
  const battle = gameManager.getTurnBattle()!
  const sourceId = battle.players[0]!.entity.id
  const targetId = battle.enemies[0]!.entity.id
  gameManager.turnBattleOps.getTurnBattleSystem().applyBuildBuffs(battle, [
    { definitionId: 'doc_can', sourceId, targetId },
  ])
  return { sourceId, targetId }
}

function buffIds(gameManager: GameManager, entityId: string): string[] {
  return gameManager.getBattleBuffs(entityId as CombatEntityId).map((b) => b.definitionId)
}

/** Count of reaction_resolved entries in a cycle's own scheduler trace
    (the per-cycle journal - freshness oracle for reaction cursor/boards). */
function traceReactionCount(system: TurnBattleSystem | undefined): number {
  return (system?.combatScheduler?.trace.events ?? []).filter(
    (e) => e.type === 'reaction_resolved',
  ).length
}

describe('cross-battle teardown - terminal-path matrix', () => {
  // Every terminal path must produce a fresh second cycle: new battle
  // object, new engine + scheduler instances, zero carried transients,
  // clock counters restarted from zero.
  function expectFreshSecondCycle(
    gameManager: GameManager,
    firstBattle: TurnBattle,
    firstSystem: TurnBattleSystem | undefined,
    options: { expectZeroCounters?: boolean } = {},
  ) {
    const { expectZeroCounters = true } = options
    const second = gameManager.getTurnBattle()
    const secondSystem = gameManager.turnBattleOps.getTurnBattleSystem()
    expect(second).not.toBeNull()
    expect(second).not.toBe(firstBattle)
    // Engine re-mints per cycle (ops:1690) and mintCycleScheduler re-mints
    // the scheduler (op queue + reaction journal live on it) - a stale
    // instance would carry pending work/journal residue forward.
    expect(secondSystem).not.toBeUndefined()
    expect(secondSystem).not.toBe(firstSystem)
    expect(secondSystem!.combatScheduler).not.toBe(firstSystem!.combatScheduler)
    // Clock restart: a synchronous mint always starts both counters at
    // zero. The repeat path mints mid-advance, so it only gets the
    // weaker ordering guarantee.
    if (expectZeroCounters) {
      expect(second!.totalTurnsElapsed ?? 0).toBe(0)
      expect(second!.roundsElapsed ?? 0).toBe(0)
    } else {
      expect(second!.totalTurnsElapsed ?? 0).toBeLessThan(
        firstBattle.totalTurnsElapsed ?? 0,
      )
    }
  }

  it('victory terminal -> next battle is a fresh cycle (no carried transients)', () => {
    const { gameManager, combatSource } = harness()
    const ngoDaoPlayer = makeNgoDaoPlayer()
    registerNgoDaoCatalogs(gameManager, ngoDaoPlayer)
    gameManager.setActivePlayer(ngoDaoPlayer)
    gameManager.catalogOps.registerEnemyTemplates([FAST_ENEMY])
    gameManager.catalogOps.registerStages([TEARDOWN_STAGE])

    expect(gameManager.turnBattleOps.startStage(ngoDaoPlayer, TEARDOWN_STAGE)).toBe(true)
    const first = gameManager.getTurnBattle()!
    const firstEngine = gameManager.turnBattleOps.getTurnBattleSystem()
    const playerId = first.players[0]!.entity.id

    // Battle-1 state: aura granted at entry + a transient seal sentinels
    // the enemy. Both must resolve differently on cycle 2. (Stage-path
    // enemies spawn during intro - poll for the first spawn.)
    const aura1 = gameManager
      .getBattleBuffs(playerId)
      .find((b) => b.definitionId === VAN_PHAP_THAN_HOA_ID)
    expect(aura1).toBeDefined()
    fightUntil(combatSource, () => gameManager.getTurnBattle()!.enemies.length > 0, 'first spawn')
    const { targetId: enemy1 } = applySentinelSeal(gameManager)
    expect(buffIds(gameManager, enemy1)).toContain('doc_can')

    fightUntil(combatSource, () => gameManager.getTurnBattle()!.state === 'victory', 'victory')

    expect(gameManager.turnBattleOps.startStage(ngoDaoPlayer, TEARDOWN_STAGE)).toBe(true)
    const second = gameManager.getTurnBattle()!
    expectFreshSecondCycle(gameManager, first, firstEngine)

    // Transient seal never carried: the cycle-2 enemy (once spawned) has
    // no doc_can; the aura is a FRESH grant - a new instanceId minted by
    // the cycle-2 build's entry declarations (instanceId embeds the
    // per-cycle battleId; a carried registry entry would keep cycle-1's).
    fightUntil(combatSource, () => second.enemies.length > 0, 'cycle-2 first spawn')
    const enemy2 = second.enemies[0]!.entity.id
    expect(buffIds(gameManager, enemy2)).not.toContain('doc_can')
    const aura2 = gameManager
      .getBattleBuffs(second.players[0]!.entity.id)
      .find((b) => b.definitionId === VAN_PHAP_THAN_HOA_ID)
    expect(aura2).toBeDefined()
    expect(aura2!.instanceId).not.toBe(aura1!.instanceId)
  })

  it('natural defeat terminal -> next battle is a fresh cycle', () => {
    const { gameManager, combatSource } = harness()

    gameManager.startBattle(createWeakPlayer(), STRONG_ENEMY)
    const first = gameManager.getTurnBattle()!
    const firstEngine = gameManager.turnBattleOps.getTurnBattleSystem()
    // Sentinel seal on the battle-1 enemy BEFORE the defeat - a leaked
    // buff registry would carry it onto the next battle's state.
    const { targetId: enemy1 } = applySentinelSeal(gameManager)
    expect(buffIds(gameManager, enemy1)).toContain('doc_can')

    fightUntil(
      combatSource,
      () => gameManager.getTurnBattle()!.state === 'defeat',
      'natural defeat',
    )
    expect(gameManager.turnBattleOps.isTurnBattleInProgress()).toBe(false)

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    const second = gameManager.getTurnBattle()!
    expectFreshSecondCycle(gameManager, first, firstEngine)
    expect(buffIds(gameManager, 'player')).not.toContain('doc_can')
    expect(buffIds(gameManager, second.enemies[0]!.entity.id)).not.toContain('doc_can')
  })

  it('abandon -> next battle is a fresh cycle', () => {
    const { gameManager, combatSource } = harness()

    // STRONG_ENEMY keeps the battle in progress long enough to abandon
    // mid-fight (FAST_ENEMY dies in one hit -> early victory).
    gameManager.startBattle(createCombatPlayer(), STRONG_ENEMY)
    const first = gameManager.getTurnBattle()!
    const firstEngine = gameManager.turnBattleOps.getTurnBattleSystem()
    // Let turns actually elapse so the cycle-2 counter reset is
    // observable (intro/countdown steps do not advance the counter).
    fightUntil(combatSource, () => (first.totalTurnsElapsed ?? 0) > 0, 'first turns')
    applySentinelSeal(gameManager)

    expect(gameManager.turnBattleOps.abandonBattle()).toBe(true)
    expect(gameManager.getTurnBattle()!.state).toBe('defeat')
    expect(gameManager.turnBattleOps.isTurnBattleInProgress()).toBe(false)

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    expectFreshSecondCycle(gameManager, first, firstEngine)
    const enemy2 = gameManager.getTurnBattle()!.enemies[0]!.entity.id
    expect(buffIds(gameManager, enemy2)).not.toContain('doc_can')
  })

  it('live replacement -> outgoing battle publishes exactly one battle_end, new cycle fresh', () => {
    const { gameManager } = harness()
    const ends: unknown[] = []
    gameManager.eventBus.on('battle_end', (e) => ends.push(e))

    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    const first = gameManager.getTurnBattle()!
    const firstEngine = gameManager.turnBattleOps.getTurnBattleSystem()
    applySentinelSeal(gameManager)

    // Mid-fight replacement: the outgoing battle must terminalize once
    // (defeat) and the incoming cycle mints clean.
    gameManager.startBattle(createCombatPlayer(), STRONG_ENEMY)
    expect(ends).toHaveLength(1)

    const second = gameManager.getTurnBattle()!
    expectFreshSecondCycle(gameManager, first, firstEngine)
    const enemy2 = second.enemies[0]!.entity.id
    expect(buffIds(gameManager, enemy2)).not.toContain('doc_can')
  })

  it('repeat restart -> auto-minted cycle 2 is fresh (in-place restart)', () => {
    const { gameManager, combatSource, player } = harness()
    gameManager.catalogOps.registerEnemyTemplates([FAST_ENEMY])
    gameManager.catalogOps.registerStages([TEARDOWN_STAGE])

    expect(gameManager.turnBattleOps.startStage(player, TEARDOWN_STAGE, true)).toBe(true)
    const first = gameManager.getTurnBattle()!
    const firstEngine = gameManager.turnBattleOps.getTurnBattleSystem()
    fightUntil(combatSource, () => first.enemies.length > 0, 'first spawn')
    applySentinelSeal(gameManager)

    // Drive to victory; repeat flag auto-restarts in place.
    fightUntil(
      combatSource,
      () => {
        const b = gameManager.getTurnBattle()
        return b !== null && b !== first && b.state !== 'victory'
      },
      'repeat cycle',
    )

    const second = gameManager.getTurnBattle()!
    expectFreshSecondCycle(gameManager, first, firstEngine, { expectZeroCounters: false })
    fightUntil(combatSource, () => second.enemies.length > 0, 'cycle-2 first spawn')
    const enemy2 = second.enemies[0]!.entity.id
    expect(buffIds(gameManager, enemy2)).not.toContain('doc_can')
  })

  it('failed cycle -> discard leaves known-idle; the next battle still works', () => {
    const { gameManager, player } = harness()
    // The survive-guard charge is minted inside beginBattleCycleCommitted
    // (beginBattle(build.survive.talentIds)) AFTER build resolution - a
    // commit that throws mid-resolve must not have half-initialized it.
    player.selectedTalentIds = ['bat_tu_the']

    // Runtime override throws mid-commit -> discardFailedCycle path.
    // The throw propagates to the caller (destructive-failure contract);
    // the teardown it ran is what this test audits.
    gameManager.setPathRuntimeResolver(() => {
      throw new Error('forced mid-cycle failure')
    })
    expect(() => gameManager.startBattleWithPlayer(player, FAST_ENEMY)).toThrow(
      'forced mid-cycle failure',
    )

    expect(gameManager.getTurnBattle()).toBeNull()
    expect(gameManager.turnBattleOps.isTurnBattleInProgress()).toBe(false)
    // The failed cycle never reached the beginBattle charge mint - a
    // half-initialized session would have left a nonzero charge (or a
    // consumed one) behind.
    expect(gameManager.surviveLethalGuard.getRemainingUses()).toBe(0)

    gameManager.setPathRuntimeResolver(undefined)
    gameManager.startBattleWithPlayer(player, FAST_ENEMY)
    expect(gameManager.getTurnBattle()).not.toBeNull()
    expect(gameManager.turnBattleOps.isTurnBattleInProgress()).toBe(true)
    // The successful cycle resolved a fresh build: the talent charge is
    // derived from the new build's survive wiring, not carried state.
    expect(gameManager.surviveLethalGuard.getRemainingUses()).toBe(1)
  })

  it('survive-lethal session re-derives per cycle; a stale activeBuild cannot leak charges', () => {
    const { gameManager, combatSource, player } = harness()
    player.selectedTalentIds = ['bat_tu_the']

    // Battle 1: one charge minted, then consumed by a real lethal hit
    // (weak-odds fight vs STRONG_ENEMY - first lethal consumes the guard,
    // the next ends the battle in a genuine natural defeat).
    gameManager.startBattleWithPlayer(player, STRONG_ENEMY)
    const first = gameManager.getTurnBattle()!
    expect(gameManager.surviveLethalGuard.getRemainingUses()).toBe(1)
    fightUntil(combatSource, () => first.state === 'defeat', 'defeat after consume')
    expect(gameManager.surviveLethalGuard.getRemainingUses()).toBe(0)

    // Battle 2: fresh beginBattle re-derives the charge - a leaked
    // session would have kept the post-consume 0.
    gameManager.startBattleWithPlayer(player, PUNCHING_BAG)
    expect(gameManager.surviveLethalGuard.getRemainingUses()).toBe(1)
    gameManager.turnBattleOps.abandonBattle()

    // Battle 3: build re-resolved from CURRENT player state - a stale
    // activeBuild would still carry bat_tu_the and mint a charge.
    player.selectedTalentIds = []
    gameManager.startBattleWithPlayer(player, PUNCHING_BAG)
    expect(gameManager.surviveLethalGuard.getRemainingUses()).toBe(0)
    gameManager.turnBattleOps.abandonBattle()
  })
})

describe('cross-battle teardown - listener/event audit', () => {
  it('battle_end emits exactly once per ended battle across N cycles (no accumulation, no drop)', () => {
    const { gameManager } = harness()
    const ends: unknown[] = []
    gameManager.eventBus.on('battle_end', (e) => ends.push(e))

    for (let i = 0; i < 3; i++) {
      gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
      gameManager.turnBattleOps.abandonBattle()
    }

    // Each abandoned battle ends exactly once. If listeners accumulated
    // per battle, downstream consumers would see N-multiple emissions;
    // if battle_end dropped, the count would be short.
    expect(ends).toHaveLength(3)
  })

  it('cycle-2 journal/boards/dispatcher are fresh - one seal pair emits exactly one reaction_resolved', () => {
    const { gameManager, combatSource } = harness()
    const ngoDaoPlayer = makeNgoDaoPlayer()
    registerNgoDaoCatalogs(gameManager, ngoDaoPlayer)
    // Strip the granted kit AFTER the ritual: organic skill procs would
    // add their own reactions and blur the count; the oracle needs every
    // reaction to come from the manual pair. The aura grant is
    // capability-driven, not kit-driven.
    ngoDaoPlayer.skillLevels = {}
    gameManager.setActivePlayer(ngoDaoPlayer)

    const resolved: ReactionVfxResolvedEvent[] = []
    gameManager.eventBus.on<ReactionVfxResolvedEvent>('reaction_resolved', (e) =>
      resolved.push(e),
    )

    // Battle 1 - one authored pair -> exactly one emission.
    gameManager.startBattleWithPlayer(ngoDaoPlayer, PUNCHING_BAG)
    const firstSystem = gameManager.turnBattleOps.getTurnBattleSystem()
    const first = gameManager.getTurnBattle()!
    fightUntil(combatSource, () => first.state === 'fighting', 'fighting 1')
    const src1 = first.players[0]!.entity.id
    const tgt1 = first.enemies[0]!.entity.id
    firstSystem.applyBuildBuffs(first, [
      { definitionId: 'doc_can', sourceId: src1, targetId: tgt1 },
      { definitionId: 'tran_an', sourceId: src1, targetId: tgt1 },
    ])
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.reactionId).toBe('xuyen_tho')
    expect(traceReactionCount(firstSystem)).toBe(1)

    gameManager.turnBattleOps.abandonBattle()

    // Battle 2 - the same pair on the new enemy must emit exactly +1:
    //  - a leaked reaction-event cursor would re-emit battle-1's journal
    //    entries on cycle-2's first drain (count 3+, or a duplicate id);
    //  - a leaked per-cycle dispatcher subscription would double-fire the
    //    same application (count 3 on one advance);
    //  - a leaked elemental board would refuse/stack the re-application
    //    instead of resolving xuyen_tho cleanly.
    gameManager.startBattleWithPlayer(ngoDaoPlayer, PUNCHING_BAG)
    const secondSystem = gameManager.turnBattleOps.getTurnBattleSystem()
    const second = gameManager.getTurnBattle()!
    expect(secondSystem).not.toBe(firstSystem)
    expect(secondSystem.combatScheduler).not.toBe(firstSystem.combatScheduler)
    fightUntil(combatSource, () => second.state === 'fighting', 'fighting 2')

    // Fresh journal: cycle-2's trace holds no battle-1 residue.
    expect(traceReactionCount(secondSystem)).toBe(0)

    const src2 = second.players[0]!.entity.id
    const tgt2 = second.enemies[0]!.entity.id
    secondSystem.applyBuildBuffs(second, [
      { definitionId: 'doc_can', sourceId: src2, targetId: tgt2 },
      { definitionId: 'tran_an', sourceId: src2, targetId: tgt2 },
    ])
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(resolved).toHaveLength(2)
    expect(resolved[1]!.reactionId).toBe('xuyen_tho')
    expect(traceReactionCount(secondSystem)).toBe(1)

    // Cycle-2's cursor advanced too - further steps never re-emit.
    combatSource.advance(COMBAT_STEP_SECONDS)
    combatSource.advance(COMBAT_STEP_SECONDS)
    expect(resolved).toHaveLength(2)
  })

  it('per-cycle runtime subscriptions die with the battle - stale battle emits nothing', () => {
    const { gameManager } = harness()
    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    const firstSystem = gameManager.turnBattleOps.getTurnBattleSystem()
    const first = gameManager.getTurnBattle()!

    gameManager.turnBattleOps.abandonBattle()
    gameManager.startBattle(createCombatPlayer(), FAST_ENEMY)
    const second = gameManager.getTurnBattle()!

    // Applying through the FIRST cycle's system must not land on the
    // second battle's registry: the ops lane is the per-cycle mint.
    firstSystem.applyBuildBuffs(first, [
      {
        definitionId: 'doc_can',
        sourceId: 'player',
        targetId: second.enemies[0]!.entity.id,
      },
    ])
    expect(buffIds(gameManager, second.enemies[0]!.entity.id)).not.toContain('doc_can')
  })
})
