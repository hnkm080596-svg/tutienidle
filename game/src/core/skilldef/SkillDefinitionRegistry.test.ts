import { describe, expect, it } from 'vitest'

import type { BuffDefinitionId } from '../battle/contracts/ids'

import type { ActiveSkillDefinition, SkillDefinition } from './SkillDefinition'
import {
  SkillDefinitionRegistry,
  validateSkillDefinitionSet,
} from './SkillDefinitionRegistry'

const KNOWN_BUFFS = new Set<BuffDefinitionId>(['hoa_an', 'ung_the'])
const deps = { isBuffDefinitionId: (id: BuffDefinitionId) => KNOWN_BUFFS.has(id) }

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

describe('SkillDefinitionRegistry', () => {
  it('registers and resolves definitions', () => {
    const registry = new SkillDefinitionRegistry([activeDef('a'), activeDef('b')], deps)
    expect(registry.size).toBe(2)
    expect(registry.get('a')?.id).toBe('a')
    expect(registry.has('b')).toBe(true)
    expect(registry.require('b').name).toBe('Skill b')
    expect(registry.list().map((d) => d.id)).toEqual(['a', 'b'])
  })

  it('require throws on unknown id', () => {
    const registry = new SkillDefinitionRegistry([activeDef('a')], deps)
    expect(() => registry.require('zzz')).toThrow(/unknown skill 'zzz'/)
  })

  it('constructor throws on duplicate ids', () => {
    expect(() => new SkillDefinitionRegistry([activeDef('a'), activeDef('a')], deps)).toThrow(
      /duplicate skill definition id 'a'/,
    )
  })

  it('constructor throws aggregated faults including empowerment refs', () => {
    expect(
      () =>
        new SkillDefinitionRegistry(
          [
            activeDef('a', {
              variants: { empowerment: { theThreshold: 10, empoweredSkillId: 'missing_ult' } },
            }),
          ],
          deps,
        ),
    ).toThrow(/missing_empowerment_target/)
  })

  it('constructor throws on compositePool refs to unknown skills', () => {
    expect(
      () =>
        new SkillDefinitionRegistry(
          [activeDef('a', { subcasts: { compositePool: ['ghost_skill'], compositeCount: 1 } })],
          deps,
        ),
    ).toThrow(/compositePool references unknown skill 'ghost_skill'/)
  })

  it('accepts compositePool refs that resolve inside the registry', () => {
    const registry = new SkillDefinitionRegistry(
      [
        activeDef('pool_base'),
        activeDef('a', {
          operations: [],
          subcasts: { compositePool: ['pool_base'], compositeCount: 1 },
        }),
      ],
      deps,
    )
    expect(registry.size).toBe(2)
  })

  it('accepts empowerment refs that resolve inside the registry', () => {
    const registry = new SkillDefinitionRegistry(
      [
        activeDef('empowered_ult'),
        activeDef('a', {
          variants: { empowerment: { theThreshold: 10, empoweredSkillId: 'empowered_ult' } },
        }),
      ],
      deps,
    )
    expect(registry.size).toBe(2)
  })

  it('deep-freezes registered definitions', () => {
    const def = activeDef('a', {
      operations: [
        {
          type: 'if',
          condition: { kind: 'any_target_landed' },
          then: [{ type: 'heal', target: 'self', amount: 5 }],
        },
      ],
    })
    const registry = new SkillDefinitionRegistry([def], deps)
    const stored = registry.require('a')
    if (stored.kind !== 'active') throw new Error('expected active def')
    expect(Object.isFrozen(stored)).toBe(true)
    expect(Object.isFrozen(stored.operations)).toBe(true)
    expect(Object.isFrozen(stored.operations[0])).toBe(true)
    expect(Object.isFrozen(stored.cadence)).toBe(true)
    expect(() => {
      ;(stored as { name: string }).name = 'mutated'
    }).toThrow()
  })
})

describe('validateSkillDefinitionSet', () => {
  it('returns per-definition + set-level faults without throwing', () => {
    const defs: SkillDefinition[] = [
      activeDef('a'),
      activeDef('a'),
      activeDef('b', { variants: { empowerment: { theThreshold: 5, empoweredSkillId: 'ghost' } } }),
    ]
    const faults = validateSkillDefinitionSet(defs, deps)
    expect(faults.map((f) => f.code)).toContain('duplicate_id')
    expect(faults.map((f) => f.code)).toContain('missing_empowerment_target')
  })
})
