import { describe, expect, it } from 'vitest'

import type { BuffDefinitionId, CombatEntityId } from '../battle/contracts/ids'

import type { AuthoredSkillOperation } from './AuthoredOperation'
import {
  evaluateScalarExpression,
  evaluateSkillCondition,
  type ScalarExpression,
  type SkillReadContext,
} from './ScalarExpression'
import type { ActiveSkillDefinition, PassiveSkillDefinition } from './SkillDefinition'
import { validateSkillDefinition } from './SkillDefinitionRegistry'

const KNOWN_BUFFS = new Set<BuffDefinitionId>(['hoa_an', 'ung_the', 'test_buff.x'])
const deps = { isBuffDefinitionId: (id: BuffDefinitionId) => KNOWN_BUFFS.has(id) }

function activeDef(overrides: Partial<ActiveSkillDefinition> = {}): ActiveSkillDefinition {
  return {
    kind: 'active',
    id: 'skill.test',
    name: 'Test Skill',
    targetIntent: 'primary_target',
    cadence: { cooldownTurns: 2 },
    operations: [{ type: 'deal_damage', target: 'primary_target', coefficient: 1 }],
    ...overrides,
  }
}

function passiveDef(overrides: Partial<PassiveSkillDefinition> = {}): PassiveSkillDefinition {
  return {
    kind: 'passive',
    id: 'passive.test',
    name: 'Test Passive',
    triggers: [{ event: 'skill_landed' }],
    operations: [
      { type: 'apply_buff', target: 'self', definitionId: 'ung_the' },
    ],
    ...overrides,
  }
}

function codes(def: Parameters<typeof validateSkillDefinition>[0]): string[] {
  return validateSkillDefinition(def, deps).map((f) => f.code)
}

describe('SkillDefinition validation -- schema shape', () => {
  it('accepts a well-formed ActiveSkillDefinition', () => {
    expect(validateSkillDefinition(activeDef(), deps)).toEqual([])
  })

  it('accepts the elemental_penetration modifier channel; still rejects unknown channels (canonical-seals addendum)', () => {
    const penOp = {
      type: 'add_buff_modifier' as const,
      selector: {
        kind: 'target_definition' as const,
        target: 'primary_target' as const,
        definitionId: 'test_buff.x' as BuffDefinitionId,
      },
      modifier: {
        id: 'duong_kim',
        channel: 'elemental_penetration' as const,
        operation: 'add' as const,
        value: 4,
        reapply: 'replace' as const,
        priority: 0,
        lifetime: { type: 'uses' as const, remaining: 1 },
      },
    }
    expect(
      validateSkillDefinition(activeDef({ operations: [penOp] }), deps),
    ).toEqual([])
    const badChannel = {
      ...penOp,
      modifier: { ...penOp.modifier, channel: 'mana' },
    } as unknown as typeof penOp
    expect(
      codes(activeDef({ operations: [badChannel] })),
    ).toContain('invalid_field_value')
  })

  it('accepts a well-formed PassiveSkillDefinition', () => {
    expect(validateSkillDefinition(passiveDef(), deps)).toEqual([])
  })

  it('rejects a passive carrying active-only fields', () => {
    const bad = {
      ...passiveDef(),
      cadence: { cooldownTurns: 1 },
      targetIntent: 'self',
      subcasts: { count: 1 },
    } as unknown as PassiveSkillDefinition
    const faultCodes = codes(bad)
    expect(faultCodes).toContain('active_field_on_passive')
    expect(validateSkillDefinition(bad, deps).filter((f) => f.code === 'active_field_on_passive'))
      .toHaveLength(3)
  })

  it('rejects an active carrying passive triggers', () => {
    const bad = {
      ...activeDef(),
      triggers: [{ event: 'skill_landed' }],
    } as unknown as ActiveSkillDefinition
    expect(codes(bad)).toContain('passive_field_on_active')
  })

  it('rejects an active with no operations and no compositePool shell', () => {
    expect(codes(activeDef({ operations: [] }))).toContain('invalid_field_value')
  })

  it('accepts a composite-shell active with empty operations', () => {
    const def = activeDef({
      operations: [],
      subcasts: { compositePool: ['skill.a', 'skill.b'], compositeCount: 1 },
    })
    expect(validateSkillDefinition(def, deps)).toEqual([])
  })
})

