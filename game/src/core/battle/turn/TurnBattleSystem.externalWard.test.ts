import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { SON_NHAC, TRAN_AP, PHAN_CHAN, SON_NHAC_WARD_RATIO } from '../../../data/skill/TheTuSkills'
import { SON_NHAC_TURNS } from '../../../data/buff/TheTuBuffs'
import { makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// The Tu Reimagined (plan Task 11, spec section 5.2/7.11, D3/INV-12) -
// Son Nhac's appliesBuffs grant allies the son_nhac_ho_the marker PLUS
// a source-tagged externalWard pool (protection-only, replace-never-
// stack, external-first absorb, ward-break gates on the NATIVE ward).

const NO_MITIGATION = {
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
} as const

function createCombatant(overrides: Partial<CombatEntity> = {}, speed = 10): CombatEntity {
  const stats = createBaseStats({ ...NO_MITIGATION, might: 100, speed })

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

function markers(runtime: TurnRuntimeFixture, participant: TurnBattleParticipant) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === 'son_nhac_ho_the')
}

// A Tran The tank with the full kit + one squishy ally + one enemy.
function makeBattle() {
  const tank = createCombatant({ id: 'tank', type: 'player', x: 5, row: 2, currentHp: 20_000, maxHp: 20_000 }, 10)
  const ally = createCombatant({ id: 'ally', type: 'player', x: 3, row: 4, currentHp: 5_000, maxHp: 5_000 }, 1)
  const enemy = createCombatant({ id: 'enemy', x: 15, row: 2, currentHp: 100_000, maxHp: 100_000 }, 1)

  const tankP = makeParticipant('tank', tank, 10, 0)
  tankP.basic = TRAN_AP
  // Phan Chan is castable in beta - park it emblem-style so the pick
  // order still lands on son_nhac first (this suite tests the ward).
  tankP.special = { skill: { ...PHAN_CHAN, emblemOnly: true }, remainingCooldownTurns: 0 }
  tankP.ultimate = { skill: SON_NHAC, remainingCooldownTurns: 0 }
  const allyP = makeParticipant('ally', ally, 1, 1)
  const enemyP = makeParticipant('enemy', enemy, 1, 0)
  enemyP.basic = {
    id: 'enemy_hit',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }

  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: BUFF_REGISTRY,
    participants: () => [tankP, allyP, enemyP],
    combatSystem: combat,
  })
  const battle: TurnBattle = { players: [tankP, allyP], enemies: [enemyP], state: 'fighting' }
  const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
  return { battle, tankP, allyP, enemyP, combat, system, runtime }
}

