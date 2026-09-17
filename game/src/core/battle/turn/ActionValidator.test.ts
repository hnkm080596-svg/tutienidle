// ActionValidator.test.ts -- megaplan M4 step 4 (contract sec.70-72,
// R10, R-E, R-E2): unit coverage for the generic action-tag restriction
// primitives -- forbiddenActionTags collection, tag inference,
// isActionAllowed, and the sealed selection semantics.

import { describe, expect, it } from 'vitest'
import type { Buff, BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import { BuffPool } from '../../buff/BuffPool'
import {
  actionTagsOf,
  actionTagsOfSkill,
  BuffPoolActionValidator,
  isActionAllowed,
} from './ActionValidator'
import {
  NULL_ACTION,
  selectAction,
  selectForcedAction,
  type SelectedAction,
  type TurnSkillDefinition,
} from './TurnSkillAction'
import type { TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { createBaseStats } from '../../stats/StatBlock'

function entity(id = 'actor'): CombatEntity {
  const stats = createBaseStats({ might: 10 })
  return {
    id,
    name: id,
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: 100,
    maxHp: 100,
    currentMp: 100,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 0,
    alive: true,
  } as CombatEntity
}

function participant(overrides: Partial<TurnBattleParticipant> = {}): TurnBattleParticipant {
  return {
    id: 'actor',
    entity: entity(),
    speed: 10,
    priority: 0,
    actionGauge: 0,
    alive: true,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
    ...overrides,
  }
}

function skill(id: string, overrides: Partial<TurnSkillDefinition> = {}): TurnSkillDefinition {
  return {
    id,
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
    ...overrides,
  }
}

function buff(id: string): Buff {
  return {
    id,
    sourceId: 'caster',
    targetId: 'actor',
    polarity: 'debuff',
    duration: 2,
    remainingTurns: 2,
    stacks: 1,
    stackMode: 'refresh',
    effects: [],
  }
}

function def(id: string, overrides: Partial<BuffDefinition> = {}): BuffDefinition {
  return {
    id,
    name: id,
    polarity: 'debuff',
    duration: 2,
    stackMode: 'refresh',
    effects: [],
    ...overrides,
  }
}

class MapCatalog implements BuffDefinitionCatalog {
  constructor(private readonly defs: BuffDefinition[]) {}
  get(id: string): BuffDefinition {
    const found = this.defs.find((candidate) => candidate.id === id)
    if (!found) throw new Error(`unknown buff id "${id}"`)
    return found
  }
}

describe('actionTagsOf / actionTagsOfSkill (R-E2)', () => {
  it('authored actionTags always win', () => {
    expect(
      actionTagsOfSkill(skill('heal', { actionTags: ['heal'], damage: undefined })),
    ).toEqual(['heal'])
    // Authored tags beat damage inference.
    expect(
      actionTagsOfSkill(
        skill('strike', { actionTags: ['attack', 'multi_hit'] }),
      ),
    ).toEqual(['attack', 'multi_hit'])
  })

  it('unannotated defs infer [attack] iff they carry damage', () => {
    expect(actionTagsOfSkill(skill('hit'))).toEqual(['attack'])
    expect(
      actionTagsOfSkill(skill('ward', { damage: undefined })),
    ).toEqual([])
  })

  it('the slot-less fallback basic is always [attack]', () => {
    const fallback: SelectedAction = {
      skillId: 'basic_attack',
      skill: null,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      slot: null,
    }
    expect(actionTagsOf(fallback)).toEqual(['attack'])
  })

  it('NULL_ACTION carries no tags (never a candidate)', () => {
    expect(actionTagsOf(NULL_ACTION)).toEqual([])
  })
})

describe('isActionAllowed', () => {
  const attack: SelectedAction = {
    skillId: 'hit',
    skill: skill('hit'),
    targeting: { shape: 'single' },
    slot: null,
  }

  it('undefined/empty forbidden sets allow everything', () => {
    expect(isActionAllowed(attack, undefined)).toBe(true)
    expect(isActionAllowed(attack, new Set())).toBe(true)
  })

  it('a matching forbidden tag rejects; non-matching allows', () => {
    expect(isActionAllowed(attack, new Set(['attack']))).toBe(false)
    expect(isActionAllowed(attack, new Set(['heal']))).toBe(true)
  })
})

describe('BuffPoolActionValidator.forbiddenActionTags', () => {
  it('unions tags across live instances via the catalog', () => {
    const pool = new BuffPool()
    pool.add(buff('seal_attack'))
    pool.add(buff('seal_move'))
    pool.add(buff('plain'))
    const catalog = new MapCatalog([
      def('seal_attack', { forbiddenActionTags: ['attack'] }),
      def('seal_move', { forbiddenActionTags: ['move', 'attack'] }),
      def('plain'),
    ])
    const validator = new BuffPoolActionValidator(catalog)
    const tags = validator.forbiddenActionTags({ buffs: pool })
    expect([...tags].sort()).toEqual(['attack', 'move'])
  })

  it('a pool buff missing from the catalog contributes no tags', () => {
    const pool = new BuffPool()
    pool.add(buff('ghost'))
    const validator = new BuffPoolActionValidator(new MapCatalog([]))
    expect(validator.forbiddenActionTags({ buffs: pool }).size).toBe(0)
  })
})

describe('sealed selection semantics (R-E)', () => {
  it('forbidden slots are skipped in priority order', () => {
    const actor = participant({
      ultimate: {
        skill: skill('ult', { actionTags: ['attack'] }),
        remainingCooldownTurns: 0,
      },
      special: {
        skill: skill('heal', {
          actionTags: ['heal'],
          damage: undefined,
          targetScope: 'self',
        }),
        remainingCooldownTurns: 0,
      },
      basic: skill('basic'),
    })
    const action = selectAction(actor, new Set(['attack']))
    expect(action.skillId).toBe('heal') // ult skipped, special legal
  })

  it('all candidates sealed -> NULL_ACTION (skillId empty)', () => {
    const actor = participant({ basic: skill('basic') })
    const action = selectAction(actor, new Set(['attack']))
    expect(action).toBe(NULL_ACTION)
    expect(action.skillId).toBe('')
    expect(action.skill).toBeNull()
  })

  it('forced forbidden pick falls back to restricted selection', () => {
    const actor = participant({
      special: {
        skill: skill('heal', {
          actionTags: ['heal'],
          damage: undefined,
          targetScope: 'self',
        }),
        remainingCooldownTurns: 0,
      },
      basic: skill('basic'),
    })
    const action = selectForcedAction(actor, 'basic', new Set(['attack']))
    expect(action.skillId).toBe('heal')
  })

  it('unsealed selection is byte-identical to today (regression guard)', () => {
    const actor = participant({
      ultimate: {
        skill: skill('ult'),
        remainingCooldownTurns: 0,
      },
      special: {
        skill: skill('sp'),
        remainingCooldownTurns: 0,
      },
      basic: skill('basic'),
    })
    expect(selectAction(actor).skillId).toBe('ult')
    expect(selectAction(actor, new Set()).skillId).toBe('ult')
    expect(selectForcedAction(actor, 'special').skillId).toBe('sp')
  })

  it('a non-attack seal does not block inferred attacks', () => {
    const actor = participant({ basic: skill('basic') })
    const action = selectAction(actor, new Set(['heal']))
    expect(action.skillId).toBe('basic')
  })
})
