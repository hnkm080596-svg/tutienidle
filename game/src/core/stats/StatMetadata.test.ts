import { describe, expect, it } from 'vitest'
import { clampStatValue, isPercentStat } from './StatMetadata'

describe('StatMetadata', () => {
  it('phân biệt percent với rating', () => {
    expect(isPercentStat('criticalRate')).toBe(true)
    expect(isPercentStat('accuracyRating')).toBe(false)
    expect(isPercentStat('fireResistance')).toBe(false)
  })

  it('áp trần an toàn cho các lớp phòng thủ', () => {
    expect(clampStatValue('blockChance', 2)).toBe(0.75)
    expect(clampStatValue('finalDamageReductionPercent', 1)).toBe(0.75)
    expect(clampStatValue('manaShieldPercent', 1)).toBe(0.8)
    expect(clampStatValue('leechPercent', 1)).toBe(0.25)
  })
})
