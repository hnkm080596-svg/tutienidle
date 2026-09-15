import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { PHAN_CHINH_BUFF, PHAN_CHINH_MAXHP_RATIO, PHAN_CHINH_TAKEN_RATIO } from '../../../data/buff/TheTuBuffs'
import { buildTheTuKit } from '../../../data/skill/TheTuSkills'
import { collectTheTuKitModifiers } from '../../the-tu/TheTuKitModifiers'
import { createDefaultPlayer } from '../../player/Player'
import type { ProgressionNode } from '../../progression/ProgressionNode'

// The Tu Reimagined (spec 2026-09-15 section 5.2, plan Task 8, D4/INV-8)
// — phan_chinh Reflection: on a TAKEN hit (hpDamage > 0, not dodged,
// not fully absorbed) the holder deals hpDamage x takenRatio +
// holder.maxHp x maxHpRatio back to the attacker as a terminal damage
// event — no reactive windows open on the attacker side.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  const entity = {
    id: 'id',
    name: 'name',
    type: 'enemy',
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
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
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

const NO_MITIGATION = {
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  finalDamageReductionPercent: 0,
} as const

function makeTank(id: string, overrides: Parameters<typeof createBaseStats>[0] = {}): CombatEntity {
  return createCombatant({
    id,
    type: 'player',
    stats: createBaseStats({ ...NO_MITIGATION, might: 0, ...overrides }),
    currentHp: 10_000,
    maxHp: 10_000,
  })
}

function makeAttacker(id: string, overrides: Parameters<typeof createBaseStats>[0] = {}): CombatEntity {
  return createCombatant({
    id,
    stats: createBaseStats({ ...NO_MITIGATION, might: 100, ...overrides }),
    currentHp: 10_000,
    maxHp: 10_000,
  })
}

// Self-scope noop with NO damage — a x0 physical hit would still floor
// to 1 damage ("tối thiểu 1" in resolveAttack) and pollute the deltas.
const NOOP_PLAYER_BASIC = {
  id: 'tank_noop',
  cooldownTurns: 0,
  targetScope: 'self',
  targeting: { shape: 'single' },
} as const

function makeBattle(tank: CombatEntity, attacker: CombatEntity): { battle: TurnBattle; tankP: TurnBattleParticipant; attackerP: TurnBattleParticipant } {
  const tankP = makeParticipant(tank.id, tank, 10, 0)
  tankP.basic = { ...NOOP_PLAYER_BASIC }

  const attackerP = makeParticipant(attacker.id, attacker, 9, 100)
  attackerP.basic = {
    id: 'enemy_hit',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }

  return {
    battle: { players: [tankP], enemies: [attackerP], state: 'fighting' },
    tankP,
    attackerP,
  }
}

function applyPhanChinh(participant: TurnBattleParticipant, definition = PHAN_CHINH_BUFF): void {
  new BuffSystem(participant.buffs).apply(definition, participant.entity, participant.entity, BUFF_REGISTRY)
}

describe('phan_chinh Reflection (taken-only, terminal)', () => {
  it('taken hit -> reflect lands: hpDamage x takenRatio + holder maxHp x maxHpRatio', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const { battle, tankP } = makeBattle(tank, attacker)
    applyPhanChinh(tankP)

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY)
    // The tank acts first (speed 10) with a noop; the attacker's hit then
    // triggers the reflection.
    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    const expected = 100 * PHAN_CHINH_TAKEN_RATIO + 10_000 * PHAN_CHINH_MAXHP_RATIO
    expect(10_000 - attacker.currentHp).toBe(expected)
    expect(attacker.alive).toBe(true)
  })

  it('dodged hit -> no reflection', () => {
    // Hit chance floors at 5% (Accuracy.ts) — force the roll high so the
    // dodge is deterministic rather than stat-absurd.
    const tank = makeTank('tank', { evasionRate: 1_000_000 })
    const attacker = makeAttacker('enemy', { accuracyRating: 0 })
    const { battle, tankP } = makeBattle(tank, attacker)
    applyPhanChinh(tankP)

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    try {
      const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY)
      system.resolveNextStep(battle)
      system.resolveNextStep(battle)
    } finally {
      random.mockRestore()
    }

    expect(tank.currentHp).toBe(10_000)
    expect(attacker.currentHp).toBe(10_000)
  })

  it('fully ward-absorbed hit -> no reflection (hpDamage = 0 is not taken)', () => {
    const tank = makeTank('tank')
    tank.currentWard = 100_000
    const attacker = makeAttacker('enemy')
    const { battle, tankP } = makeBattle(tank, attacker)
    applyPhanChinh(tankP)

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY)
    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    expect(tank.currentHp).toBe(10_000)
    expect(attacker.currentHp).toBe(10_000)
  })

  it('reflect can kill through the vitals authority', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    attacker.currentHp = 10 // reflect (~215) exceeds this
    const { battle, tankP } = makeBattle(tank, attacker)
    applyPhanChinh(tankP)

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY)
    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    expect(attacker.alive).toBe(false)
    expect(battle.state).toBe('victory')
  })

  it('terminal event: attacker-side phan_chinh does NOT reflect the reflection back', () => {
    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const { battle, tankP, attackerP } = makeBattle(tank, attacker)
    applyPhanChinh(tankP)
    applyPhanChinh(attackerP)

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY)
    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    const firstReflect = 100 * PHAN_CHINH_TAKEN_RATIO + 10_000 * PHAN_CHINH_MAXHP_RATIO
    // Attacker took exactly ONE reflection; if its own emblem fired back
    // the tank would have lost hpDamage > the original 100.
    expect(10_000 - attacker.currentHp).toBe(firstReflect)
    expect(10_000 - tank.currentHp).toBe(100)
  })

  it('node-adjusted emblem clone (collectTheTuKitModifiers) raises the reflect amount', () => {
    const node: ProgressionNode = {
      id: 'tt_reflect_1',
      name: 'reflect',
      type: 'minor',
      insightCost: 1,
      effect: { theTuKitModifiers: { reflectTakenRatioBonus: 0.05, reflectMaxHpRatioBonus: 0.01 } },
    }
    const player = createDefaultPlayer()
    player.nodeLevels = { tt_reflect_1: 1 }

    const mods = collectTheTuKitModifiers({ getAll: () => [node] }, player)
    const kit = buildTheTuKit('tran_the', mods)
    const emblemDef = kit.special.grantsBuffsAtBuild!.find((def) => def.id === 'phan_chinh')!

    const tank = makeTank('tank')
    const attacker = makeAttacker('enemy')
    const { battle, tankP } = makeBattle(tank, attacker)
    applyPhanChinh(tankP, emblemDef)

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY)
    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    const expected =
      100 * (PHAN_CHINH_TAKEN_RATIO + 0.05) + 10_000 * (PHAN_CHINH_MAXHP_RATIO + 0.01)
    expect(10_000 - attacker.currentHp).toBeCloseTo(expected)
  })
})
