import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'

// The Tu Reimagined (plan Task 6/11) — `appliesBuffs` plural replaces
// the singular appliesBuff: one skill applies several buff defs across
// four target scopes (self / action_targets / allies_except_self /
// all_enemies), each with an optional durationOverride delivered through
// BuffSystem.apply's M10 channel. gaugeDelta pushes stay per-definition.

function createCombatant(id: string): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 10 })

  return {
    id,
    name: id,
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity
}

function makeParticipant(id: string, speed: number, priority: number): TurnBattleParticipant {
  const entity = createCombatant(id)

  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

class MapCatalog implements BuffDefinitionCatalog {
  constructor(private readonly defs: BuffDefinition[]) {}
  get(id: string): BuffDefinition {
    const def = this.defs.find((candidate) => candidate.id === id)
    if (!def) throw new Error(`unknown buff id "${id}"`)
    return def
  }
}

const SELF_BUFF: BuffDefinition = {
  id: 'test_self_buff', name: 'S', polarity: 'buff', duration: 2, stackMode: 'refresh', effects: [],
}
const HIT_DEBUFF: BuffDefinition = {
  id: 'test_hit_debuff', name: 'H', polarity: 'debuff', duration: 2, stackMode: 'refresh', effects: [],
}
const ALLY_BUFF: BuffDefinition = {
  id: 'test_ally_buff', name: 'A', polarity: 'buff', duration: 2, stackMode: 'refresh', effects: [],
}
const ENEMY_DEBUFF: BuffDefinition = {
  id: 'test_enemy_debuff', name: 'E', polarity: 'debuff', duration: 2, stackMode: 'refresh', effects: [],
}

const CATALOG = new MapCatalog([SELF_BUFF, HIT_DEBUFF, ALLY_BUFF, ENEMY_DEBUFF])

function makeBattle(options: {
  skill: TurnSkillDefinition
  allyCount?: number
  enemyCount?: number
}): { battle: TurnBattle; players: TurnBattleParticipant[]; enemies: TurnBattleParticipant[] } {
  const players = [makeParticipant('player', 10, 0)]
  for (let i = 0; i < (options.allyCount ?? 0); i++) {
    players.push(makeParticipant(`ally_${i}`, 9, 100 + i))
  }
  players[0]!.basic = options.skill

  const enemies: TurnBattleParticipant[] = []
  for (let i = 0; i < (options.enemyCount ?? 1); i++) {
    const enemy = makeParticipant(`enemy_${i}`, 8, 200 + i)
    enemy.basic = { id: 'noop', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 }, targeting: { shape: 'single' } }
    enemies.push(enemy)
  }

  return { battle: { players, enemies, state: 'fighting' }, players, enemies }
}