describe('SkillDefinition validation -- cleanse', () => {
  const cleanseOp = (query: object, limit?: number): AuthoredSkillOperation => ({
    type: 'cleanse',
    target: 'primary_target',
    query: query as never,
    limit,
  })

  it('accepts a verbatim BuffCleanseQuery mirror + positive limit', () => {
    const def = activeDef({
      operations: [cleanseOp({ kind: 'debuff', polarity: 'debuff', tags: ['dot'], element: 'fire', definitionId: 'hoa_an' }, 2)],
    })
    expect(validateSkillDefinition(def, deps)).toEqual([])
  })

  it('rejects non-positive / non-integer limit', () => {
    for (const limit of [0, -1, 1.5]) {
      expect(codes(activeDef({ operations: [cleanseOp({}, limit)] }))).toContain(
        'malformed_cleanse_query',
      )
    }
  })

  it('rejects unknown kind/polarity/element values', () => {
    expect(codes(activeDef({ operations: [cleanseOp({ kind: 'curse' })] }))).toContain('malformed_cleanse_query')
    expect(codes(activeDef({ operations: [cleanseOp({ polarity: 'neutral' })] }))).toContain('malformed_cleanse_query')
    expect(codes(activeDef({ operations: [cleanseOp({ element: 'wind' })] }))).toContain('malformed_cleanse_query')
  })

  it('rejects an unresolvable query.definitionId when a predicate is injected', () => {
    expect(
      codes(activeDef({ operations: [cleanseOp({ definitionId: 'no_such_buff' })] })),
    ).toContain('unknown_reference')
  })
})

describe('SkillDefinition validation -- loop_target binding', () => {
  it('rejects loop_target outside for_each_target', () => {
    const def = activeDef({
      operations: [{ type: 'deal_damage', target: 'loop_target', coefficient: 1 }],
    })
    expect(codes(def)).toContain('loop_target_outside_for_each')
  })

  it('rejects loop_target in a condition outside for_each_target', () => {
    const def = activeDef({
      operations: [
        {
          type: 'if',
          condition: { kind: 'stacks_at_least', target: 'loop_target', definitionId: 'hoa_an', stacks: 1 },
          then: [{ type: 'deal_damage', target: 'primary_target', coefficient: 1 }],
        },
      ],
    })
    expect(codes(def)).toContain('loop_target_outside_for_each')
  })

  it('accepts loop_target inside for_each_target ops AND conditions', () => {
    const def = activeDef({
      operations: [
        {
          type: 'for_each_target',
          target: 'affected_targets',
          ops: [
            {
              type: 'if',
              condition: { kind: 'stacks_at_least', target: 'loop_target', definitionId: 'hoa_an', stacks: 2 },
              then: [{ type: 'deal_damage', target: 'loop_target', coefficient: 0.5 }],
            },
          ],
        },
      ],
    })
    expect(validateSkillDefinition(def, deps)).toEqual([])
  })

  it('rejects for_each_target iterating loop_target itself', () => {
    const def = activeDef({
      operations: [
        {
          type: 'for_each_target',
          target: 'loop_target',
          ops: [{ type: 'heal', target: 'loop_target', amount: 5 }],
        },
      ],
    })
    expect(codes(def)).toContain('invalid_field_value')
  })
})

