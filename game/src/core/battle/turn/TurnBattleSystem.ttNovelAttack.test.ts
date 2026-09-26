import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'
import { PHAN_CHAN_BASE_RATIO, PHAN_CHAN_BUFF } from '../../../data/buff/TheTuBuffs'
import {
  HUYET_CUONG_CAP,
  HUYET_CUONG_PER_PERCENT,
  LOAN_DAU_MULTIPLIER,
  LOAN_DAU_PAID_HP_BONUS,
  LOAN_DAU_SACRIFICE_RATIO,
  LOAN_DAU,
  buildTheTuKit,
} from '../../../data/skill/TheTuSkills'
import { collectBodyKitModifiers } from '../../the-tu/TheTuKitModifiers'
import { createDefaultPlayer } from '../../player/Player'
import type { EntityVitalsChangedEvent } from '../../combat/EntityVitalsSystem'

// Novel-attack probes (the-tu-beta, clean-round gap): seams the review
// checklists never enumerated - ward-vs-sacrifice channel, dead-holder
// reflect, mirror phan_chan recursion, pay_hp through the charged lane.

const NO_MITIGATION = {
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  finalDamageReductionPercent: 0,
} as const

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ ...NO_MITIGATION })

  const entity = {
    id: 'id',
    name: 'name',
    type: 'enemy',
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
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

interface Fixture {
  battle: TurnBattle
  casterP: TurnBattleParticipant
  enemyP: TurnBattleParticipant
  eventBus: EventBus
  runtime: TurnRuntimeFixture
  system: TurnBattleSystem
}

function makeFixture(
  caster: CombatEntity,
  enemy: CombatEntity,
  extraEnemies: CombatEntity[] = [],
): Fixture {
  const casterP = makeParticipant(caster.id, caster, 10, 0)
  const enemyP = makeParticipant(enemy.id, enemy, 9, 100)
  enemyP.basic = {
    id: 'enemy_hit',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }
  const extraPs = extraEnemies.map((entity, index) => {
    const p = makeParticipant(entity.id, entity, 9, 101 + index)
    p.basic = {
      id: `enemy_hit_${index}`,
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
    return p
  })

  const battle: TurnBattle = {
    players: [casterP],
    enemies: [enemyP, ...extraPs],
    state: 'fighting',
  }
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  const runtime = makeTurnRuntime({
    registry: BUFF_REGISTRY,
    participants: () => [...battle.players, ...battle.enemies],
    combatSystem: combat,
  })
  const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
  return { battle, casterP, enemyP, eventBus, runtime, system }
}

function vitalsLog(eventBus: EventBus): Array<{ reason: string; entityId: string; amount: number }> {
  const log: Array<{ reason: string; entityId: string; amount: number }> = []
  eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
    log.push({ reason: event.reason, entityId: event.entityId, amount: event.amount })
  })
  return log
}

describe('novel attack A — ward can NEVER absorb the sacrifice (cost bypasses ward)', () => {
  it('a fully warded caster still pays the full HP cost - ward untouched, payoff reads the paid HP', () => {
    const caster = createCombatant({
      id: 'caster',
      type: 'player',
      stats: createBaseStats({ ...NO_MITIGATION, might: 100 }),
      currentHp: 10_000,
      maxHp: 10_000,
      currentWard: 50_000,
    })
    const enemy = createCombatant({
      id: 'enemy',
      stats: createBaseStats({ ...NO_MITIGATION }),
      currentHp: 1_000_000,
      maxHp: 1_000_000,
    })
    const f = makeFixture(caster, enemy)
    const kit = buildTheTuKit('cuong_chien', ZERO_MODS, { special: true })
    f.casterP.basic = kit.special!

    const log = vitalsLog(f.eventBus)
    f.system.resolveNextStep(f.battle)

    // The sacrifice is a COST, not damage: 3000 HP leaves HP, ward intact.
    expect(caster.currentWard).toBe(50_000)
    expect(caster.currentHp).toBe(10_000 - 10_000 * LOAN_DAU_SACRIFICE_RATIO)

    const missingFraction = 0.3
    const expectedPerHit =
      100 *
      (LOAN_DAU_MULTIPLIER + 3_000 * LOAN_DAU_PAID_HP_BONUS) *
      (1 + Math.min(HUYET_CUONG_CAP, missingFraction * HUYET_CUONG_PER_PERCENT * 100))
    const hits = log.filter(
      (entry) => entry.entityId === enemy.id && entry.reason === 'damage',
    )
    expect(hits).toHaveLength(3)
    for (const hit of hits) {
      expect(hit.amount).toBeCloseTo(expectedPerHit)
    }
  })
})

