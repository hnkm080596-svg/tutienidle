// QA novel-attack probe (the-tu-beta, clean-B round): seams the pinned
// suite does NOT cover.
//   P1 - release direction of the in-battle gate: the pins cover
//        "rejected while fighting"; nothing pins that the gate RELEASES
//        after the battle ends (sticky-disable leak).
//   P2 - pay_hp at the absolute floor: caster at 1 HP must never
//        self-kill; actual-paid binds to 0 so the payoff reads 0.
// Lives in docs/qa/runs/ so it never moves productStateId; run via
// vitest.probe.config.mts.
import { describe, expect, it } from 'vitest'
import { GameManager } from '../../../../../src/core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../../../../src/core/player/Player'
import { defineEnemy } from '../../../../../src/core/enemy/Enemy'
import { ManualClockSource } from '../../../../../src/core/battle/turn/CombatClock'
import type { ProgressionNode } from '../../../../../src/core/progression/ProgressionNode'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from '../../../../../src/core/battle/turn/TurnBattleSystem'
import type { CombatEntity } from '../../../../../src/core/combat/CombatEntity'
import { CombatSystem } from '../../../../../src/core/combat/CombatSystem'
import { EventBus } from '../../../../../src/core/events/EventBus'
import { asBaseStats, createBaseStats } from '../../../../../src/core/stats/StatBlock'
import { BUFF_REGISTRY } from '../../../../../src/data/buff/BuffRegistry'
import { makeTurnRuntime, type TurnRuntimeFixture } from '../../../../../src/core/battle/turn/testing/TurnRuntimeFixtures'
import {
  buildTheTuKit,
  LOAN_DAU_MULTIPLIER,
  HUYET_CUONG_CAP,
  HUYET_CUONG_PER_PERCENT,
} from '../../../../../src/data/skill/TheTuSkills'
import { collectBodyKitModifiers } from '../../../../../src/core/the-tu/TheTuKitModifiers'
import type { EntityVitalsChangedEvent } from '../../../../../src/core/combat/EntityVitalsSystem'

// ---------- P1 harness (mirrors GameManagerProgressionOps.inBattle.test.ts) ----------
function node(overrides: Partial<ProgressionNode> = {}): ProgressionNode {
  return { id: 'ops_node', name: 'Ops Node', type: 'minor', insightCost: 1, effect: {}, ...overrides }
}
function respecNodes() {
  const root = node({ id: 'ops_root', insightCost: 0 })
  const mid = node({
    id: 'ops_mid', maxLevel: 5, upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: 'ops_root' }],
  })
  return [root, mid]
}
const PUNCHING_BAG = defineEnemy({
  id: 'probe_bag', name: 'Probe Bag', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 1_000_000, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0, evasionRate: 0 },
  rewards: { techniqueMastery: 0, spiritStone: 0 },
})
function setup() {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerProgressionNodes(respecNodes())
  gameManager.catalogOps.registerEnemyTemplates([PUNCHING_BAG])
  const player = createDefaultPlayer()
  gameManager.setActivePlayer(player)
  return { gameManager, player }
}
function own(player: PlayerData, levels: Record<string, number>) {
  for (const [id, level] of Object.entries(levels)) {
    player.nodeLevels[id] = level
    if (!player.purchasedNodeIds.includes(id)) player.purchasedNodeIds.push(id)
  }
}

// ---------- P2 harness (mirrors ttNovelAttack.test.ts) ----------
const NO_MITIGATION = {
  evasionRate: 0, criticalRate: 0, defense: 0, endurancePercent: 0,
  blockChance: 0, finalDamageReductionPercent: 0,
} as const
function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ ...NO_MITIGATION })
  const entity = {
    id: 'id', name: 'name', type: 'enemy', stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0,
    x: 0, row: 2, alive: true, ...overrides,
    baseStats: overrides.baseStats ?? overrides.stats ?? stats,
  } as CombatEntity
  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}
