import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { buildTheTuKit } from '../../../data/skill/TheTuSkills'
import { collectTheTuKitModifiers } from '../../the-tu/TheTuKitModifiers'
import { createDefaultPlayer } from '../../player/Player'
import type { ProgressionNode } from '../../progression/ProgressionNode'

// The Tu Reimagined (spec 2026-09-15 section 3.4, plan Task 7) — the
// Cuong Chien missing-HP scalar is an authored damage-field contract,
// NOT a stat: bonus = min(cap, missingFraction x perPercent x 100),
// resolved per hit at impact against the actor's LIVE hp (a Reflection
// or heal landing between hit A and hit B changes the next hit).

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

const MISSING_HP_FIELDS = { missingHpBonusPerMissingPercent: 0.02, missingHpBonusCap: 2.0 } as const

function missingHpSkill(multiplier = 1, extra: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id: 'fixture_missing_hp',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier, ...MISSING_HP_FIELDS },
    targeting: { shape: 'single' },
    ...extra,
  }
}

function makeBattle(skill: TurnSkillDefinition, actor: CombatEntity, enemies: CombatEntity[]) {
  const playerParticipant = makeParticipant('player', actor, 10, 0)
  playerParticipant.basic = skill

  const enemyParticipants = enemies.map((entity, index) => {
    const participant = makeParticipant(entity.id, entity, 8, 100 + index)
    participant.basic = {
      id: 'noop',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 0 },
      targeting: { shape: 'single' },
    }
    return participant
  })

  const battle: TurnBattle = { players: [playerParticipant], enemies: enemyParticipants, state: 'fighting' }

  return { battle, enemyParticipants }
}

function makeActor(currentHp: number, maxHp = 1_000): CombatEntity {
  return createCombatant({
    id: 'player',
    type: 'player',
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 100 }),
    currentHp,
    maxHp,
  })
}

function makeEnemy(id: string): CombatEntity {
  return createCombatant({
    id,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0, defense: 0, endurancePercent: 0, blockChance: 0 }),
  })
}

describe('missing-HP scalar (spec section 3.4)', () => {
  it('full HP -> no bonus (x1)', () => {
    const actor = makeActor(1_000)
    const enemy = makeEnemy('enemy')
    const { battle } = makeBattle(missingHpSkill(), actor, [enemy])

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10).resolveNextStep(battle)

    // might 100 x mult 1 x (1 + 0 bonus) — no armor, no crit.
    expect(1_000_000 - enemy.currentHp).toBe(100)
  })

  it('50% missing -> bonus 0.5 x 0.02 x 100 = 1.0 -> x2 damage', () => {
    const actor = makeActor(500)
    const enemy = makeEnemy('enemy')
    const { battle } = makeBattle(missingHpSkill(), actor, [enemy])

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10).resolveNextStep(battle)

    expect(1_000_000 - enemy.currentHp).toBe(200)
  })

  it('cap respected: 90% missing x 0.05 raw 4.5 -> capped at 1.0 -> x2 total', () => {
    const actor = makeActor(100)
    const enemy = makeEnemy('enemy')
    const skill = missingHpSkill()
    skill.damage = { kind: 'physical', multiplier: 1, missingHpBonusPerMissingPercent: 0.05, missingHpBonusCap: 1.0 }
    const { battle } = makeBattle(skill, actor, [enemy])

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10).resolveNextStep(battle)

    expect(1_000_000 - enemy.currentHp).toBe(200)
  })

  it('re-reads live HP per hit: healing between AOE impacts lowers the next hit bonus', () => {
    const actor = makeActor(500)
    const combat = new CombatSystem(new EventBus())
    const multipliers: number[] = []
    const resolveActionHit = combat.resolveActionHit.bind(combat)
    vi.spyOn(combat, 'resolveActionHit').mockImplementation((source, target, damage, critical) => {
      multipliers.push(damage.multiplier)
      // Reflection/leech-style inter-hit mutation: actor back to full HP.
      source.currentHp = source.maxHp
      return resolveActionHit(source, target, damage, critical)
    })

    const { battle } = makeBattle(
      missingHpSkill(1, { targeting: { shape: 'all_lanes' } }),
      actor,
      [makeEnemy('enemy_a'), makeEnemy('enemy_b')],
    )

    new TurnBattleSystem(combat, 10).resolveNextStep(battle)

    expect(multipliers).toEqual([2, 1])
  })

  it('actions without the fields are unchanged even at low HP', () => {
    const actor = makeActor(100)
    const enemy = makeEnemy('enemy')
    const plainSkill: TurnSkillDefinition = {
      id: 'plain',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }
    const { battle } = makeBattle(plainSkill, actor, [enemy])

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10).resolveNextStep(battle)

    expect(1_000_000 - enemy.currentHp).toBe(100)
  })

  it('node-adjusted def copy (collectTheTuKitModifiers -> buildTheTuKit) increases the scalar', () => {
    const node: ProgressionNode = {
      id: 'tt_scalar_1',
      name: 'scalar',
      type: 'minor',
      insightCost: 1,
      effect: { theTuKitModifiers: { missingHpBonusBonus: 0.01 } },
    }
    const player = createDefaultPlayer()
    player.nodeLevels = { tt_scalar_1: 1 }

    const mods = collectTheTuKitModifiers({ getAll: () => [node] }, player)
    const kit = buildTheTuKit('cuong_chien', mods)

    // 50% missing: 0.5 x (0.02 + 0.01) x 100 = 1.5 -> x2.5 damage.
    const actor = makeActor(500)
    const enemy = makeEnemy('enemy')
    const { battle } = makeBattle(kit.basic, actor, [enemy])

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10).resolveNextStep(battle)

    expect(1_000_000 - enemy.currentHp).toBe(250)
  })
})