describe('appliesBuffs — multi-application resolution', () => {
  it('self target applies to the actor only', () => {
    const { battle, players, enemies } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' }, targetScope: 'self',
        appliesBuffs: [{ definitionId: 'test_self_buff', target: 'self' }],
      },
      allyCount: 1,
    })

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, CATALOG).resolveNextStep(battle)

    expect(players[0]!.buffs.getAllById('test_self_buff')).toHaveLength(1)
    expect(players[1]!.buffs.getAllById('test_self_buff')).toHaveLength(0)
    expect(enemies[0]!.buffs.getAllById('test_self_buff')).toHaveLength(0)
  })

  it('action_targets applies to every affected enemy (AOE)', () => {
    const { battle, enemies } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'all_lanes' },
        appliesBuffs: [{ definitionId: 'test_hit_debuff', target: 'action_targets' }],
      },
      enemyCount: 2,
    })

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, CATALOG).resolveNextStep(battle)

    expect(enemies[0]!.buffs.getAllById('test_hit_debuff')).toHaveLength(1)
    expect(enemies[1]!.buffs.getAllById('test_hit_debuff')).toHaveLength(1)
  })

  it('allies_except_self hits living allies but never the actor', () => {
    const { battle, players } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' }, targetScope: 'self',
        appliesBuffs: [{ definitionId: 'test_ally_buff', target: 'allies_except_self' }],
      },
      allyCount: 2,
    })

    players[2]!.entity.alive = false
    players[2]!.alive = false

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, CATALOG).resolveNextStep(battle)

    expect(players[0]!.buffs.getAllById('test_ally_buff')).toHaveLength(0)
    expect(players[1]!.buffs.getAllById('test_ally_buff')).toHaveLength(1)
    expect(players[2]!.buffs.getAllById('test_ally_buff')).toHaveLength(0)
  })

  it('all_enemies hits every living enemy regardless of the declared target', () => {
    const { battle, enemies } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' },
        appliesBuffs: [{ definitionId: 'test_enemy_debuff', target: 'all_enemies' }],
      },
      enemyCount: 3,
    })

    enemies[2]!.entity.alive = false
    enemies[2]!.alive = false

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, CATALOG).resolveNextStep(battle)

    expect(enemies[0]!.buffs.getAllById('test_enemy_debuff')).toHaveLength(1)
    expect(enemies[1]!.buffs.getAllById('test_enemy_debuff')).toHaveLength(1)
    expect(enemies[2]!.buffs.getAllById('test_enemy_debuff')).toHaveLength(0)
  })

  it('durationOverride reaches the applied instance (pre-modifier base)', () => {
    const { battle, players } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' }, targetScope: 'self',
        appliesBuffs: [{ definitionId: 'test_self_buff', target: 'self', durationOverride: 7 }],
      },
    })

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, CATALOG).resolveNextStep(battle)

    expect(players[0]!.buffs.getAllById('test_self_buff')[0]?.remainingTurns).toBe(7)
  })

  it('one skill applies several defs in declaration order', () => {
    const { battle, players, enemies } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' },
        appliesBuffs: [
          { definitionId: 'test_self_buff', target: 'self' },
          { definitionId: 'test_ally_buff', target: 'allies_except_self' },
          { definitionId: 'test_enemy_debuff', target: 'all_enemies' },
        ],
      },
      allyCount: 1,
      enemyCount: 1,
    })

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, CATALOG).resolveNextStep(battle)

    expect(players[0]!.buffs.getAllById('test_self_buff')).toHaveLength(1)
    expect(players[1]!.buffs.getAllById('test_ally_buff')).toHaveLength(1)
    expect(enemies[0]!.buffs.getAllById('test_enemy_debuff')).toHaveLength(1)
  })

  it('clearsCcOnApply strips existing cc effects from the target pool', () => {
    const cleanseDef: BuffDefinition = {
      id: 'test_cleanse', name: 'C', polarity: 'buff', duration: 2, stackMode: 'refresh',
      clearsCcOnApply: true, effects: [],
    }
    const stunDef: BuffDefinition = {
      id: 'test_stun', name: 'Stun', polarity: 'debuff', duration: 5, stackMode: 'refresh',
      effects: [{ type: 'cc', ccEffect: 'stun' }],
    }
    const catalog = new MapCatalog([cleanseDef, stunDef])

    const { battle, players } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' }, targetScope: 'self',
        appliesBuffs: [{ definitionId: 'test_cleanse', target: 'allies_except_self' }],
      },
      allyCount: 1,
    })

    // The stun must sit on an ALLY, not the actor — a hard-cc'd actor is
    // ccBlocked at declare and could never cast the cleanse itself.
    new BuffSystem(players[1]!.buffs).apply(stunDef, players[0]!.entity, players[1]!.entity, catalog)
    expect(players[1]!.buffs.getAllById('test_stun')).toHaveLength(1)

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, catalog).resolveNextStep(battle)

    expect(players[1]!.buffs.getAllById('test_stun')).toHaveLength(0)
    expect(players[1]!.buffs.getAllById('test_cleanse')).toHaveLength(1)
  })

  it('the real SON_NHAC def taunts all enemies and shields allies through one cast', () => {
    const player = makeParticipant('player', 10, 0)
    const ally = makeParticipant('ally', 9, 100)
    const enemy = makeParticipant('enemy', 8, 200)
    player.basic = {
      id: 'son_nhac_like', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
      targeting: { shape: 'single' }, targetScope: 'self',
      appliesBuffs: [
        { definitionId: 'son_nhac', target: 'self' },
        { definitionId: 'son_nhac_ho_the', target: 'allies_except_self' },
        { definitionId: 'khiem_khich', target: 'all_enemies' },
      ],
    }

    const battle: TurnBattle = { players: [player, ally], enemies: [enemy], state: 'fighting' }

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10, BUFF_REGISTRY).resolveNextStep(battle)

    expect(player.buffs.getAllById('son_nhac')).toHaveLength(1)
    expect(ally.buffs.getAllById('son_nhac_ho_the')).toHaveLength(1)
    expect(player.buffs.getAllById('son_nhac_ho_the')).toHaveLength(0)
    expect(enemy.buffs.getAllById('khiem_khich')).toHaveLength(1)
  })
})
