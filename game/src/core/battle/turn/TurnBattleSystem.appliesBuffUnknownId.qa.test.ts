import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { TurnBuffDefinition, TurnBuffRegistry } from './TurnBuffTypes'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { TurnBuffPool } from './TurnBuffPool'

// Roadmap 9.5 #12 follow-up (flagged 2026-09-07, activated 2026-09-14):
// TurnBattleSystem calls registry.get() UNGUARDED in two places that read
// CONTENT-DERIVED ids — skill.appliesBuff.definitionId (the Reaction Path
// ultimate path, now live via reaction_path_unlock_* keystones) and
// appliesAilments[].buffDefinitionId. MapTurnBuffRegistry.get THROWS on an
// unknown id, so a renamed/drifted buff id crashes every fixed-step tick
// with no error isolation upstream in GameManager's updateBattleFixedStep.
//
// Expected: the tick skips the unresolvable buff/ailment gracefully (same
// try/catch pattern as the bossTrigger block, Phase A2), the rest of the
// action still commits, and resolveNextStep does NOT throw.

function createCombatant(id: string): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 10 }

  return {
    id,
    name: id,
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}

const OTHER_DEFINITION: TurnBuffDefinition = {
  id: 'unrelated_buff',
  name: 'Unrelated Buff',
  polarity: 'buff',
  duration: 5,
  stackMode: 'refresh',
  effects: [],
}

class SingleEntryRegistry implements TurnBuffRegistry {
  constructor(private readonly definition: TurnBuffDefinition) {}

  get(id: string): TurnBuffDefinition {
    if (id !== this.definition.id) {
      throw new Error(`TurnBuffRegistry: unknown buff id "${id}"`)
    }

    return this.definition
  }
}

function makeBattle(skill: TurnSkillDefinition): { battle: TurnBattle; enemy: TurnBattleParticipant } {
  const playerParticipant = makeParticipant('player', createCombatant('player'), 10, 0)
  playerParticipant.basic = skill

  const enemyParticipant = makeParticipant('enemy', createCombatant('enemy'), 10, 1)
  enemyParticipant.basic = {
    id: 'qa_noop_basic',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 0 },
    targeting: { shape: 'single' },
  }

  return {
    battle: {
      players: [playerParticipant],
      enemies: [enemyParticipant],
      state: 'fighting',
    },
    enemy: enemyParticipant,
  }
}

describe('QA — TurnBattleSystem appliesBuff/appliesAilments vs unknown buff id (9.5 #12)', () => {
  it('resolveNextStep does not throw when appliesBuff.definitionId is missing from the registry', () => {
    const { battle, enemy } = makeBattle({
      id: 'qa_unknown_buff_skill',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 0 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'buff_id_not_in_registry', target: 'target' },
    })

    const system = new TurnBattleSystem(
      new CombatSystem(new EventBus()),
      10,
      new SingleEntryRegistry(OTHER_DEFINITION),
    )

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(enemy.buffs.getAll()).toEqual([])
    expect(battle.state).toBe('fighting')
  })

  it('resolveNextStep does not throw when appliesAilments[].buffDefinitionId is missing from the registry', () => {
    const { battle, enemy } = makeBattle({
      id: 'qa_unknown_ailment_skill',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilments: [{ buffDefinitionId: 'buff_id_not_in_registry', chance: 1 }],
    })

    const system = new TurnBattleSystem(
      new CombatSystem(new EventBus()),
      10,
      new SingleEntryRegistry(OTHER_DEFINITION),
    )

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(enemy.buffs.getAll()).toEqual([])
    expect(battle.state).toBe('fighting')
  })

  it('a known appliesBuff id still applies (guard must not blanket-swallow)', () => {
    const { battle, enemy } = makeBattle({
      id: 'qa_known_buff_skill',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 0 },
      targeting: { shape: 'single' },
      appliesBuff: { definitionId: 'unrelated_buff', target: 'target' },
    })

    const system = new TurnBattleSystem(
      new CombatSystem(new EventBus()),
      10,
      new SingleEntryRegistry(OTHER_DEFINITION),
    )

    expect(() => system.resolveNextStep(battle)).not.toThrow()
    expect(enemy.buffs.getAllById('unrelated_buff')).toHaveLength(1)
  })
})
