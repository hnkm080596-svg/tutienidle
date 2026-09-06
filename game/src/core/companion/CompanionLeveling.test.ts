import { describe, expect, it } from 'vitest'
import { companionLevelForExp, grantCompanionExp } from './CompanionLeveling'

describe('companionLevelForExp', () => {
  it('level 1 at 0 exp', () => {
    expect(companionLevelForExp(0)).toBe(1)
  })

  it('level increases as exp crosses thresholds', () => {
    const levelAtLowExp = companionLevelForExp(50)
    const levelAtHighExp = companionLevelForExp(5000)

    expect(levelAtHighExp).toBeGreaterThan(levelAtLowExp)
  })
})

describe('grantCompanionExp', () => {
  it('returns a NEW instance with exp increased and level recalculated', () => {
    const instance = { definitionId: 'test', level: 1, exp: 0 }

    const result = grantCompanionExp(instance, 5000)

    expect(result.exp).toBe(5000)
    expect(result.level).toBe(companionLevelForExp(5000))
    expect(instance.exp).toBe(0) // original untouched (pure function)
  })
})
