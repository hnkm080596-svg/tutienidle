import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant, type TurnCombatRuntime } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { BuffDefinitionId } from '../contracts/ids'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// The Tu Reimagined (plan Task 6/11) — `appliesBuffs` plural replaces
// the singular appliesBuff: one skill applies several buff defs across
// four target scopes (self / action_targets / allies_except_self /
// all_enemies), each with an optional durationOverride delivered through
// the apply-op channel. gaugeDelta pushes stay per-definition.

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

  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

function buffDef(id: string, polarity: 'buff' | 'debuff', extra?: Partial<BuffDefinition>): BuffDefinition {
  return {
    id: id as BuffDefinitionId,
    name: id,
    kind: polarity,
    polarity,
    instanceScope: 'per_target',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 2, scaling: 'fixed' },
    dispellable: true,
    ...extra,
  }
}

const SELF_BUFF = buffDef('test_self_buff', 'buff')
const HIT_DEBUFF = buffDef('test_hit_debuff', 'debuff')
const ALLY_BUFF = buffDef('test_ally_buff', 'buff')
const ENEMY_DEBUFF = buffDef('test_enemy_debuff', 'debuff')

const REGISTRY = makeTestBuffRegistry([SELF_BUFF, HIT_DEBUFF, ALLY_BUFF, ENEMY_DEBUFF])

function buffsOf(runtime: TurnCombatRuntime, participant: TurnBattleParticipant, id: string) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === id)
}

function makeBattle(options: {
  skill: TurnSkillDefinition
  allyCount?: number
  enemyCount?: number
  registry?: ReturnType<typeof makeTestBuffRegistry>
}): {
  battle: TurnBattle
  players: TurnBattleParticipant[]
  enemies: TurnBattleParticipant[]
  combat: CombatSystem
  runtime: TurnRuntimeFixture
} {
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

  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: options.registry ?? REGISTRY,
    participants: () => [...players, ...enemies],
    combatSystem: combat,
  })

  return { battle: { players, enemies, state: 'fighting' }, players, enemies, combat, runtime }
}

