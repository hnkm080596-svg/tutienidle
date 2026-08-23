import { describe, expect, it } from 'vitest'
import { rollMortalEssenceAmount } from './StageDropRules'

describe('Thanh Vân mortal essence drops', () => {
  it('normal enemies always roll 1-3', () => {
    for (let index = 0; index < 100; index++) {
      expect(rollMortalEssenceAmount(false)).toBeGreaterThanOrEqual(1)
      expect(rollMortalEssenceAmount(false)).toBeLessThanOrEqual(3)
    }
  })

  it('bosses always roll 5-10', () => {
    for (let index = 0; index < 100; index++) {
      expect(rollMortalEssenceAmount(true)).toBeGreaterThanOrEqual(5)
      expect(rollMortalEssenceAmount(true)).toBeLessThanOrEqual(10)
    }
  })
})