describe('SkillDefinition validation -- damage policies (contract v1.6)', () => {
  it('accepts declared policies on a coefficient-carrying deal_damage', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          hitPolicy: { guaranteedHit: true },
          critPolicy: { bonusChance: 0.25 },
          armorPolicy: { bypassChance: 0.4, pierceFractionOnFail: 0.5 },
        },
      ],
    })
    expect(validateSkillDefinition(def, deps)).toEqual([])
  })

  it('rejects critPolicy + canCrit:false as contradictory', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          canCrit: false,
          critPolicy: { bonusChance: 0.2 },
        },
      ],
    })
    expect(codes(def)).toContain('contradictory_damage_policy')
  })

  it('rejects policies on a hitless op (no coefficient)', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          hitPolicy: { guaranteedHit: true },
          consumeBuff: { definitionId: 'hoa_an', damagePerStack: 0.5 },
        },
      ],
    })
    expect(codes(def)).toContain('policy_without_hit')
  })

  it('rejects armorPolicy on an explicitly all-elemental op', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          components: [{ kind: 'element', element: 'fire', ratio: 1 }],
          armorPolicy: { bypassChance: 0.5 },
        },
      ],
    })
    expect(codes(def)).toContain('contradictory_damage_policy')
  })

  it('accepts armorPolicy on a physical-component op', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          components: [
            { kind: 'physical', ratio: 0.5 },
            { kind: 'element', element: 'fire', ratio: 0.5 },
          ],
          armorPolicy: { bypassChance: 0.5 },
        },
      ],
    })
    expect(validateSkillDefinition(def, deps)).toEqual([])
  })
})

describe('SkillDefinition validation -- CON-01 runtime-id guard', () => {
  it('rejects runtime id keys anywhere in the tree', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: 1,
          targetId: 'entity.b',
        } as unknown as AuthoredSkillOperation,
      ],
    })
    expect(codes(def)).toContain('runtime_id_field')
  })

  it('rejects nested runtime ids inside if branches', () => {
    const def = activeDef({
      operations: [
        {
          type: 'if',
          condition: { kind: 'any_target_landed' },
          then: [
            {
              type: 'apply_buff',
              target: 'self',
              definitionId: 'ung_the',
              instanceId: 'bi.9',
            } as unknown as AuthoredSkillOperation,
          ],
        },
      ],
    })
    expect(codes(def)).toContain('runtime_id_field')
  })
})

describe('SkillDefinition validation -- expressions + references', () => {
  it('rejects malformed ScalarExpression nodes', () => {
    const def = activeDef({
      operations: [
        {
          type: 'deal_damage',
          target: 'primary_target',
          coefficient: { op: 'pow', values: [2, 3] } as unknown as ScalarExpression,
        },
      ],
    })
    expect(codes(def)).toContain('malformed_expression')
  })

  it('rejects unresolvable buff refs when a predicate is injected', () => {
    const def = activeDef({
      operations: [{ type: 'apply_buff', target: 'self', definitionId: 'no_such' }],
    })
    expect(codes(def)).toContain('unknown_reference')
  })

  it('rejects empty compositePool and non-[0,1] multicast chance', () => {
    expect(codes(activeDef({ subcasts: { compositePool: [] } }))).toContain('empty_composite_pool')
    expect(
      codes(activeDef({ subcasts: { multicast: { chance: 1.5, maxExtraCasts: 2 } } })),
    ).toContain('invalid_field_value')
  })
})

// ---------------------------------------------------------------------------
// Evaluators -- pure AST semantics over a stub read context.
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<SkillReadContext> = {}): SkillReadContext {
  const targets: Record<string, CombatEntityId> = {
    self: 'entity.a',
    primary_target: 'entity.b',
    loop_target: 'entity.c',
  }
  return {
    resolveTarget: (intent) => targets[intent],
    buffStacks: () => 3,
    buffDuration: () => 4,
    hpPercent: (id) => (id === 'entity.b' ? 0.4 : 1),
    resourceCurrent: () => 7,
    resourceMax: () => 10,
    resourceSnapshot: () => 5,
    statScalar: (key) => (key === 'realmIndex' ? 6 : 0),
    skillLevel: () => 9,
    readVar: (name) => (name === 'x' ? 42 : 0),
    alive: (id) => id !== 'entity.c',
    critLanded: () => true,
    anyTargetLanded: () => false,
    ...overrides,
  }
}

