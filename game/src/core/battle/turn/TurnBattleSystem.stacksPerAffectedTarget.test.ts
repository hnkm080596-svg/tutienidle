import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
import { PHAP_TU_EMPOWERED_ULTS } from '../../../data/skill/PhapTuEmpoweredUlts'
import { makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// Mission C Task 10a (audit T3-19 adjacent) -- Hau Tho Thanh Luy's
// empowered payload authored `stacksPerAffectedTarget`: the CASTER
// gains one thanh_luy stack per still-alive target the action hit
// (SkillEffect.ts:113-118), capped by the buff's maxStacks. Today the
// field is silently dropped by the converter and target:'target'
// lands the buff on the enemies with 1 stack each.

function createCombatant(id: string, type: 'player' | 'enemy'): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id,
    name: id,
    type,
    baseStats: stats,
    stats,
    currentHp: 10_000_000,
    maxHp: 10_000_000,
    currentMp: stats.maxMp,
    currentThe: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return { id, entity, speed: 100, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

function harness(enemyCount: number) {
  const playerEntity = createCombatant('player', 'player')
  const playerParticipant = makeParticipant('player', playerEntity, 0)
  playerParticipant.ultimate = {
    skill: PHAP_TU_EMPOWERED_ULTS.earth!.nuke!,
    remainingCooldownTurns: 0,
  }

  const enemyParticipants = Array.from({ length: enemyCount }, (_, i) =>
    makeParticipant(`enemy_${i}`, createCombatant(`enemy_${i}`, 'enemy'), i + 1),
  )

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: enemyParticipants,
    state: 'fighting',
  }

  const combat = new CombatSystem(new EventBus())
  const rng = new FunctionCombatRng(() => 0.5) // deterministic mid rng -- hit/evasion rolls all land
  const runtime = makeTurnRuntime({
    registry: BUFF_REGISTRY,
    participants: () => [playerParticipant, ...enemyParticipants],
    combatSystem: combat,
    rng,
  })
  const system = new TurnBattleSystem(
    combat,
    100,
    BUFF_REGISTRY,
    undefined,
    runtime,
    vi.fn(),
    undefined,
    rng,
  )

  return { battle, playerParticipant, enemyParticipants, system, runtime }
}

function stacksOn(runtime: ReturnType<typeof makeTurnRuntime>, entityId: string, definitionId: string): number {
  return runtime.buffs
    .getForTarget(entityId)
    .filter((instance) => instance.definitionId === definitionId)
    .reduce((total, instance) => total + instance.stacks, 0)
}

describe('thanh_luy stacksPerAffectedTarget (Mission C Task 10a)', () => {
  it('the CASTER gains one thanh_luy stack per living target hit; enemies get none', () => {
    const { battle, playerParticipant, enemyParticipants, system, runtime } = harness(3)

    system.resolveNextStep(battle)

    expect(stacksOn(runtime, playerParticipant.entity.id, 'thanh_luy')).toBe(3)

    for (const enemy of enemyParticipants) {
      expect(stacksOn(runtime, enemy.entity.id, 'thanh_luy')).toBe(0)
    }
  })

  it('dead targets are not imprisoned -- only still-alive hits stack', () => {
    const { battle, playerParticipant, enemyParticipants, system, runtime } = harness(3)

    // enemy_0 dies to the hit's own damage: give it 1 maxHp so the 4x
    // empowered payload kills it inside the same action.
    enemyParticipants[0]!.entity.stats.maxHp = 1
    enemyParticipants[0]!.entity.currentHp = 1

    system.resolveNextStep(battle)

    expect(stacksOn(runtime, playerParticipant.entity.id, 'thanh_luy')).toBe(2)
  })

  it('stacks respect the buff maxStacks cap (8)', () => {
    const { battle, playerParticipant, system, runtime } = harness(10)

    system.resolveNextStep(battle)

    expect(stacksOn(runtime, playerParticipant.entity.id, 'thanh_luy')).toBe(8)
  })
})
