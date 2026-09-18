import { describe, expect, it } from 'vitest'

import type { BuffDefinitionId, CombatEntityId, CombatOperationId } from '../battle/contracts/ids'

import {
  evaluateResolvedCondition,
  evaluateResolvedScalar,
  type ResolvedScalarExpression,
  type ResolvedSkillReadContext,
} from './ResolvedSkillPlan'

const T = 'entity.target' as CombatEntityId
const S = 'entity.source' as CombatEntityId
const BURN = 'ailment.burn' as BuffDefinitionId
const OP1 = 'op.cast.0.0.0' as CombatOperationId
const OP2 = 'op.cast.0.0.1' as CombatOperationId

/** Scriptable read context -- every read surfaces through one narrow port. */
function ctx(overrides: Partial<ResolvedSkillReadContext> = {}): ResolvedSkillReadContext {
  return {
    buffStacks: () => 4,
    buffDuration: () => 6,
    hpPercent: () => 0.42,
    hpMax: () => 1000,
    resourceCurrent: () => 30,
    resourceMax: () => 100,
    resourceSnapshot: () => 88,
    statScalar: () => 12,
    skillLevel: () => 5,
    readVar: () => 0,
    alive: () => true,
    critLanded: () => false,
    anyTargetLanded: () => false,
    opResult: () => 0,
    opsLandedAny: () => 0,
    opsResultSum: () => 0,
    ...overrides,
  }
}

describe('evaluateResolvedScalar -- arithmetic', () => {
  it('evaluates literals and nested arithmetic', () => {
    expect(evaluateResolvedScalar(5, ctx())).toBe(5)
    expect(evaluateResolvedScalar({ op: 'add', values: [1, 2, 3] }, ctx())).toBe(6)
    expect(evaluateResolvedScalar({ op: 'multiply', values: [2, 3, 4] }, ctx())).toBe(24)
    expect(evaluateResolvedScalar({ op: 'subtract', left: 10, right: 3 }, ctx())).toBe(7)
    expect(evaluateResolvedScalar({ op: 'divide', left: 10, right: 4 }, ctx())).toBe(2.5)
  })

  it('guards divide-by-zero to 0 (authored formulas never fault)', () => {
    expect(
      evaluateResolvedScalar(
        { op: 'divide', left: { query: 'buff_stacks', targetId: T, definitionId: BURN }, right: 0 },
        ctx(),
      ),
    ).toBe(0)
  })

  it('evaluates min/max/clamp', () => {
    expect(evaluateResolvedScalar({ op: 'min', values: [3, 1, 2] }, ctx())).toBe(1)
    expect(evaluateResolvedScalar({ op: 'max', values: [3, 1, 2] }, ctx())).toBe(3)
    expect(
      evaluateResolvedScalar({ op: 'clamp', value: 12, min: 0, max: 10 }, ctx()),
    ).toBe(10)
  })

  it('evaluates query leaves through the read context', () => {
    expect(
      evaluateResolvedScalar(
        { query: 'buff_stacks', targetId: T, definitionId: BURN, sourceId: S },
        ctx({ buffStacks: (d, t, s) => (d === BURN && t === T && s === S ? 7 : 0) }),
      ),
    ).toBe(7)
    expect(
      evaluateResolvedScalar({ query: 'hp_percent', targetId: T }, ctx()),
    ).toBe(0.42)
    expect(
      evaluateResolvedScalar({ query: 'hp_max', targetId: T }, ctx()),
    ).toBe(1000)
    expect(
      evaluateResolvedScalar({ query: 'var', name: 'stacks' }, ctx({ readVar: (n) => (n === 'stacks' ? 9 : 0) })),
    ).toBe(9)
    expect(
      evaluateResolvedScalar(
        { query: 'op_result', operationId: OP1, field: 'hpDamage' },
        ctx({ opResult: (id, f) => (id === OP1 && f === 'hpDamage' ? 250 : 0) }),
      ),
    ).toBe(250)
  })

  it('evaluates if nodes through resolved conditions', () => {
    const expr: ResolvedScalarExpression = {
      op: 'if',
      condition: { kind: 'target_alive', targetId: T },
      then: 100,
      else: 0,
    }
    expect(evaluateResolvedScalar(expr, ctx({ alive: (id) => id === T }))).toBe(100)
    expect(evaluateResolvedScalar(expr, ctx({ alive: () => false }))).toBe(0)
  })
})