describe('evaluateScalarExpression -- pure AST', () => {
  const ctx = makeCtx()
  const evalExpr = (e: ScalarExpression) => evaluateScalarExpression(e, ctx)

  it('evaluates literals and arithmetic ops', () => {
    expect(evalExpr(5)).toBe(5)
    expect(evalExpr({ op: 'add', values: [1, 2, 3] })).toBe(6)
    expect(evalExpr({ op: 'multiply', values: [2, 3, 4] })).toBe(24)
    expect(evalExpr({ op: 'subtract', left: 10, right: 4 })).toBe(6)
    expect(evalExpr({ op: 'divide', left: 10, right: 4 })).toBe(2.5)
  })

  it('divide guards zero -> 0', () => {
    expect(evalExpr({ op: 'divide', left: 10, right: 0 })).toBe(0)
  })

  it('min/max/clamp', () => {
    expect(evalExpr({ op: 'min', values: [3, 1, 2] })).toBe(1)
    expect(evalExpr({ op: 'max', values: [3, 1, 2] })).toBe(3)
    expect(evalExpr({ op: 'clamp', value: 12, min: 0, max: 10 })).toBe(10)
    expect(evalExpr({ op: 'clamp', value: -3, min: 0, max: 10 })).toBe(0)
  })

  it('if picks branches on the evaluated condition', () => {
    const expr: ScalarExpression = {
      op: 'if',
      condition: { kind: 'resource_at_least', resourceId: 'the', amount: 5 },
      then: 100,
      else: 1,
    }
    expect(evalExpr(expr)).toBe(100)
    expect(evaluateScalarExpression(expr, makeCtx({ resourceCurrent: () => 2 }))).toBe(1)
  })

  it('value queries route through the read context', () => {
    expect(evalExpr({ query: 'buff_stacks', target: 'primary_target', definitionId: 'hoa_an' })).toBe(3)
    expect(evalExpr({ query: 'hp_percent', target: 'primary_target' })).toBe(0.4)
    expect(evalExpr({ query: 'resource_current', target: 'self', resourceId: 'the' })).toBe(7)
    expect(evalExpr({ query: 'resource_snapshot', resourceId: 'the' })).toBe(5)
    expect(evalExpr({ query: 'stat_scalar', key: 'realmIndex' })).toBe(6)
    expect(evalExpr({ query: 'skill_level' })).toBe(9)
    expect(evalExpr({ query: 'var', name: 'x' })).toBe(42)
    expect(evalExpr({ query: 'cast_outcome', field: 'any_crit' })).toBe(1)
    expect(evalExpr({ query: 'cast_outcome', field: 'landed' })).toBe(0)
  })

  it('nested expression: min(0.5, 0.1 * realmIndex) -- Ngu execute threshold', () => {
    const expr: ScalarExpression = {
      op: 'min',
      values: [0.5, { op: 'multiply', values: [0.1, { query: 'stat_scalar', key: 'realmIndex' }] }],
    }
    expect(evalExpr(expr)).toBe(0.5)
    expect(evaluateScalarExpression(expr, makeCtx({ statScalar: () => 2 }))).toBe(0.2)
  })
})

