import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import type { BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { TurnSkillDefinition } from './TurnSkillAction'

// AR-04 QA Probes:
// 1. Critical authority: turn hit calls without critical parameter must
//    automatically roll critical through CombatSystem.rollCritical.
// 2. Dodged outcome gating: dodged attacks must not add target to targetIds,
//    must not apply on-hit effects, and must not apply ailments.

const BURN_BUFF: BuffDefinition = {
  id: 'qa_burn',
  name: 'QA Burn',
  polarity: 'debuff',
  duration: 3,
  stackMode: 'stack',
  effects: [{ type: 'dot', dpsRatio: 1, element: 'fire' }],
}

const REGISTRY: BuffDefinitionCatalog = {
  get: (id: string): BuffDefinition => {
    if (id === BURN_BUFF.id) return BURN_BUFF
    throw new Error(`unknown buff id: ${id}`)
  },
}

function makeEntity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, ...overrides.stats })
  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentThe: 0,
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
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return {
    id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

describe('AR-04: Hit resolution and critical authority', () => {
  it('rolls critical hits naturally in turn battles when criticalRate is 100%', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10, REGISTRY)

    const attacker = makeEntity('attacker', {
      stats: createBaseStats({ criticalRate: 1.0, might: 100, accuracyRating: 9999 }),
    })
    const defender = makeEntity('defender', {
      stats: createBaseStats({ criticalAvoidance: 0, evasionRate: 0 }),
    })

    const attackerP = makeParticipant('attacker', attacker, 0)
    const defenderP = makeParticipant('defender', defender, 1)

    attackerP.basic = {
      id: 'strike',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    }

    const battle: TurnBattle = {
      players: [attackerP],
      enemies: [defenderP],
      state: 'fighting',
    }

    let capturedCritical = false
    eventBus.on<{ critical: boolean }>('damage', (event) => {
      capturedCritical = event.critical
    })

    system.resolveNextStep(battle)

    expect(capturedCritical).toBe(true)
  })

  it('gates on-hit effects and ailment application when attack is dodged', () => {
    // Force rollHit to miss (getHitChance has a 5% floor, so Math.random = 0.99 guarantees dodge).
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10, REGISTRY)

    // Attacker has 0 accuracy, defender has 99999 evasion -> guaranteed dodge.
    const attacker = makeEntity('attacker', {
      stats: createBaseStats({ accuracyRating: 0 }),
    })
    const defender = makeEntity('defender', {
      stats: createBaseStats({ evasionRate: 99999 }),
    })

    const attackerP = makeParticipant('attacker', attacker, 0)
    const defenderP = makeParticipant('defender', defender, 1)

    const skillWithAilment: TurnSkillDefinition = {
      id: 'fire_strike',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilment: { buffDefinitionId: 'qa_burn', chance: 1.0 },
    }

    attackerP.basic = skillWithAilment

    const battle: TurnBattle = {
      players: [attackerP],
      enemies: [defenderP],
      state: 'fighting',
    }

    const stepResult = system.resolveNextStep(battle)

    // When attack is dodged:
    // 1. targetIds must NOT contain defender.
    expect(stepResult.targetIds).not.toContain('defender')
    // 2. defender must NOT receive the burn ailment.
    expect(defenderP.buffs.getAllById('qa_burn')).toHaveLength(0)
    vi.restoreAllMocks()
  })
})