describe('evaluateResolvedCondition', () => {
  it('stacks_at_least / hp_percent_below / resource_at_least read live state', () => {
    expect(
      evaluateResolvedCondition(
        { kind: 'stacks_at_least', targetId: T, definitionId: BURN, stacks: 3 },
        ctx(),
      ),
    ).toBe(true)
    expect(
      evaluateResolvedCondition(
        { kind: 'stacks_at_least', targetId: T, definitionId: BURN, stacks: 5 },
        ctx(),
      ),
    ).toBe(false)
    expect(
      evaluateResolvedCondition(
        { kind: 'hp_percent_below', targetId: T, threshold: 0.5 },
        ctx(),
      ),
    ).toBe(true)
    expect(
      evaluateResolvedCondition(
        { kind: 'resource_at_least', targetId: S, resourceId: 'mp', amount: 40 },
        ctx(),
      ),
    ).toBe(false)
    expect(
      evaluateResolvedCondition(
        { kind: 'resource_at_least', targetId: S, resourceId: 'mp', amount: 30 },
        ctx(),
      ),
    ).toBe(true)
  })

  it('var supports the full comparison set (gte/lt/eq/gt/lte)', () => {
    const c = ctx({ readVar: (n) => (n === 'v' ? 10 : 0) })
    expect(evaluateResolvedCondition({ kind: 'var', name: 'v', op: 'gte', value: 10 }, c)).toBe(true)
    expect(evaluateResolvedCondition({ kind: 'var', name: 'v', op: 'lt', value: 10 }, c)).toBe(false)
    expect(evaluateResolvedCondition({ kind: 'var', name: 'v', op: 'eq', value: 10 }, c)).toBe(true)
    expect(evaluateResolvedCondition({ kind: 'var', name: 'v', op: 'gt', value: 9 }, c)).toBe(true)
    expect(evaluateResolvedCondition({ kind: 'var', name: 'v', op: 'lte', value: 10 }, c)).toBe(true)
  })

  it('crit_landed / any_target_landed / target_alive read cast + entity state', () => {
    const c = ctx({ critLanded: () => true, anyTargetLanded: () => true })
    expect(evaluateResolvedCondition({ kind: 'crit_landed' }, c)).toBe(true)
    expect(evaluateResolvedCondition({ kind: 'any_target_landed' }, c)).toBe(true)
    expect(
      evaluateResolvedCondition({ kind: 'target_alive', targetId: T }, ctx({ alive: () => false })),
    ).toBe(false)
  })
})

describe('resolved plan invariants', () => {
  it('resolved queries bind concrete ids -- undefined marks an unbound optional context', () => {
    const c = ctx({
      buffStacks: (_d, t) => (t === undefined ? -1 : 4),
      hpPercent: (t) => (t === undefined ? -1 : 0.5),
    })
    // executor-side contract: unresolved-context reads return neutral
    // values; the ctx implementation decides the neutral.
    expect(
      evaluateResolvedScalar(
        { query: 'buff_stacks', targetId: undefined, definitionId: BURN },
        c,
      ),
    ).toBe(-1)
    expect(evaluateResolvedScalar({ query: 'hp_percent', targetId: undefined }, c)).toBe(-1)
  })

  it('cast_outcome / op_result leaves read executor-tracked state', () => {
    const c = ctx({
      opsLandedAny: (ids) => (ids.includes(OP2) ? 1 : 0),
      opsResultSum: (ids, f) =>
        ids.reduce<number>((sum, id) => sum + (f === 'hpDamage' && id === OP1 ? 100 : f === 'hpDamage' && id === OP2 ? 50 : 0), 0),
      anyTargetLanded: () => true,
    })
    expect(evaluateResolvedScalar({ query: 'cast_outcome', field: 'landed' }, c)).toBe(1)
    expect(evaluateResolvedScalar({ query: 'cast_outcome', field: 'any_crit' }, c)).toBe(0)
    expect(
      evaluateResolvedScalar(
        { query: 'op_result', operationId: OP1, field: 'hpDamage' },
        ctx({ opResult: () => 100 }),
      ),
    ).toBe(100)
  })
})