describe('evaluateSkillCondition -- authored conditions', () => {
  const ctx = makeCtx()

  it('stacks_at_least / hp_percent_below / resource_at_least', () => {
    expect(
      evaluateSkillCondition(
        { kind: 'stacks_at_least', target: 'primary_target', definitionId: 'hoa_an', stacks: 3 },
        ctx,
      ),
    ).toBe(true)
    expect(
      evaluateSkillCondition(
        { kind: 'hp_percent_below', target: 'primary_target', threshold: 0.5 },
        ctx,
      ),
    ).toBe(true)
    expect(
      evaluateSkillCondition(
        { kind: 'hp_percent_below', target: 'self', threshold: 0.5 },
        ctx,
      ),
    ).toBe(false)
    expect(
      evaluateSkillCondition({ kind: 'resource_at_least', resourceId: 'the', amount: 7 }, ctx),
    ).toBe(true)
  })

  it('target_alive defaults to primary_target; loop_target resolves through ctx', () => {
    expect(evaluateSkillCondition({ kind: 'target_alive' }, ctx)).toBe(true)
    expect(
      evaluateSkillCondition({ kind: 'target_alive', target: 'loop_target' }, ctx),
    ).toBe(false)
  })

  it('var comparisons + cast-scope conditions', () => {
    expect(evaluateSkillCondition({ kind: 'var', name: 'x', op: 'gte', value: 40 }, ctx)).toBe(true)
    expect(evaluateSkillCondition({ kind: 'var', name: 'x', op: 'lt', value: 40 }, ctx)).toBe(false)
    expect(evaluateSkillCondition({ kind: 'var', name: 'x', op: 'eq', value: 42 }, ctx)).toBe(true)
    expect(evaluateSkillCondition({ kind: 'crit_landed' }, ctx)).toBe(true)
    expect(evaluateSkillCondition({ kind: 'any_target_landed' }, ctx)).toBe(false)
  })
})

describe('SkillDefinition validation -- same-source buff access (canonical-seals S0.4)', () => {
  const identitySelector = {
    kind: 'identity' as const,
    definitionId: 'hoa_an' as BuffDefinitionId,
    source: 'self' as const,
    target: 'primary_target' as const,
  }

  it('accepts identity + target_definition selectors on buff mutation ops', () => {
    expect(
      validateSkillDefinition(
        activeDef({
          operations: [
            {
              type: 'add_buff_stacks',
              selector: identitySelector,
              stacks: 1,
            },
            {
              type: 'trigger_buff_periodic',
              selector: {
                kind: 'target_definition',
                target: 'all_enemies',
                definitionId: 'hoa_an',
              },
            },
          ],
        }),
        deps,
      ),
    ).toEqual([])
  })

  it('rejects a set-valued SOURCE on an identity selector', () => {
    const op: AuthoredSkillOperation = {
      type: 'add_buff_modifier',
      selector: {
        kind: 'identity',
        definitionId: 'hoa_an',
        source: 'all_allies',
        target: 'primary_target',
      },
      modifier: {
        id: 'm.1',
        channel: 'potency',
        operation: 'add',
        value: 1,
        reapply: 'replace',
        priority: 0,
        lifetime: { type: 'buff_lifetime' },
      },
    }
    expect(codes(activeDef({ operations: [op] }))).toContain('invalid_field_value')
  })

  it('rejects set-valued target/source on read_stacks', () => {
    const setTarget: AuthoredSkillOperation = {
      type: 'read_stacks',
      target: 'all_enemies',
      definitionId: 'hoa_an',
      into: 'x',
    }
    expect(codes(activeDef({ operations: [setTarget] }))).toContain(
      'invalid_field_value',
    )
    const setSource: AuthoredSkillOperation = {
      type: 'read_stacks',
      target: 'primary_target',
      source: 'affected_targets',
      definitionId: 'hoa_an',
      into: 'x',
    }
    expect(codes(activeDef({ operations: [setSource] }))).toContain(
      'invalid_field_value',
    )
  })

  it('onLanded inspects selector.target/source, not only op.target', () => {
    const hit: AuthoredSkillOperation = {
      type: 'deal_damage',
      target: 'primary_target',
      coefficient: 1,
      onLanded: [
        {
          type: 'add_buff_stacks',
          selector: {
            kind: 'identity',
            definitionId: 'hoa_an',
            source: 'self',
            target: 'primary_target', // bypass: top-level has no target now
          },
          stacks: 1,
        },
      ],
    }
    expect(codes(activeDef({ operations: [hit] }))).toContain(
      'invalid_field_value',
    )
    const legal: AuthoredSkillOperation = {
      ...hit,
      onLanded: [
        {
          type: 'add_buff_stacks',
          selector: { ...identitySelector, target: 'loop_target' },
          stacks: 1,
        },
      ],
    }
    expect(
      validateSkillDefinition(activeDef({ operations: [legal] }), deps),
    ).toEqual([])
  })
})
