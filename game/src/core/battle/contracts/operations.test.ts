import { describe, expect, it } from 'vitest'

import type { CombatOperationOrigin } from './origin'
import type {
  ApplyBuffOperation,
  CombatOperation,
  DealDamageOperation,
  ResolvedCombatOperation,
} from './operations'
import type { CombatOperationResult } from './results'
import { assertValidSelector, type BuffInstanceSelector } from './selectors'

const ORIGIN: CombatOperationOrigin = {
  kind: 'reaction',
  originId: 'dung_kim',
  sourceId: 'entity.a',
  rootActionId: 'action.turn.3.cast.1',
  parentOperationId: 'op.9',
  causationEventId: 'evt.op.9.0',
  reactionId: 'dung_kim',
}

const DAMAGE_OP: ResolvedCombatOperation = {
  operationId: 'op.10',
  type: 'deal_damage',
  origin: ORIGIN,
  payload: {
    targetId: 'entity.b',
    element: 'fire',
    damageProfile: 'reaction_standard',
    coefficient: 12,
    hitCount: 1,
    canCrit: false,
    canMiss: false,
    tags: ['reaction'],
  },
}

describe('CombatOperation union', () => {
  it('discriminates all 16 members by type', () => {
    const ops: CombatOperation[] = [
      DAMAGE_OP,
      { type: 'heal', payload: { targetId: 'entity.a', amount: 25 } },
      {
        type: 'apply_buff',
        payload: {
          definitionId: 'hoa_an',
          targetId: 'entity.b',
          stacks: 2,
          baseChance: 0.8,
          reactionEligibility: 'eligible',
        },
      },
      {
        type: 'add_buff_stacks',
        payload: { selector: { kind: 'instance', instanceId: 'bi.1' }, stacks: 3 },
      },
      {
        type: 'remove_buff_stacks',
        payload: { selector: { kind: 'instance', instanceId: 'bi.1' }, stacks: 1 },
      },
      {
        type: 'consume_buff_stacks',
        payload: {
          selector: { kind: 'instance', instanceId: 'bi.1' },
          stacks: 'all',
          removalReason: 'reaction',
        },
      },
      {
        type: 'add_buff_modifier',
        payload: {
          selector: { kind: 'instance', instanceId: 'bi.1' },
          modifier: {
            id: 'liet_diem_next_tick',
            channel: 'next_periodic_damage',
            operation: 'multiply',
            value: 1.5,
            reapply: 'replace',
            priority: 0,
            lifetime: { type: 'uses', remaining: 1 },
          },
        },
      },
      {
        type: 'remove_buff_modifier',
        payload: { selector: { kind: 'instance', instanceId: 'bi.1' }, modifierId: 'm.1' },
      },
      {
        type: 'refresh_buff_duration',
        payload: { selector: { kind: 'instance', instanceId: 'bi.1' }, duration: 3 },
      },
      {
        type: 'extend_buff_duration',
        payload: { selector: { kind: 'instance', instanceId: 'bi.1' }, turns: 2, maxRemaining: 5 },
      },
      {
        type: 'trigger_buff_periodic',
        payload: { selector: { kind: 'instance', instanceId: 'bi.1' }, periodicId: 'tick' },
      },
      {
        type: 'remove_buff',
        payload: {
          selector: { kind: 'holder_definition', holderId: 'entity.b', definitionId: 'hoa_an' },
          removalReason: 'cleansed',
        },
      },
      { type: 'push_gauge', payload: { targetId: 'entity.a', fractionOfMax: 0.35 } },
      {
        type: 'gain_resource',
        payload: { targetId: 'entity.a', resourceId: 'the', amount: 10 },
      },
      {
        type: 'consume_resource',
        payload: {
          targetId: 'entity.a',
          resourceId: 'the',
          amount: 'all',
          valueSource: 'cast_snapshot',
        },
      },
      { type: 'apply_shield', payload: { targetId: 'entity.a', amount: 40 } },
    ]

    expect(ops.map((o) => o.type)).toEqual([
      'deal_damage',
      'heal',
      'apply_buff',
      'add_buff_stacks',
      'remove_buff_stacks',
      'consume_buff_stacks',
      'add_buff_modifier',
      'remove_buff_modifier',
      'refresh_buff_duration',
      'extend_buff_duration',
      'trigger_buff_periodic',
      'remove_buff',
      'push_gauge',
      'gain_resource',
      'consume_resource',
      'apply_shield',
    ])
  })

  it('type owns payload — narrowing exposes the member payload', () => {
    const op: ResolvedCombatOperation = DAMAGE_OP

    if (op.type !== 'deal_damage') {
      throw new Error('expected deal_damage')
    }
    const payload: DealDamageOperation['payload'] = op.payload
    expect(payload.damageProfile).toBe('reaction_standard')
    expect(payload.targetId).toBe('entity.b')
  })

  it('rejects a mismatched payload at the type level', () => {
    // @ts-expect-error — 'heal' can never carry a deal_damage payload
    const bad: CombatOperation = { type: 'heal', payload: { targetId: 'e', damageProfile: 'x', coefficient: 1, hitCount: 1, canCrit: false, canMiss: false } }
    void bad
  })

  it('apply_buff payload omits sourceId — the origin envelope is canonical', () => {
    const op: ApplyBuffOperation = {
      type: 'apply_buff',
      payload: {
        definitionId: 'hoa_an',
        targetId: 'entity.b',
        stacks: 1,
        baseChance: 1,
        reactionEligibility: 'suppressed',
      },
    }
    expect(op.payload.targetId).toBe('entity.b')

    // @ts-expect-error — payload omits sourceId; origin.sourceId is the single canonical source (r2 HIGH 3)
    const bad: ApplyBuffOperation = { type: 'apply_buff', payload: { definitionId: 'd', sourceId: 'e1', targetId: 'e2', stacks: 1, baseChance: 1, reactionEligibility: 'eligible' } }
    void bad
  })

  it('ResolvedCombatOperation has no top-level sourceId', () => {
    const op: ResolvedCombatOperation = DAMAGE_OP

    // @ts-expect-error — sourceId lives only on origin (r2 HIGH 3)
    const leaked: unknown = op.sourceId
    expect(leaked).toBeUndefined()
    expect(op.origin.sourceId).toBe('entity.a')
  })

  it('origin carries rootActionId / causationEventId / parentOperationId', () => {
    expect(DAMAGE_OP.origin.rootActionId).toBe('action.turn.3.cast.1')
    expect(DAMAGE_OP.origin.causationEventId).toBe('evt.op.9.0')
    expect(DAMAGE_OP.origin.parentOperationId).toBe('op.9')
  })
})

