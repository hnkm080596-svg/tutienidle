import { describe, expect, it } from 'vitest'
import type { Skill } from './Skill'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { TurnBattleSystem, type TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'

// skilldef M5f (R6) -- the three-state-layer seams: SkillSystem owns
// SkillProgressionState projections, the turn runtime owns
// SkillCombatRuntimeState. These cover the canonical view APIs the
// redesigned skill data implements natively; the legacy `Skill` record
// keeps carrying the fields until that redesign deletes it.

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_skill',
    name: 'Test Skill',
    description: '',
    type: 'active',
    level: 2,
    maxLevel: 10,
    cooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 100, damageType: 'physical' }],
    ...overrides,
  }
}

function setup(template = skill()) {
  const manager = new SkillManager()
  const system = new SkillSystem(manager)
  // M-QI-05 - live levels come from the provider (GameManager wires it
  // to nodeLevels[core_<id>]); the template's authored level stands in
  // for the canonical core level here.
  system.setSkillLevelProvider((skillId) =>
    skillId === template.id ? (template.level ?? 1) : 1,
  )
  system.learn(template)
  return { manager, system, learned: manager.get(template.id)! }
}

describe('SkillSystem.progressionOf (skilldef M5f R6)', () => {
  it('projects every persistent field into one SkillProgressionState', () => {
    const { system, learned } = setup(
      skill({
        level: 3,
        experience: 7,
        totalExperience: 42,
        selectedSpecializationId: 'spec_a',
      }),
    )

    expect(system.progressionOf(learned)).toEqual({
      skillId: 'test_skill',
      level: 3,
      experience: 7,
      totalExperience: 42,
      selectedSpecializationId: 'spec_a',
    })
  })

  it('omits selectedSpecializationId when none is chosen', () => {
    const { system, learned } = setup()

    expect(system.progressionOf(learned)).not.toHaveProperty(
      'selectedSpecializationId',
    )
  })
})

describe('SkillSystem.getResolvedSkill (skilldef M5f R6)', () => {
  it('returns the {definition, progression} pair: resolved payload + state layer', () => {
    const { system, learned } = setup(skill({ level: 3 }))

    const { definition, progression } = system.getResolvedSkill(learned)

    expect(definition.effects[0]!.value).toBeCloseTo(110) // 5%/level
    expect(progression.level).toBe(3)
    expect(progression.skillId).toBe('test_skill')
  })

  it('levelOverride scopes the definition; progression stays the live layer', () => {
    const { system, learned } = setup(skill({ level: 5 }))

    const { definition, progression } = system.getResolvedSkill(learned, 1)

    expect(definition.effects[0]!.value).toBe(100)
    expect(progression.level).toBe(5)
  })
})

describe('TurnBattleSystem.combatRuntimeStateOf (skilldef M5f R6)', () => {
  function participantWithSlot(cooldownTurns: number): TurnBattleParticipant {
    const stats = createBaseStats({ speed: 10 })
    const entity = {
      id: 'p',
      name: 'p',
      type: 'player',
      baseStats: stats,
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
    } as CombatEntity
    const participant: TurnBattleParticipant = {
      id: 'p',
      entity,
      speed: 10,
      priority: 0,
      actionGauge: 0,
      alive: true,
      consecutiveHardCcTurns: 0,
    }
    participant.special = {
      skill: {
        id: 'charged_ult',
        cooldownTurns,
        damage: { kind: 'physical', multiplier: 1 },
        targeting: { shape: 'single' },
        chargeTurns: 2,
      },
      remainingCooldownTurns: cooldownTurns,
    }
    return participant
  }

  it('projects slot cooldown + charge progress into SkillCombatRuntimeState', () => {
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const participant = participantWithSlot(3)
    participant.chargingTurnsRemaining = 2
    participant.pendingChargedSkillId = 'charged_ult'

    expect(system.combatRuntimeStateOf(participant, 'charged_ult')).toEqual({
      skillId: 'charged_ult',
      cooldownRemainingTurns: 3,
      chargeProgress: 2,
    })
  })

  it('omits chargeProgress for a skill not currently charging', () => {
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const participant = participantWithSlot(3)

    expect(system.combatRuntimeStateOf(participant, 'charged_ult')).toEqual({
      skillId: 'charged_ult',
      cooldownRemainingTurns: 3,
    })
  })

  it('returns undefined when the participant carries neither slot nor charge state for the id', () => {
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()))
    const participant = participantWithSlot(3)

    expect(
      system.combatRuntimeStateOf(participant, 'unrelated_skill'),
    ).toBeUndefined()
  })
})