describe('novel attack B — a phan_chan holder killed BY the hit still reflects once', () => {
  it('1-HP holder dies to the hit yet the queued reflect still lands (legacy dead-holder semantics)', () => {
    const caster = createCombatant({
      id: 'caster',
      type: 'player',
      stats: createBaseStats({ ...NO_MITIGATION, might: 100 }),
      currentHp: 10_000,
      maxHp: 10_000,
    })
    const enemy = createCombatant({
      id: 'enemy',
      stats: createBaseStats({ ...NO_MITIGATION }),
      currentHp: 1,
      maxHp: 1_000_000,
    })
    const f = makeFixture(caster, enemy)
    f.casterP.basic = { ...LOAN_DAU }
    f.runtime.applyBuff(PHAN_CHAN_BUFF.id, f.enemyP)

    const log = vitalsLog(f.eventBus)
    f.system.resolveNextStep(f.battle)

    expect(enemy.alive).toBe(false)
    const reflects = log.filter(
      (entry) => entry.reason === 'reflection' && entry.entityId === caster.id,
    )
    expect(reflects).toHaveLength(1)
    expect(reflects[0]!.amount).toBeCloseTo(1_000_000 * PHAN_CHAN_BASE_RATIO)
  })
})

describe('novel attack C — mirror phan_chan: a reflect is NOT a hostile action (no recursion)', () => {
  it('both sides hold phan_chan -> exactly ONE reflection total, no ping-pong', () => {
    const caster = createCombatant({
      id: 'caster',
      type: 'player',
      stats: createBaseStats({ ...NO_MITIGATION, might: 100 }),
      currentHp: 10_000,
      maxHp: 10_000,
    })
    const enemy = createCombatant({
      id: 'enemy',
      stats: createBaseStats({ ...NO_MITIGATION }),
      currentHp: 1_000_000,
      maxHp: 1_000_000,
    })
    const f = makeFixture(caster, enemy)
    f.casterP.basic = { ...LOAN_DAU }
    f.runtime.applyBuff(PHAN_CHAN_BUFF.id, f.enemyP)
    f.runtime.applyBuff(PHAN_CHAN_BUFF.id, f.casterP)

    const log = vitalsLog(f.eventBus)
    f.system.resolveNextStep(f.battle)

    const reflectsOnCaster = log.filter(
      (entry) => entry.reason === 'reflection' && entry.entityId === caster.id,
    )
    const reflectsOnEnemy = log.filter(
      (entry) => entry.reason === 'reflection' && entry.entityId === enemy.id,
    )
    // Enemy's mark reflects the hostile action once; the reflection op
    // itself never re-opens a window on the caster's own mark.
    expect(reflectsOnCaster).toHaveLength(1)
    expect(reflectsOnCaster[0]!.amount).toBeCloseTo(1_000_000 * PHAN_CHAN_BASE_RATIO)
    expect(reflectsOnEnemy).toHaveLength(0)
  })
})

describe('novel attack D — pay_hp through the charged lane pays + binds identically', () => {
  it('a charged resolve still sacrifices BEFORE the hit and pays the floored actual amount', () => {
    const caster = createCombatant({
      id: 'caster',
      type: 'player',
      stats: createBaseStats({ ...NO_MITIGATION, might: 100 }),
      currentHp: 100,
      maxHp: 10_000,
    })
    const enemy = createCombatant({
      id: 'enemy',
      stats: createBaseStats({ ...NO_MITIGATION }),
      currentHp: 1_000_000,
      maxHp: 1_000_000,
    })
    const f = makeFixture(caster, enemy)
    const kit = buildTheTuKit('cuong_chien', ZERO_MODS, { special: true })
    f.casterP.special = { skill: kit.special!, remainingCooldownTurns: 0 }
    f.casterP.chargingTurnsRemaining = 1
    f.casterP.pendingChargedSkillId = kit.special!.id

    const log = vitalsLog(f.eventBus)
    f.system.resolveNextStep(f.battle)

    // Charged lane must run the same pay-first ordering at the same
    // floor: 100 HP caster pays 99, lands at the actual-paid payoff.
    const sacrifice = log.find(
      (entry) => entry.reason === 'sacrifice' && entry.entityId === caster.id,
    )
    expect(sacrifice).toBeDefined()
    expect(caster.currentHp).toBe(1)

    const missingFraction = 1 - 1 / 10_000
    const expectedPerHit =
      100 *
      (LOAN_DAU_MULTIPLIER + 99 * LOAN_DAU_PAID_HP_BONUS) *
      (1 + Math.min(HUYET_CUONG_CAP, missingFraction * HUYET_CUONG_PER_PERCENT * 100))
    const hits = log.filter(
      (entry) => entry.entityId === enemy.id && entry.reason === 'damage',
    )
    expect(hits).toHaveLength(3)
    for (const hit of hits) {
      expect(hit.amount).toBeCloseTo(expectedPerHit)
    }
  })
})
