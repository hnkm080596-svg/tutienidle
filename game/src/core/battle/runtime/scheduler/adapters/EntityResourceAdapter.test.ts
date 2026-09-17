// EntityResourceAdapter.test.ts -- M3 resource-authority adapter.
// currentThe pool only (direct mutation matches TheEconomy's practice);
// 'mp'/'ward' resource ids are deferred and structurally fault.

import { describe, expect, it } from 'vitest'

import type { CombatEntity } from '../../../../combat/CombatEntity'
import { MAX_THE } from '../../../../combat/CombatTypes'
import { createBaseStats } from '../../../../stats/StatBlock'
import type { Stats } from '../../../../stats/StatBlock'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatOperationOrigin } from '../../../contracts/origin'
import type { CombatEntityId } from '../../../contracts/ids'

import { CombatOperationSkip } from '../CombatOperationExecutor'
import { CombatSettlementFault } from '../CombatSettlementFault'
import { EntityResourceAdapter } from './EntityResourceAdapter'

function makeEntity(
  id: string,
  statOverrides: Partial<Stats> = {},
  overrides: Partial<CombatEntity> = {},
): CombatEntity {
  const stats = createBaseStats(statOverrides)
  return {
    id,
    name: id,
    type: 'enemy',
    stats,
    baseStats: stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: 0,
    realmIndex: 0,
    x: 0,
    row: 0 as never,
    alive: true,
    ...overrides,
  }
}

function makeAdapter(entities: CombatEntity[]) {
  const map = new Map<CombatEntityId, CombatEntity>(entities.map((e) => [e.id, e]))
  return new EntityResourceAdapter((id) => map.get(id))
}

const CTX: CombatAuthorityExecutionContext = {
  operationId: 'op.test',
  origin: {
    kind: 'skill',
    originId: 'test.origin',
    sourceId: 'source',
    rootActionId: 'root.test',
  } satisfies CombatOperationOrigin,
  events: { emit: () => {} },
}

describe('EntityResourceAdapter -- currentThe', () => {
  it("consume('all') drains the pool and reports { before, requested:'all', applied, after }", () => {
    const entity = makeEntity('caster', {}, { currentThe: 40 })
    const adapter = makeAdapter([entity])

    const result = adapter.consume('caster', 'the', 'all', undefined, CTX)

    expect(result).toEqual({ before: 40, requested: 'all', applied: 40, after: 0 })
    expect(entity.currentThe).toBe(0)
  })

  it('gain adds through the single clamp authority (cap = maxThe ?? MAX_THE)', () => {
    const entity = makeEntity('caster', {}, { currentThe: 90 })
    const adapter = makeAdapter([entity])

    const result = adapter.gain('caster', 'the', 30, CTX)

    expect(result).toEqual({ before: 90, requested: 30, applied: 10, after: MAX_THE })
    expect(entity.currentThe).toBe(MAX_THE)
  })

  it('consume(n) subtracts a payable amount', () => {
    const entity = makeEntity('caster', {}, { currentThe: 40 })
    const adapter = makeAdapter([entity])

    const result = adapter.consume('caster', 'the', 15, undefined, CTX)

    expect(result).toEqual({ before: 40, requested: 15, applied: 15, after: 25 })
    expect(entity.currentThe).toBe(25)
  })

  it('consume(n) beyond the pool skips insufficient_resource and mutates nothing', () => {
    const entity = makeEntity('caster', {}, { currentThe: 40 })
    const adapter = makeAdapter([entity])

    try {
      adapter.consume('caster', 'the', 41, undefined, CTX)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(CombatOperationSkip)
      expect((error as CombatOperationSkip).reason).toBe('insufficient_resource')
    }
    expect(entity.currentThe).toBe(40)
  })

  it('an uninitialized pool reads as 0 (gain works, consume skips)', () => {
    const entity = makeEntity('caster') // currentThe undefined
    const adapter = makeAdapter([entity])

    try {
      adapter.consume('caster', 'the', 1, undefined, CTX)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as CombatOperationSkip).reason).toBe('insufficient_resource')
    }

    const gained = adapter.gain('caster', 'the', 20, CTX)
    expect(gained).toEqual({ before: 0, requested: 20, applied: 20, after: 20 })
  })
})

describe('EntityResourceAdapter -- valueSource (P5 F-B)', () => {
  it("numeric 'cast_snapshot' consumes exactly the frozen amount (later gains do not inflate)", () => {
    const entity = makeEntity('caster', {}, { currentThe: 40 })
    const adapter = makeAdapter([entity])

    const result = adapter.consume('caster', 'the', 15, 'cast_snapshot', CTX)

    expect(result).toEqual({ before: 40, requested: 15, applied: 15, after: 25 })
    expect(entity.currentThe).toBe(25)
  })

  it("numeric 'cast_snapshot' shares the insufficient check -- cannot spend what is not there", () => {
    const entity = makeEntity('caster', {}, { currentThe: 40 })
    const adapter = makeAdapter([entity])

    try {
      adapter.consume('caster', 'the', 41, 'cast_snapshot', CTX)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(CombatOperationSkip)
      expect((error as CombatOperationSkip).reason).toBe('insufficient_resource')
    }
    expect(entity.currentThe).toBe(40)
  })

  it("'all' + 'cast_snapshot' is contradictory -> CombatSettlementFault, no mutation", () => {
    const entity = makeEntity('caster', {}, { currentThe: 40 })
    const adapter = makeAdapter([entity])

    expect(() =>
      adapter.consume('caster', 'the', 'all', 'cast_snapshot', CTX),
    ).toThrow(CombatSettlementFault)
    expect(entity.currentThe).toBe(40)
  })

  it('an unknown valueSource value is malformed -> CombatSettlementFault', () => {
    const entity = makeEntity('caster', {}, { currentThe: 40 })
    const adapter = makeAdapter([entity])

    expect(() =>
      adapter.consume(
        'caster',
        'the',
        5,
        'bogus' as unknown as 'current',
        CTX,
      ),
    ).toThrow(CombatSettlementFault)
    expect(entity.currentThe).toBe(40)
  })
})

describe('EntityResourceAdapter -- structure', () => {
  it('throws CombatSettlementFault on a resourceId with no wired channel (mp/ward deferred)', () => {
    const entity = makeEntity('caster')
    const adapter = makeAdapter([entity])

    expect(() => adapter.gain('caster', 'mp', 10, CTX)).toThrow(CombatSettlementFault)
    expect(() => adapter.consume('caster', 'ward', 10, undefined, CTX)).toThrow(CombatSettlementFault)
  })

  it('throws CombatOperationSkip(invalid_target_state) on an unresolvable entity', () => {
    const adapter = makeAdapter([])

    try {
      adapter.gain('ghost', 'the', 10, CTX)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(CombatOperationSkip)
      expect((error as CombatOperationSkip).reason).toBe('invalid_target_state')
    }
  })
})