describe('BuffInstanceSelector', () => {
  it('assertValidSelector accepts every union member', () => {
    expect(() =>
      assertValidSelector({ kind: 'instance', instanceId: 'bi.1' }),
    ).not.toThrow()
    expect(() =>
      assertValidSelector({
        kind: 'identity',
        definitionId: 'hoa_an',
        sourceId: 'entity.a',
        targetId: 'entity.b',
      }),
    ).not.toThrow()
    expect(() =>
      assertValidSelector({
        kind: 'holder_definition',
        holderId: 'entity.b',
        definitionId: 'hoa_an',
      }),
    ).not.toThrow()
  })

  it('assertValidSelector rejects malformed input', () => {
    const malformed: unknown[] = [
      null,
      undefined,
      42,
      'instance',
      {},
      { kind: 'nope' },
      { kind: 'instance' },
      { kind: 'instance', instanceId: 5 },
      { kind: 'identity', definitionId: 'd', sourceId: 'a' },
      { kind: 'identity', definitionId: 'd', sourceId: 'a', targetId: 7 },
      { kind: 'holder_definition', holderId: 'h' },
      { kind: 'holder_definition', definitionId: 'd', holderId: 3 },
    ]

    for (const bad of malformed) {
      expect(() => assertValidSelector(bad)).toThrow()
    }
  })

  it('rejects {} / partial identity / unknown kinds at the type level', () => {
    // @ts-expect-error — empty object is not a selector
    const empty: BuffInstanceSelector = {}
    // @ts-expect-error — identity requires sourceId AND targetId
    const partial: BuffInstanceSelector = { kind: 'identity', definitionId: 'd', sourceId: 'a' }
    // @ts-expect-error — unknown kind discriminant
    const bogus: BuffInstanceSelector = { kind: 'bogus', instanceId: 'i' }
    void empty
    void partial
    void bogus
  })
})

describe('CombatOperationResult', () => {
  it('narrows to the member payload by type', () => {
    const result: CombatOperationResult = {
      operationId: 'op.10',
      type: 'apply_buff',
      status: 'resolved',
      result: { applied: false },
    }

    if (result.type !== 'apply_buff') {
      throw new Error('expected apply_buff result')
    }
    expect(result.result?.applied).toBe(false)
  })

  it('a failed application roll is resolved + applied:false, never failed', () => {
    const result: CombatOperationResult = {
      operationId: 'op.11',
      type: 'apply_buff',
      status: 'resolved',
      reason: 'application_roll_failed',
      result: { applied: false },
    }

    expect(result.status).toBe('resolved')
    expect(result.reason).toBe('application_roll_failed')
  })
})
