import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TurnBattleSystem,
  type TurnBattle,
  type TurnBattleParticipant,
  type TurnDeclaredAction,
} from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { PHAN_KICH, TRO_KICH } from '../../../data/skill/TheTuSkills'
import type { TurnSkillDefinition } from './TurnSkillAction'

// The Tu Reimagined (spec 6.2.2/6.2.3, plan Task 18) — the Phan taken
// window and the Tro ally-action window. Phan: a LANDED hit with
// hpDamage > 0 rolls the defender's onImpactLanded proc (fully absorbed
// is not "taken"). Tro: a player-side action that landed >=1 damaging
// hit gives OTHER living player-side tro_mon holders one roll each,
// queueing tro_kich against the whole landed set — never on the actor's
// own action and never on reactive actions (INV-9).

const NO_MITIGATION = {
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  finalDamageReductionPercent: 0,
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

const BASIC: TurnSkillDefinition = {
  id: 'hit',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

function withMarker(
  p: TurnBattleParticipant,
  buffId: 'phan_mon' | 'tro_mon' | 'ung_the',
  chanceStat: 'counterChance' | 'followUpChance',
  chance: number,
  currentThe: number,
): TurnBattleParticipant {
  p.entity.baseStats = asBaseStats({ ...p.entity.baseStats, [chanceStat]: chance })
  p.entity.stats = { ...p.entity.stats, [chanceStat]: chance }
  p.entity.currentThe = currentThe
  new BuffSystem(p.buffs).apply(BUFF_REGISTRY.get(buffId), p.entity, p.entity, BUFF_REGISTRY)
  return p
}

function declaredAction(
  actorId: string,
  skill: TurnSkillDefinition,
  affected: TurnBattleParticipant[],
  opposingSide: TurnBattleParticipant[],
  actionSource: TurnDeclaredAction['actionSource'] = 'normal',
): TurnDeclaredAction {
  return {
    actorId,
    skillId: skill.id,
    ccBlocked: false,
    isCharging: false,
    chargeResolved: false,
    chargeTargetIds: [],
    chargedSkill: null,
    action: {
      skillId: skill.id,
      skill,
      damage: skill.damage,
      targeting: skill.targeting,
      slot: null,
    },
    opposingSide,
    affected,
    scaledDamage: skill.damage ?? null,
    suddenDeathMultiplier: 1,
    compositePickedSkills: null,
    isFollowUpBypass: false,
    actionSource,
  }
}

function system(): TurnBattleSystem {
  return new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Phan taken window (spec 6.2.2)', () => {
  it('a fully absorbed hit (hpDamage=0, not dodged) rolls NO Phan proc', () => {
    const enemy = createCombatant({ id: 'enemy' })
    const defender = createCombatant({ id: 'defender', type: 'player', currentHp: 100_000, maxHp: 100_000 })
    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    const defenderP = withMarker(makeParticipant('defender', defender, 5, 0), 'phan_mon', 'counterChance', 1, 100)
    defenderP.entity.currentWard = 100_000 // absorbs the whole hit
    const battle: TurnBattle = { players: [defenderP], enemies: [enemyP], state: 'fighting' }
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system().applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(defenderP.entity.currentThe).toBe(100) // no attempt at all
  })

  it('taken-hit income lands BEFORE the window: 10 + 6 funds this hit\'s counter check', () => {
    const enemy = createCombatant({ id: 'enemy' })
    const defender = createCombatant({ id: 'defender', type: 'player', currentHp: 100_000, maxHp: 100_000 })
    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    const defenderP = makeParticipant('defender', defender, 5, 0)
    // ung_the supplies the +6 taken income; phan_mon the counter proc.
    withMarker(defenderP, 'ung_the', 'counterChance', 1, 10)
    withMarker(defenderP, 'phan_mon', 'counterChance', 1, 10)
    const battle: TurnBattle = { players: [defenderP], enemies: [enemyP], state: 'fighting' }
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system().applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    // 10 + 6 (taken income) = 16 >= 15 -> paid, rolled, +20 success.
    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(defenderP.entity.currentThe).toBe(21)
  })

  it('a counter on a dead attacker drops — the queue entry is never pushed', () => {
    const enemy = createCombatant({ id: 'enemy', alive: false })
    const defender = createCombatant({ id: 'defender', type: 'player', currentHp: 100_000, maxHp: 100_000 })
    const enemyP = makeParticipant('enemy', enemy, 10, 100)
    enemyP.entity = { ...enemyP.entity, alive: false }
    enemyP.alive = false
    const defenderP = withMarker(makeParticipant('defender', defender, 5, 0), 'phan_mon', 'counterChance', 1, 100)
    const battle: TurnBattle = { players: [defenderP], enemies: [enemyP], state: 'fighting' }
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system().applyActionImpact(battle, declaredAction('enemy', BASIC, [defenderP], battle.players))

    // Roll succeeded but targetMode 'attacker' resolved to a dead actor.
    expect(battle.queuedFollowUps).toBeUndefined()
  })
})

describe('Tro ally-action window (spec 6.2.3)', () => {
  function makeParty(): {
    battle: TurnBattle
    attackerP: TurnBattleParticipant
    supporterP: TurnBattleParticipant
    enemyP: TurnBattleParticipant
  } {
    const attacker = createCombatant({ id: 'attacker', type: 'player' })
    const supporter = createCombatant({ id: 'supporter', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', currentHp: 100_000, maxHp: 100_000 })
    const attackerP = makeParticipant('attacker', attacker, 10, 0)
    const supporterP = makeParticipant('supporter', supporter, 5, 1)
    const enemyP = makeParticipant('enemy', enemy, 3, 100)
    supporterP.reactivePayloads = { tro_kich: { ...TRO_KICH } }
    return {
      battle: { players: [attackerP, supporterP], enemies: [enemyP], state: 'fighting' },
      attackerP,
      supporterP,
      enemyP,
    }
  }

  it('an ally\'s landed action queues tro_kich on the supporter vs the landed target', () => {
    const { battle, attackerP, supporterP, enemyP } = makeParty()
    withMarker(supporterP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system().applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]).toMatchObject({
      actorId: 'supporter',
      actionSource: 'follow_up',
      payloadSkillId: 'tro_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'ally_action' },
    })
    expect(supporterP.entity.currentThe).toBe(100) // 100 - 15 + 20 capped
  })

  it('ally AoE queues Tro against the whole landed set', () => {
    const { battle, attackerP, supporterP, enemyP } = makeParty()
    const enemy2 = createCombatant({ id: 'enemy2', currentHp: 100_000, maxHp: 100_000 })
    const enemy2P = makeParticipant('enemy2', enemy2, 3, 101)
    battle.enemies.push(enemy2P)
    withMarker(supporterP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const aoe: TurnSkillDefinition = { ...BASIC, id: 'aoe', targeting: { shape: 'all_lanes' } }
    system().applyActionImpact(battle, declaredAction('attacker', aoe, [enemyP, enemy2P], battle.enemies))

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]!.targetIds).toEqual(['enemy', 'enemy2'])
  })

  it('never triggers on the actor\'s own action — a tro_mon holder acting queues nothing', () => {
    const { battle, attackerP, supporterP, enemyP } = makeParty()
    // The ATTACKER carries the marker; only the supporter is other-side.
    withMarker(attackerP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system().applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(attackerP.entity.currentThe).toBe(100)
    expect(supporterP.entity.currentThe).toBeUndefined()
  })

  it('reactive actions never open the window (INV-9) — a counter payload triggers no Tro', () => {
    const { battle, supporterP, enemyP } = makeParty()
    withMarker(supporterP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const counterAction = declaredAction('attacker', BASIC, [enemyP], battle.enemies, 'counter')
    system().applyActionImpact(battle, counterAction)

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(supporterP.entity.currentThe).toBe(100)
  })

  it('a whiffed action (all dodged) opens no window', () => {
    const { battle, supporterP, enemyP } = makeParty()
    enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, evasionRate: 1_000_000 })
    enemyP.entity.stats = { ...enemyP.entity.stats, evasionRate: 1_000_000 }
    withMarker(supporterP, 'tro_mon', 'followUpChance', 1, 100)
    vi.spyOn(Math, 'random').mockReturnValue(0.999) // dodge roll

    system().applyActionImpact(battle, declaredAction('attacker', BASIC, [enemyP], battle.enemies))

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(supporterP.entity.currentThe).toBe(100)
  })

  it('dead landed targets drop out of the queued target set at queue time', () => {
    const { battle, attackerP, supporterP, enemyP } = makeParty()
    const enemy2 = createCombatant({ id: 'enemy2', currentHp: 1, maxHp: 1 })
    const enemy2P = makeParticipant('enemy2', enemy2, 3, 101)
    battle.enemies.push(enemy2P)
    withMarker(supporterP, 'tro_mon', 'followUpChance', 1, 100)
    // enemy2 dies to the first hit (1 HP), enemy survives — queue only vs enemy.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const aoe: TurnSkillDefinition = { ...BASIC, id: 'aoe', targeting: { shape: 'all_lanes' } }
    system().applyActionImpact(battle, declaredAction('attacker', aoe, [enemyP, enemy2P], battle.enemies))

    expect(battle.queuedFollowUps![0]!.targetIds).toEqual(['enemy'])
    expect(attackerP).toBeDefined()
  })
})
