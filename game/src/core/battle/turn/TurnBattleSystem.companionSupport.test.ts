import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant, type TurnCombatRuntime } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { COMPANIONS } from '../../../data/companion/Companions'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// P7-M-G (beta companion roster) - the two beta support kits through the
// REAL definitions + production BUFF_REGISTRY: than_nong heals via
// hpRegenPerTurn stat buffs on allies_except_self (special) and a
// stronger cleanse-carrying HoT (ultimate); khai_minh grants a
// might%/defense% party buff (special) and a marker-bound externalWard
// pool per ally (ultimate). No companion has used the
// allies_except_self/externalWardGrant channels before - the only prior
// precedent is the The Tu SON_NHAC player kit.

const thanNong = COMPANIONS.find((definition) => definition.id === 'than_nong')!
const khaiMinh = COMPANIONS.find((definition) => definition.id === 'khai_minh')!

function createCombatant(id: string, maxHp = 1_000, currentHp?: number): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 10, maxHp })

  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: currentHp ?? maxHp,
    maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity
}

function makeParticipant(id: string, speed: number, priority: number, maxHp?: number, currentHp?: number): TurnBattleParticipant {
  const entity = createCombatant(id, maxHp, currentHp)

  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

function buffsOf(runtime: TurnCombatRuntime, participant: TurnBattleParticipant, id: string) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === id)
}

function noopSkill() {
  return { id: 'noop', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 } as const, targeting: { shape: 'single' } as const }
}

function makeBattle(players: TurnBattleParticipant[]): {
  battle: TurnBattle
  combat: CombatSystem
  runtime: TurnRuntimeFixture
} {
  const enemy = makeParticipant('enemy', 1, 200)
  enemy.basic = noopSkill()

  const battle: TurnBattle = { players, enemies: [enemy], state: 'fighting' }
  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: BUFF_REGISTRY,
    participants: () => [...players, enemy],
    combatSystem: combat,
  })

  return { battle, combat, runtime }
}

function resolveNext(battle: TurnBattle, combat: CombatSystem, runtime: TurnRuntimeFixture) {
  new TurnBattleSystem(combat, 100, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)
}

describe('than_nong — beta healer kit (P7-M-G)', () => {
  it('hoi_phuc_thuat lands than_nong_hoi_phuc on each living ally, never the caster, and the ally heals flat at their next turn', () => {
    const caster = makeParticipant('than_nong', 10, 0)
    const ally = makeParticipant('ally', 9, 100, 1_000, 500)
    caster.basic = thanNong.special

    const { battle, combat, runtime } = makeBattle([caster, ally])

    resolveNext(battle, combat, runtime)

    expect(buffsOf(runtime, ally, 'than_nong_hoi_phuc')).toHaveLength(1)
    expect(buffsOf(runtime, caster, 'than_nong_hoi_phuc')).toHaveLength(0)
    // ARCH-002: statModifier effective at apply, not the holder's next turn.
    expect(ally.entity.stats.hpRegenPerTurn).toBeCloseTo(12)

    resolveNext(battle, combat, runtime) // ally's own turn start -> +12

    expect(ally.entity.currentHp).toBe(512)
  })

  it('recast refreshes the same instance (keep/refresh, maxStacks 1) instead of stacking', () => {
    const caster = makeParticipant('than_nong', 10, 0)
    const ally = makeParticipant('ally', 9, 100)
    caster.basic = thanNong.special

    const { battle, combat, runtime } = makeBattle([caster, ally])

    resolveNext(battle, combat, runtime)
    const first = buffsOf(runtime, ally, 'than_nong_hoi_phuc')

    // Drive the caster again - the ally/enemy turns sit between casts.
    new TurnBattleSystem(combat, 100, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)
    new TurnBattleSystem(combat, 100, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)
    new TurnBattleSystem(combat, 100, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)

    const second = buffsOf(runtime, ally, 'than_nong_hoi_phuc')

    expect(second).toHaveLength(1)
    expect(second[0]!.instanceId).toBe(first[0]!.instanceId)
  })

  it('than_dang ultimate heals bigger AND cleanses control on apply (clearsCcOnApply)', () => {
    const caster = makeParticipant('than_nong', 10, 0)
    const ally = makeParticipant('ally', 9, 100, 1_000, 400)
    caster.basic = thanNong.ultimate

    const { battle, combat, runtime } = makeBattle([caster, ally])

    // The stun must sit on an ALLY - a hard-cc'd caster could never cast.
    runtime.applyBuff('choang', ally, caster)
    expect(buffsOf(runtime, ally, 'choang')).toHaveLength(1)

    resolveNext(battle, combat, runtime)

    expect(buffsOf(runtime, ally, 'choang')).toHaveLength(0)
    expect(buffsOf(runtime, ally, 'than_nong_than_dang_hoi_phuc')).toHaveLength(1)
    expect(ally.entity.stats.hpRegenPerTurn).toBeCloseTo(24)

    resolveNext(battle, combat, runtime) // ally turn start -> +24

    expect(ally.entity.currentHp).toBe(424)
  })
})

