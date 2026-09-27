import { describe, expect, it } from 'vitest'
import type { CombatEntity } from '../combat/CombatEntity'
import { consumeThe, drainAllThe, grantThe, theCap, tryPayProcCost } from './TheEconomy'

// Module-level write-site guards: the adapter layer rejects non-finite
// amounts, but these functions are also called directly (proc economy,
// dormant lanes). A NaN reaching the clamp writes NaN into currentThe --
// every later '>=' fails silently and the pool is bricked mid-battle.
describe('TheEconomy write-site guards', () => {
  it('grantThe ignores non-finite and non-positive amounts', () => {
    const entity: { currentThe?: number; maxThe?: number } = { currentThe: 10, maxThe: 100 }
    grantThe(entity, Number.NaN)
    expect(entity.currentThe).toBe(10)
    grantThe(entity, Number.POSITIVE_INFINITY)
    expect(entity.currentThe).toBe(10)
    grantThe(entity, 0)
    expect(entity.currentThe).toBe(10)
    grantThe(entity, -5)
    expect(entity.currentThe).toBe(10)
  })

  it('consumeThe ignores non-finite and non-positive amounts', () => {
    const entity: { currentThe?: number } = { currentThe: 10 }
    consumeThe(entity, Number.NaN)
    expect(entity.currentThe).toBe(10)
    consumeThe(entity, Number.POSITIVE_INFINITY)
    expect(entity.currentThe).toBe(10)
    consumeThe(entity, 0)
    expect(entity.currentThe).toBe(10)
    consumeThe(entity, -5)
    expect(entity.currentThe).toBe(10)
  })

  it('grant clamps to the cap; consume floors at 0; drain writes 0', () => {
    const entity: { currentThe?: number; maxThe?: number } = { currentThe: 90, maxThe: 100 }
    grantThe(entity, 20)
    expect(entity.currentThe).toBe(100)
    consumeThe(entity, 250)
    expect(entity.currentThe).toBe(0)
    grantThe(entity, 10)
    drainAllThe(entity)
    expect(entity.currentThe).toBe(0)
  })

  it('theCap falls back to the module default when maxThe is unset or non-finite', () => {
    expect(theCap({ maxThe: 42 })).toBe(42)
    expect(theCap({})).toBeGreaterThan(0)
    expect(theCap({ maxThe: Number.NaN })).toBeGreaterThan(0)
  })

  it('tryPayProcCost refuses a non-finite cost (cannot report paid)', () => {
    const entity = { currentThe: 10 } as CombatEntity
    expect(tryPayProcCost(entity, Number.NaN)).toBe(false)
    expect(entity.currentThe).toBe(10)
    expect(tryPayProcCost(entity, Number.POSITIVE_INFINITY)).toBe(false)
    expect(entity.currentThe).toBe(10)
  })
})
