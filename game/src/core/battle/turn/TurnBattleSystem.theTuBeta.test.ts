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
  PHAN_CHAN,
  TRAN_AP,
  TRAN_AP_MAXHP_RATIO,
  TRAN_AP_MULTIPLIER,
  buildTheTuKit,
} from '../../../data/skill/TheTuSkills'
import { collectBodyKitModifiers } from '../../the-tu/TheTuKitModifiers'
import { createDefaultPlayer } from '../../player/Player'
import type { EntityVitalsChangedEvent } from '../../combat/EntityVitalsSystem'

// The Tu beta pin tests (the-tu-body-pathway-design) - the runtime seams
// the spec demands evidence for: Loan Dau's pay-first ordering, the 1-HP
// floor, actual-vs-nominal payoff, Huyet Cuong's kit-local scope, Tran
// Ap's Max-HP authority, and Phan Chan's all-enemy taunt+mark cast.

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

/** One player caster + one enemy; caster acts first (speed 10 vs 9). */
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

describe('loan_dau — sacrifice ordering, 1-HP floor, actual-paid payoff', () => {
  it('pays %MAX HP BEFORE the hits land: sacrifice vitals precede target damage in the same action', () => {
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
    // The post-TC clone carries Huyet Cuong's missing-HP fields - the
    // order proof below reads the damage THROUGH the new missing state.
    const kit = buildTheTuKit('cuong_chien', ZERO_MODS, { special: true })
    f.casterP.basic = kit.special!

    const log = vitalsLog(f.eventBus)
    f.system.resolveNextStep(f.battle)

    const sacrificeIndex = log.findIndex(
      (entry) => entry.reason === 'sacrifice' && entry.entityId === caster.id,
    )
    const firstEnemyHit = log.findIndex(
      (entry) => entry.entityId === enemy.id && entry.reason === 'damage',
    )

    expect(sacrificeIndex).toBeGreaterThanOrEqual(0)
    expect(firstEnemyHit).toBeGreaterThan(sacrificeIndex)

    // Paid = ratio x MAX HP (not current): 10_000 x 0.3 = 3_000.
    expect(caster.currentHp).toBe(10_000 - 10_000 * LOAN_DAU_SACRIFICE_RATIO)

    // Ordering proof in damage terms: the post-sacrifice missing-HP
    // state (30% missing -> +45% at 0.015/%) feeds THIS cast's hits, and
    // the payoff reads the ACTUAL paid amount (3000 x 0.006 = 18).
    const missingFraction = 0.3
    const expectedPerHit =
      100 *
      (LOAN_DAU_MULTIPLIER + 3_000 * LOAN_DAU_PAID_HP_BONUS) *
      (1 + Math.min(HUYET_CUONG_CAP, missingFraction * HUYET_CUONG_PER_PERCENT * 100))

    const hits = log.filter(
      (entry) => entry.entityId === enemy.id && entry.reason === 'damage',
    )
    // Ordered multi-hit: exactly the authored instance count.
    expect(hits).toHaveLength(3)
    for (const hit of hits) {
      expect(hit.amount).toBeCloseTo(expectedPerHit)
    }
  })

  it('the payment floors at leaving 1 HP and uses the ACTUAL paid amount for the payoff', () => {
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
    f.casterP.basic = kit.special!

    const log = vitalsLog(f.eventBus)
    f.system.resolveNextStep(f.battle)

    // Never a self-kill: nominal 3000 pays only 99 (current - 1).
    expect(caster.currentHp).toBe(1)
    expect(caster.alive).toBe(true)

    // ACTUAL vs nominal: the payoff must read 99, NOT 3000.
    const missingFraction = 1 - 1 / 10_000
    const expectedPerHit =
      100 *
      (LOAN_DAU_MULTIPLIER + 99 * LOAN_DAU_PAID_HP_BONUS) *
      (1 + Math.min(HUYET_CUONG_CAP, missingFraction * HUYET_CUONG_PER_PERCENT * 100))
    const nominalPerHit =
      100 *
      (LOAN_DAU_MULTIPLIER + 3_000 * LOAN_DAU_PAID_HP_BONUS) *
      (1 + Math.min(HUYET_CUONG_CAP, missingFraction * HUYET_CUONG_PER_PERCENT * 100))

    const hits = log.filter(
      (entry) => entry.entityId === enemy.id && entry.reason === 'damage',
    )
    expect(hits).toHaveLength(3)
    for (const hit of hits) {
      expect(hit.amount).toBeCloseTo(expectedPerHit)
      expect(hit.amount).not.toBeCloseTo(nominalPerHit)
    }
  })

  it('a hostile multi-hit action into a phan_chan holder still produces exactly ONE reflect', () => {
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

    const log = vitalsLog(f.eventBus)
    f.system.resolveNextStep(f.battle)

    const reflects = log.filter(
      (entry) => entry.reason === 'reflection' && entry.entityId === caster.id,
    )
    // The self-pay never reflects (sacrifice/self-hit is not an eligible
    // action); the 3-hit hostile action merges to ONE reflect.
    expect(reflects).toHaveLength(1)
    expect(reflects[0]!.amount).toBeCloseTo(1_000_000 * PHAN_CHAN_BASE_RATIO)
  })
})