function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}
const ZERO_MODS = collectBodyKitModifiers({ getAll: () => [] }, createDefaultPlayer())
function makeFixture(caster: CombatEntity, enemy: CombatEntity) {
  const casterP = makeParticipant(caster.id, caster, 10, 0)
  const enemyP = makeParticipant(enemy.id, enemy, 9, 100)
  enemyP.basic = {
    id: 'enemy_hit', cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 }, targeting: { shape: 'single' },
  }
  const battle: TurnBattle = { players: [casterP], enemies: [enemyP], state: 'fighting' }
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  const runtime: TurnRuntimeFixture = makeTurnRuntime({
    registry: BUFF_REGISTRY, participants: () => [...battle.players, ...battle.enemies], combatSystem: combat,
  })
  const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
  return { battle, casterP, enemyP, eventBus, runtime, system }
}
function vitalsLog(eventBus: EventBus) {
  const log: Array<{ reason: string; entityId: string; amount: number }> = []
  eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (e) => {
    log.push({ reason: e.reason, entityId: e.entityId, amount: e.amount })
  })
  return log
}

describe('probe P1 — the in-battle gate RELEASES after the battle ends', () => {
  it('upgradeNode rejected while fighting, succeeds after abandonBattle', () => {
    const { gameManager, player } = setup()
    own(player, { ops_root: 1, ops_mid: 1 })
    player.skillInsight = 100

    gameManager.startBattleWithPlayer(player, PUNCHING_BAG)
    expect(gameManager.turnBattleOps.isTurnBattleInProgress()).toBe(true)
    expect(gameManager.progressionOps.upgradeNode('ops_mid', player)).toBe(false)

    expect(gameManager.abandonBattle()).toBe(true)
    expect(gameManager.turnBattleOps.isTurnBattleInProgress()).toBe(false)
    expect(gameManager.progressionOps.upgradeNode('ops_mid', player)).toBe(true)
    expect(player.nodeLevels['ops_mid']).toBe(2)
  })
})

describe('probe P2 — pay_hp at the 1-HP floor can never self-kill and binds paid=0', () => {
  it('a 1-HP caster keeps 1 HP; the sacrifice is skipped and hits bind actual-paid 0', () => {
    const caster = createCombatant({
      id: 'caster', type: 'player',
      stats: createBaseStats({ ...NO_MITIGATION, might: 100 }),
      currentHp: 1, maxHp: 10_000,
    })
    const enemy = createCombatant({
      id: 'enemy', stats: createBaseStats({ ...NO_MITIGATION }),
      currentHp: 1_000_000, maxHp: 1_000_000,
    })
    const f = makeFixture(caster, enemy)
    const kit = buildTheTuKit('cuong_chien', ZERO_MODS, { special: true })
    f.casterP.special = { skill: kit.special!, remainingCooldownTurns: 0 }

    const log = vitalsLog(f.eventBus)
    f.system.resolveNextStep(f.battle)

    // Floor: never self-kills.
    expect(caster.alive).toBe(true)
    expect(caster.currentHp).toBe(1)
    // No payable HP -> sacrifice lane skipped -> no sacrifice vitals event.
    expect(log.find((e) => e.reason === 'sacrifice')).toBeUndefined()
    // Hits still fire; paid binds 0 -> per-hit = might * MULTIPLIER * (1 + huyet at cap).
    const hits = log.filter((e) => e.entityId === enemy.id && e.reason === 'damage')
    const missingFraction = 1 - 1 / 10_000
    const expectedPerHit =
      100 * LOAN_DAU_MULTIPLIER * (1 + Math.min(HUYET_CUONG_CAP, missingFraction * HUYET_CUONG_PER_PERCENT * 100))
    for (const hit of hits) {
      expect(hit.amount).toBeCloseTo(expectedPerHit)
    }
    expect(hits.length).toBeGreaterThan(0)
  })
})
