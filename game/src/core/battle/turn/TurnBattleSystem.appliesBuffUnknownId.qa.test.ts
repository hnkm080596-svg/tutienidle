import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { makeTestBuffRegistry, makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// Roadmap 9.5 #12 follow-up (flagged 2026-09-07, activated 2026-09-14):
// TurnBattleSystem reads CONTENT-DERIVED ids — skill.appliesBuff.definitionId
// and appliesAilments[].buffDefinitionId — and BuffRegistry.get THROWS on an
// unknown id, so a renamed/drifted buff id would crash every fixed-step tick
// with no error isolation upstream in GameManager's updateBattleFixedStep.
//
// Expected: the tick skips the unresolvable buff/ailment gracefully (same
// try/catch pattern as the bossTrigger block, Phase A2), the rest of the
// action still commits, and resolveNextStep does NOT throw.
// M4: applies ride apply_buff ops through the shared runtime — the guard
// lives at the op-minting lanes (an unknown id never reaches the resolver).

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

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

const OTHER_DEFINITION: BuffDefinition = {
  id: 'unrelated_buff',
  name: 'Unrelated Buff',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'replace', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
  dispellable: true,
}

const REGISTRY = makeTestBuffRegistry([OTHER_DEFINITION])

function makeBattle(skill: TurnSkillDefinition) {
  const playerParticipant = makeParticipant('player', createCombatant('player'), 10, 0)
  playerParticipant.basic = skill

  const enemyParticipant = makeParticipant('enemy', createCombatant('enemy'), 10, 1)
  enemyParticipant.basic = {
    id: 'qa_noop_basic',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 0 },
    targeting: { shape: 'single' },
  }

  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: REGISTRY,
    participants: () => [playerParticipant, enemyParticipant],
    combatSystem: combat,
  })

  return {
    battle: {
      players: [playerParticipant],
      enemies: [enemyParticipant],
      state: 'fighting' as const,
    },
    enemy: enemyParticipant,
    combat,
    runtime,
  }
}

describe('QA — TurnBattleSystem appliesBuff/appliesAilments vs unknown buff id (9.5 #12)', () => {
  it('resolveNextStep does not throw when appliesBuff.definitionId is missing from the registry', () => {
    const { battle, enemy, combat, runtime } = makeBattle({
      id: 'qa_unknown_buff_skill',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 0 },
      targeting: { shape: 'single' },
      appliesBuffs: [{ definitionId: 'buff_id_not_in_registry', target: 'action_targets' }],
    })

    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(runtime.buffs.getForTarget(enemy.entity.id)).toEqual([])
    expect(battle.state).toBe('fighting')
  })

  it('resolveNextStep does not throw when appliesAilments[].buffDefinitionId is missing from the registry', () => {
    const { battle, enemy, combat, runtime } = makeBattle({
      id: 'qa_unknown_ailment_skill',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'buff_id_not_in_registry', chance: 1 }],
    })

    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(runtime.buffs.getForTarget(enemy.entity.id)).toEqual([])
    expect(battle.state).toBe('fighting')
  })

  it('a known appliesBuff id still applies (guard must not blanket-swallow)', () => {
    const { battle, enemy, combat, runtime } = makeBattle({
      id: 'qa_known_buff_skill',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 0 },
      targeting: { shape: 'single' },
      appliesBuffs: [{ definitionId: 'unrelated_buff', target: 'action_targets' }],
    })

    const system = new TurnBattleSystem(combat, 10, REGISTRY, undefined, runtime)

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    const applied = runtime.buffs
      .getForTarget(enemy.entity.id)
      .filter((instance) => instance.definitionId === 'unrelated_buff')
    expect(applied).toHaveLength(1)
  })
})