describe('tran_ap — Max-HP authority + AoE', () => {
  it('hits EVERY valid enemy and scales with caster maxHp (might contributes zero at might 0)', () => {
    const caster = createCombatant({
      id: 'caster',
      type: 'player',
      stats: createBaseStats({ ...NO_MITIGATION, might: 0 }),
      currentHp: 10_000,
      maxHp: 10_000,
    })
    const enemyA = createCombatant({
      id: 'enemy_a',
      stats: createBaseStats({ ...NO_MITIGATION }),
      currentHp: 100_000,
      maxHp: 100_000,
    })
    const enemyB = createCombatant({
      id: 'enemy_b',
      stats: createBaseStats({ ...NO_MITIGATION }),
      currentHp: 100_000,
      maxHp: 100_000,
      row: 4,
    })
    const f = makeFixture(caster, enemyA, [enemyB])
    f.casterP.basic = { ...TRAN_AP }

    f.system.resolveNextStep(f.battle)

    // (might 0 + 10_000 x 0.3) x 0.4 = 1_200 per enemy - Max HP is the
    // whole authority here; no might term exists at might 0.
    const expected = 10_000 * TRAN_AP_MAXHP_RATIO * TRAN_AP_MULTIPLIER
    expect(100_000 - enemyA.currentHp).toBeCloseTo(expected)
    expect(100_000 - enemyB.currentHp).toBeCloseTo(expected)
  })
})

describe('phan_chan — the cast applies taunt + mark to EVERY enemy (no direct damage)', () => {
  it('khiem_khich + chan_an land on all enemies; enemy HP untouched', () => {
    const caster = createCombatant({
      id: 'caster',
      type: 'player',
      stats: createBaseStats({ ...NO_MITIGATION, might: 0 }),
      currentHp: 10_000,
      maxHp: 10_000,
    })
    const enemyA = createCombatant({
      id: 'enemy_a',
      stats: createBaseStats({ ...NO_MITIGATION }),
      currentHp: 100_000,
      maxHp: 100_000,
    })
    const enemyB = createCombatant({
      id: 'enemy_b',
      stats: createBaseStats({ ...NO_MITIGATION }),
      currentHp: 100_000,
      maxHp: 100_000,
      row: 4,
    })
    const f = makeFixture(caster, enemyA, [enemyB])
    f.casterP.basic = { ...PHAN_CHAN }

    f.system.resolveNextStep(f.battle)

    for (const enemy of [enemyA, enemyB]) {
      const ids = f.runtime.buffs.getForTarget(enemy.id).map((i) => i.definitionId)
      expect(ids).toContain('khiem_khich')
      expect(ids).toContain('chan_an')
      expect(enemy.currentHp).toBe(100_000)
    }
  })
})

describe('huyet_cuong — kit-local scope', () => {
  it('the missing-HP scalar bakes onto the CUONG kit only: tran_the clones never carry it', () => {
    const player = createDefaultPlayer()
    player.nodeLevels = { tt_cy: 3 }
    const node = {
      id: 'tt_cy',
      name: 'cuong_y',
      type: 'minor' as const,
      insightCost: 1,
      effect: { bodyKitModifiers: { missingHpBonusBonus: 0.005 } },
    }
    const mods = collectBodyKitModifiers({ getAll: () => [node] }, player)

    const tranKit = buildTheTuKit('tran_the', mods, { special: true })
    expect(tranKit.basic.damage?.missingHpBonusPerMissingPercent).toBeUndefined()
    expect(tranKit.special?.damage?.missingHpBonusPerMissingPercent).toBeUndefined()

    const cuongKit = buildTheTuKit('cuong_chien', mods, { special: true })
    for (const def of [cuongKit.basic, cuongKit.special!]) {
      expect(def.damage?.missingHpBonusPerMissingPercent).toBeCloseTo(
        HUYET_CUONG_PER_PERCENT + 0.005 * 3,
      )
    }
  })
})
