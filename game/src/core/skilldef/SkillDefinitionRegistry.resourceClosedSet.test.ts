import { describe, expect, it } from 'vitest'

import type { BuffDefinitionId } from '../battle/contracts/ids'

import type { ActiveSkillDefinition } from './SkillDefinition'
import {
  SkillDefinitionRegistry,
  validateSkillDefinition,
} from './SkillDefinitionRegistry'

const deps = { isBuffDefinitionId: (_id: BuffDefinitionId) => true }

function activeDef(id: string, overrides: Partial<ActiveSkillDefinition> = {}): ActiveSkillDefinition {
  return {
    kind: 'active',
    id,
    name: `Skill ${id}`,
    targetIntent: 'primary_target',
    cadence: { cooldownTurns: 2 },
    operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 1 }],
    ...overrides,
  }
}

// Pin (COR-M F1): the closed resource set must hold on EVERY authored
// resourceId surface, not only resource_* value queries -- an out-of-set
// id on a condition or op used to validate clean, then throw a non-
// SkillResolverError mid-execute (TurnSkillPlanRuntimeError /
// CombatSettlementFault), crashing past the decline lane. All three
// surfaces fault at define time now.
describe('closed resourceId set (RESOURCE_IDS)', () => {
  it('faults resource_at_least conditions on out-of-set ids', () => {
    const def = activeDef('bad_cond', {
      operations: [
        {
          type: 'if',
          condition: { kind: 'resource_at_least', resourceId: 'mp', amount: 1 },
          then: [{ type: 'deal_damage', target: 'primary_target', coefficient: 1 }],
        },
      ],
    })
    expect(validateSkillDefinition(def, deps).map((f) => f.message)).toEqual(
      expect.arrayContaining([expect.stringContaining("unknown resourceId 'mp'")]),
    )
  })

  it('faults gain_resource ops on out-of-set ids', () => {
    const def = activeDef('bad_gain', {
      operations: [{ type: 'gain_resource', target: 'self', resourceId: 'mp', amount: 5 }],
    })
    expect(validateSkillDefinition(def, deps).map((f) => f.message)).toEqual(
      expect.arrayContaining([expect.stringContaining("unknown resourceId 'mp'")]),
    )
  })

  it('faults consume_resource ops on out-of-set ids', () => {
    const def = activeDef('bad_consume', {
      operations: [{ type: 'consume_resource', target: 'self', resourceId: 'essence', amount: 5 }],
    })
    expect(validateSkillDefinition(def, deps).map((f) => f.message)).toEqual(
      expect.arrayContaining([expect.stringContaining("unknown resourceId 'essence'")]),
    )
  })

  it('accepts in-set ids on all three surfaces', () => {
    const def = activeDef('ok_all', {
      operations: [
        {
          type: 'if',
          condition: { kind: 'resource_at_least', resourceId: 'the', amount: 1 },
          then: [
            { type: 'consume_resource', target: 'self', resourceId: 'the', amount: 1 },
            { type: 'gain_resource', target: 'self', resourceId: 'mana', amount: 2 },
          ],
        },
      ],
    })
    expect(validateSkillDefinition(def, deps)).toEqual([])
    expect(() => new SkillDefinitionRegistry([def], deps)).not.toThrow()
  })
})