describe('khai_minh — beta buffer kit (P7-M-G)', () => {
  it('ho_ve_thuat lands khai_minh_ho_ve on allies only and lifts might/defense by 12% immediately', () => {
    const caster = makeParticipant('khai_minh', 10, 0)
    const ally = makeParticipant('ally', 9, 100)
    const baseMight = ally.entity.stats.might
    const baseDefense = ally.entity.stats.defense
    caster.basic = khaiMinh.special

    const { battle, combat, runtime } = makeBattle([caster, ally])

    resolveNext(battle, combat, runtime)

    expect(buffsOf(runtime, ally, 'khai_minh_ho_ve')).toHaveLength(1)
    expect(buffsOf(runtime, caster, 'khai_minh_ho_ve')).toHaveLength(0)
    expect(ally.entity.stats.might).toBeCloseTo(baseMight * 1.12)
    expect(ally.entity.stats.defense).toBeCloseTo(baseDefense * 1.12)
  })

  it('thanh_an ultimate lands the marker on allies and writes a REPLACE externalWard of 25% caster maxHp on each', () => {
    const caster = makeParticipant('khai_minh', 10, 0, 400) // ward base: 400 maxHp
    const ally = makeParticipant('ally', 9, 100)
    const ally2 = makeParticipant('ally_2', 9, 101)
    caster.basic = khaiMinh.ultimate

    const { battle, combat, runtime } = makeBattle([caster, ally, ally2])

    resolveNext(battle, combat, runtime)

    for (const target of [ally, ally2]) {
      expect(buffsOf(runtime, target, 'khai_minh_thanh_ho')).toHaveLength(1)
      expect(target.entity.externalWard).toEqual({
        sourceId: caster.entity.id,
        amount: 400 * 0.25,
      })
    }

    expect(buffsOf(runtime, caster, 'khai_minh_thanh_ho')).toHaveLength(0)
    expect(caster.entity.externalWard).toBeUndefined()
  })

  it('a recast replaces the marker instance and refreshes the ward pool (never stacks)', () => {
    const caster = makeParticipant('khai_minh', 10, 0, 400)
    const ally = makeParticipant('ally', 9, 100)
    caster.basic = khaiMinh.ultimate

    const { battle, combat, runtime } = makeBattle([caster, ally])

    resolveNext(battle, combat, runtime)
    const first = buffsOf(runtime, ally, 'khai_minh_thanh_ho')

    // Spend part of the pool, then recast - REPLACE refills to full.
    ally.entity.externalWard!.amount = 30
    new TurnBattleSystem(combat, 100, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)
    new TurnBattleSystem(combat, 100, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)
    new TurnBattleSystem(combat, 100, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)

    const second = buffsOf(runtime, ally, 'khai_minh_thanh_ho')

    expect(second).toHaveLength(1)
    expect(second[0]!.instanceId).not.toBe(first[0]!.instanceId)
    expect(ally.entity.externalWard).toEqual({ sourceId: caster.entity.id, amount: 400 * 0.25 })
  })
})