describe('appliesBuffs — multi-application resolution', () => {
  it('self target applies to the actor only', () => {
    const { battle, players, enemies, combat, runtime } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' }, targetScope: 'self',
        appliesBuffs: [{ definitionId: 'test_self_buff', target: 'self' }],
      },
      allyCount: 1,
    })

    new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime).resolveNextStep(battle)

    expect(buffsOf(runtime, players[0]!, 'test_self_buff')).toHaveLength(1)
    expect(buffsOf(runtime, players[1]!, 'test_self_buff')).toHaveLength(0)
    expect(buffsOf(runtime, enemies[0]!, 'test_self_buff')).toHaveLength(0)
  })

  it('action_targets applies to every affected enemy (AOE)', () => {
    const { battle, enemies, combat, runtime } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'all_lanes' },
        appliesBuffs: [{ definitionId: 'test_hit_debuff', target: 'action_targets' }],
      },
      enemyCount: 2,
    })

    new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime).resolveNextStep(battle)

    expect(buffsOf(runtime, enemies[0]!, 'test_hit_debuff')).toHaveLength(1)
    expect(buffsOf(runtime, enemies[1]!, 'test_hit_debuff')).toHaveLength(1)
  })

  it('allies_except_self hits living allies but never the actor', () => {
    const { battle, players, combat, runtime } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' }, targetScope: 'self',
        appliesBuffs: [{ definitionId: 'test_ally_buff', target: 'allies_except_self' }],
      },
      allyCount: 2,
    })

    players[2]!.entity.alive = false
    players[2]!.alive = false

    new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime).resolveNextStep(battle)

    expect(buffsOf(runtime, players[0]!, 'test_ally_buff')).toHaveLength(0)
    expect(buffsOf(runtime, players[1]!, 'test_ally_buff')).toHaveLength(1)
    expect(buffsOf(runtime, players[2]!, 'test_ally_buff')).toHaveLength(0)
  })

  it('all_enemies hits every living enemy regardless of the declared target', () => {
    const { battle, enemies, combat, runtime } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' },
        appliesBuffs: [{ definitionId: 'test_enemy_debuff', target: 'all_enemies' }],
      },
      enemyCount: 3,
    })

    enemies[2]!.entity.alive = false
    enemies[2]!.alive = false

    new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime).resolveNextStep(battle)

    expect(buffsOf(runtime, enemies[0]!, 'test_enemy_debuff')).toHaveLength(1)
    expect(buffsOf(runtime, enemies[1]!, 'test_enemy_debuff')).toHaveLength(1)
    expect(buffsOf(runtime, enemies[2]!, 'test_enemy_debuff')).toHaveLength(0)
  })

  it('durationOverride reaches the applied instance (pre-modifier base)', () => {
    const { battle, players, combat, runtime } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' }, targetScope: 'self',
        appliesBuffs: [{ definitionId: 'test_self_buff', target: 'self', durationOverride: 7 }],
      },
    })

    new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime).resolveNextStep(battle)

    expect(buffsOf(runtime, players[0]!, 'test_self_buff')[0]?.remaining).toBe(7)
  })

  it('one skill applies several defs in declaration order', () => {
    const { battle, players, enemies, combat, runtime } = makeBattle({
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

    new TurnBattleSystem(combat, 10, runtime.registry, undefined, runtime).resolveNextStep(battle)

    expect(buffsOf(runtime, players[0]!, 'test_self_buff')).toHaveLength(1)
    expect(buffsOf(runtime, players[1]!, 'test_ally_buff')).toHaveLength(1)
    expect(buffsOf(runtime, enemies[0]!, 'test_enemy_debuff')).toHaveLength(1)
  })

  it('clearsCcOnApply strips existing cc effects from the target pool', () => {
    const cleanseDef = buffDef('test_cleanse', 'buff', { clearsCcOnApply: true })
    const stunDef = buffDef('test_stun', 'debuff', {
      controls: [{ type: 'stun' }],
      lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
    })
    const registry = makeTestBuffRegistry([cleanseDef, stunDef, ALLY_BUFF])

    const { battle, players, combat, runtime } = makeBattle({
      skill: {
        id: 's', cooldownTurns: 0, damage: { kind: 'physical', multiplier: 0 },
        targeting: { shape: 'single' }, targetScope: 'self',
        appliesBuffs: [{ definitionId: 'test_cleanse', target: 'allies_except_self' }],
      },
      allyCount: 1,
      registry,
    })

    // The stun must sit on an ALLY, not the actor — a hard-cc'd actor is
    // ccBlocked at declare and could never cast the cleanse itself.
    runtime.applyBuff('test_stun', players[1]!, players[0]!)
    expect(buffsOf(runtime, players[1]!, 'test_stun')).toHaveLength(1)

    new TurnBattleSystem(combat, 10, registry, undefined, runtime).resolveNextStep(battle)

    expect(buffsOf(runtime, players[1]!, 'test_stun')).toHaveLength(0)
    expect(buffsOf(runtime, players[1]!, 'test_cleanse')).toHaveLength(1)
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
    const combat = new CombatSystem(new EventBus())
    const runtime = makeTurnRuntime({
      registry: BUFF_REGISTRY,
      participants: () => [player, ally, enemy],
      combatSystem: combat,
    })

    new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)

    expect(buffsOf(runtime, player, 'son_nhac')).toHaveLength(1)
    expect(buffsOf(runtime, ally, 'son_nhac_ho_the')).toHaveLength(1)
    expect(buffsOf(runtime, player, 'son_nhac_ho_the')).toHaveLength(0)
    expect(buffsOf(runtime, enemy, 'khiem_khich')).toHaveLength(1)
  })
})