describe('son_nhac external ward contract (D3/INV-12)', () => {
  it('cast grants allies (not the tank) marker + externalWard = ratio x tank.maxHp', () => {
    const { battle, tankP, allyP, system, runtime } = makeBattle()

    const step = system.resolveNextStep(battle)

    expect(step.actorId).toBe('tank')
    expect(step.skillId).toBe('son_nhac')
    // Ally holds the marker + pool; the tank holds NEITHER (INV-12).
    expect(markers(runtime, allyP)).toHaveLength(1)
    expect(allyP.entity.externalWard).toEqual({
      sourceId: 'tank',
      amount: 20_000 * SON_NHAC_WARD_RATIO,
    })
    expect(tankP.entity.externalWard).toBeUndefined()
    expect(markers(runtime, tankP)).toHaveLength(0)
    // Native ward untouched by the grant.
    expect(allyP.entity.currentWard).toBe(0)
    expect(allyP.entity.stats.wardMax).toBe(0)
  })

  it('external ward absorbs BEFORE native ward; ward-break reads the native component only', () => {
    const { battle, allyP, enemyP, combat, system } = makeBattle()
    system.resolveNextStep(battle) // tank casts son_nhac

    // Ally: externalWard 5000, native ward 50 -> hit 100 stays fully
    // inside the external pool; native untouched, no ward-break.
    allyP.entity.currentWard = 50
    allyP.entity.baseStats = asBaseStats({ ...allyP.entity.baseStats, wardBreakDamagePercent: 0.5, wardMax: 50 })
    allyP.entity.stats = { ...allyP.entity.stats, wardBreakDamagePercent: 0.5, wardMax: 50 }

    const result = combat.resolveActionHit(enemyP.entity, allyP.entity, { kind: 'physical', multiplier: 1 })

    expect(result.externalWardAbsorbed).toBe(100)
    expect(allyP.entity.externalWard!.amount).toBe(5000 - 100)
    expect(allyP.entity.currentWard).toBe(50)
    expect(result.wardAbsorbed).toBe(100)
    expect(allyP.entity.currentHp).toBe(5000) // no HP lost
  })

  it('external-only absorb with currentWard 0 does NOT proc ward break', () => {
    const { battle, allyP, enemyP, combat, system } = makeBattle()
    system.resolveNextStep(battle)

    allyP.entity.currentWard = 0
    allyP.entity.baseStats = asBaseStats({ ...allyP.entity.baseStats, wardBreakDamagePercent: 0.5, wardMax: 100 })
    allyP.entity.stats = { ...allyP.entity.stats, wardBreakDamagePercent: 0.5, wardMax: 100 }
    const enemyHpBefore = enemyP.entity.currentHp

    const result = combat.resolveActionHit(enemyP.entity, allyP.entity, { kind: 'physical', multiplier: 1 })

    expect(result.externalWardAbsorbed).toBe(100)
    // Ward break (0.5 x wardMax 100 = 50) must NOT fire on external-only absorb.
    expect(enemyP.entity.currentHp).toBe(enemyHpBefore)
  })

  it('native 50 + external 20, hit 100 -> both depleted -> ward-break procs once', () => {
    const { battle, allyP, enemyP, combat, system } = makeBattle()
    system.resolveNextStep(battle)

    // Shrink the grant: recast-level pool of 20 external + 50 native.
    allyP.entity.externalWard = { sourceId: 'tank', amount: 20 }
    allyP.entity.currentWard = 50
    allyP.entity.baseStats = asBaseStats({ ...allyP.entity.baseStats, wardBreakDamagePercent: 0.5, wardMax: 100 })
    allyP.entity.stats = { ...allyP.entity.stats, wardBreakDamagePercent: 0.5, wardMax: 100 }
    const enemyHpBefore = enemyP.entity.currentHp

    const result = combat.resolveActionHit(enemyP.entity, allyP.entity, { kind: 'physical', multiplier: 1 })

    expect(result.externalWardAbsorbed).toBe(20)
    expect(result.wardAbsorbed).toBe(70)
    expect(allyP.entity.currentWard).toBe(0)
    // Native ward just broke -> 0.5 x wardMax 100 = 50 damage back.
    expect(enemyP.entity.currentHp).toBe(enemyHpBefore - 50)
    expect(allyP.entity.currentHp).toBe(5000 - 30)
  })

  it('marker expiry clears the externalWard pool via reconcile', () => {
    const { battle, allyP, system, runtime } = makeBattle()
    system.resolveNextStep(battle)
    expect(allyP.entity.externalWard).toBeDefined()

    // Expire the marker through the holder-turn-end lifecycle boundary.
    for (let i = 0; i < SON_NHAC_TURNS; i += 1) {
      runtime.tickHolderTurnsEnd(allyP.entity.id)
    }
    system.refreshEffectiveStats(battle)

    expect(markers(runtime, allyP)).toHaveLength(0)
    expect(allyP.entity.externalWard).toBeUndefined()
  })

  it('manual marker removal clears the pool; a different-source marker keeps its own pool', () => {
    const { battle, allyP, system, runtime } = makeBattle()
    system.resolveNextStep(battle)

    // Second protector's grant replaces marker + pool wholesale.
    const tank2 = createCombatant({ id: 'tank2', type: 'player', x: 4, row: 3, currentHp: 8_000, maxHp: 8_000 }, 10)
    runtime.applyBuff('son_nhac_ho_the', allyP, makeParticipant('tank2', tank2, 10, 0))
    allyP.entity.externalWard = { sourceId: 'tank2', amount: 8_000 * SON_NHAC_WARD_RATIO }

    expect(markers(runtime, allyP)).toHaveLength(1)
    expect(markers(runtime, allyP)[0]!.sourceId).toBe('tank2')

    // Removing the CURRENT source's marker clears its pool.
    runtime.buffs.remove(
      { kind: 'target_definition', targetId: allyP.entity.id, definitionId: 'son_nhac_ho_the' },
      'scripted',
      runtime.makeCtx(),
    )
    system.refreshEffectiveStats(battle)
    expect(allyP.entity.externalWard).toBeUndefined()
  })

  it('recast replaces the pool (no stacking): a lower re-grant lowers it', () => {
    const { battle, tankP, allyP, system, runtime } = makeBattle()
    system.resolveNextStep(battle)
    expect(allyP.entity.externalWard!.amount).toBe(5000)

    // Simulate a re-grant from a lower-maxHp tank via the same apply path.
    const smallTank = createCombatant({ id: 'tank3', type: 'player', currentHp: 4_000, maxHp: 4_000 }, 10)
    const grantRatio = SON_NHAC.appliesBuffs!.find((a) => a.externalWardGrant)!.externalWardGrant!.sourceMaxHpRatio
    runtime.applyBuff('son_nhac_ho_the', allyP, makeParticipant('tank3', smallTank, 10, 0))
    allyP.entity.externalWard = { sourceId: smallTank.id, amount: smallTank.stats.maxHp * grantRatio }
    system.refreshEffectiveStats(battle)

    expect(allyP.entity.externalWard).toEqual({ sourceId: 'tank3', amount: 1_000 })
    expect(tankP.entity.externalWard).toBeUndefined()
  })

  it('externalWard is exempt from wardMax clamp and never feeds spendWard', () => {
    const { battle, allyP, combat, system } = makeBattle()
    system.resolveNextStep(battle)

    // Ally has wardMax 0 yet holds 5000 external - no regen clamp applies.
    expect(allyP.entity.stats.wardMax).toBe(0)
    expect(allyP.entity.externalWard!.amount).toBe(5_000)

    // spendWard reads currentWard only - external pool invisible to it.
    const wardBefore = allyP.entity.externalWard!.amount
    const spent = combat.spendWard(allyP.entity, 100, 'ward_spend', 'test')
    expect(spent).toBe(0)
    expect(allyP.entity.externalWard!.amount).toBe(wardBefore)
  })
})
