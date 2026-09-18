// operations.cleanse-limit.test.ts -- contract v1.6: deterministic
// `limit` on CleanseBuffOperation -> BuffAuthority.cleanse -> BuffSystem.
// Legacy remove_buff-by-polarity parity: {polarity, count} maps onto
// {query:{polarity}, limit: count ?? 1}.

import { describe, expect, it } from 'vitest'

import type { CombatAuthorityExecutionContext } from './context'
import type { CleanseBuffOperation, ResolvedCombatOperation } from './operations'
import type { CombatOperationOrigin } from './origin'
import { CombatOperationExecutor } from '../runtime/scheduler/CombatOperationExecutor'
import type { CombatAuthorityPorts } from '../runtime/scheduler/CombatAuthorityPorts'
import {
  makeBuffSystemWorld,
  TEST_ENTITIES,
  type BuffSystemWorld,
} from '../../buff2/testing/BuffTestFixtures'
import type { ApplyBuffRequest } from './operations'
import type { BuffDefinition } from '../../buff2/BuffDefinition'

function applyDef(
  w: BuffSystemWorld,
  overrides: Partial<BuffDefinition>,
  target = TEST_ENTITIES.targetA,
): void {
  const d = w.makeTestDefinition(overrides)
  w.registry.register(d)
  const req: ApplyBuffRequest = {
    definitionId: d.id,
    sourceId: TEST_ENTITIES.sourceA,
    targetId: target,
    stacks: 1,
    baseChance: 1,
    reactionEligibility: 'eligible',
    origin: {
      kind: 'skill',
      originId: 't',
      sourceId: TEST_ENTITIES.sourceA,
      rootActionId: 'r.1',
    },
  }
  w.system.apply(req, w.makeCtx())
}

describe('BuffSystem.cleanse -- contract v1.6 limit', () => {
  it('limit N cleanses the first N dispellable matches in sortedForTarget order', () => {
    const w = makeBuffSystemWorld()
    // sortedForTarget orders by definitionId (same target/source).
    applyDef(w, { id: 'test_buff.aaa', kind: 'debuff', dispellable: true })
    applyDef(w, { id: 'test_buff.bbb', kind: 'debuff', dispellable: true })
    applyDef(w, { id: 'test_buff.ccc', kind: 'debuff', dispellable: true })

    const r = w.system.cleanse(TEST_ENTITIES.targetA, { polarity: 'debuff' }, 2, w.makeCtx())
    expect(r.cleansed).toHaveLength(2)
    const remaining = w.store.forTarget(TEST_ENTITIES.targetA).map((i) => i.definitionId)
    expect(remaining).toEqual(['test_buff.ccc'])
  })

  it('limit 1 preserves legacy remove_buff default-count-1 semantics', () => {
    const w = makeBuffSystemWorld()
    applyDef(w, { id: 'test_buff.aaa', kind: 'debuff', dispellable: true })
    applyDef(w, { id: 'test_buff.bbb', kind: 'ailment', dispellable: true })

    // polarity:'debuff' covers debuff+ailment -- the legacy parity lane.
    const r = w.system.cleanse(TEST_ENTITIES.targetA, { polarity: 'debuff' }, 1, w.makeCtx())
    expect(r.cleansed).toHaveLength(1)
    expect(w.store.forTarget(TEST_ENTITIES.targetA)).toHaveLength(1)
  })

  it('undefined limit keeps the remove-all-matching behavior', () => {
    const w = makeBuffSystemWorld()
    applyDef(w, { id: 'test_buff.aaa', kind: 'debuff', dispellable: true })
    applyDef(w, { id: 'test_buff.bbb', kind: 'debuff', dispellable: true })

    const r = w.system.cleanse(TEST_ENTITIES.targetA, { kind: 'debuff' }, undefined, w.makeCtx())
    expect(r.cleansed).toHaveLength(2)
    expect(w.store.forTarget(TEST_ENTITIES.targetA)).toHaveLength(0)
  })

  it('limit larger than the match count cleanses everything', () => {
    const w = makeBuffSystemWorld()
    applyDef(w, { id: 'test_buff.aaa', kind: 'debuff', dispellable: true })
    const r = w.system.cleanse(TEST_ENTITIES.targetA, { kind: 'debuff' }, 99, w.makeCtx())
    expect(r.cleansed).toHaveLength(1)
  })

  it('non-dispellable matches still land in skipped and do not consume the limit', () => {
    const w = makeBuffSystemWorld()
    applyDef(w, { id: 'test_buff.aaa', kind: 'debuff', dispellable: false })
    applyDef(w, { id: 'test_buff.bbb', kind: 'debuff', dispellable: true })
    applyDef(w, { id: 'test_buff.ccc', kind: 'debuff', dispellable: true })

    const r = w.system.cleanse(TEST_ENTITIES.targetA, { kind: 'debuff' }, 1, w.makeCtx())
    expect(r.cleansed).toHaveLength(1)
    expect(r.skipped).toHaveLength(1)
    // limit-bound third match is left in place, not reported.
    expect(w.store.forTarget(TEST_ENTITIES.targetA)).toHaveLength(2)
  })
})

describe('CleanseBuffOperation -- executor dispatch carries limit', () => {
  it('routes targetId + query + limit to BuffAuthority.cleanse', () => {
    const calls: { method: string; args: readonly unknown[] }[] = []
    const ports: CombatAuthorityPorts = {
      buffs: {
        cleanse: (...args: unknown[]) => {
          calls.push({ method: 'cleanse', args })
          return { cleansed: ['bi.1'], skipped: [] }
        },
      } as unknown as CombatAuthorityPorts['buffs'],
    }
    const executor = new CombatOperationExecutor(ports)
    const origin: CombatOperationOrigin = {
      kind: 'skill',
      originId: 'skill.test',
      sourceId: 'entity.a',
      rootActionId: 'root.1',
    }
    const payload: CleanseBuffOperation['payload'] = {
      targetId: 'entity.b',
      query: { polarity: 'debuff' },
      limit: 1,
    }
    const op: ResolvedCombatOperation = {
      type: 'cleanse_buff',
      payload,
      operationId: 'op.cleanse.1',
      origin,
    }
    const ctx: CombatAuthorityExecutionContext = {
      operationId: op.operationId,
      origin,
      events: { emit: () => undefined },
      combatSequence: 1,
    }
    const result = executor.execute(op, ctx)
    expect(result.status).toBe('resolved')
    expect(calls).toHaveLength(1)
    // port signature: (targetId, query, limit, ctx)
    expect(calls[0]?.args[0]).toBe('entity.b')
    expect(calls[0]?.args[1]).toEqual({ polarity: 'debuff' })
    expect(calls[0]?.args[2]).toBe(1)
  })
})
