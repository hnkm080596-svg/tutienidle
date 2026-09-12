import { describe, expect, it } from 'vitest'
import {
  BOSS_MODIFIER,
  MAX_CURRENCY_MULTIPLIER,
  MAX_QUALITY_BONUS_STEPS,
  TINH_ANH_MODIFIER,
  currencyMultiplierFor,
  qualityBonusStepsFor,
  totalExtraRolls,
  type DropModifier,
} from './DropModifier'

describe('DropModifier - currency law (spec E4)', () => {
  it('is 1 with no modifiers', () => {
    expect(currencyMultiplierFor([])).toBe(1)
  })

  it('adds contributions instead of multiplying them', () => {
    expect(currencyMultiplierFor([TINH_ANH_MODIFIER])).toBe(2)
    expect(currencyMultiplierFor([BOSS_MODIFIER])).toBe(3)
    expect(currencyMultiplierFor([BOSS_MODIFIER, TINH_ANH_MODIFIER])).toBe(4)
  })

  it('caps at MAX_CURRENCY_MULTIPLIER even when a third modifier lands', () => {
    const future: DropModifier = { id: 'future', extraRolls: 0, currencyBonus: 5 }

    expect(currencyMultiplierFor([BOSS_MODIFIER, TINH_ANH_MODIFIER, future])).toBe(
      MAX_CURRENCY_MULTIPLIER,
    )
  })
})

describe('DropModifier - quality law (spec E5/E6/E9)', () => {
  it('gives nothing to a plain kill or to a single modifier', () => {
    expect(qualityBonusStepsFor([])).toBe(0)
    expect(qualityBonusStepsFor([TINH_ANH_MODIFIER])).toBe(0)
    expect(qualityBonusStepsFor([BOSS_MODIFIER])).toBe(0)
  })

  it('gives exactly one step to boss plus tinh anh', () => {
    expect(qualityBonusStepsFor([BOSS_MODIFIER, TINH_ANH_MODIFIER])).toBe(1)
  })

  it('generalises to more modifiers and caps', () => {
    const a: DropModifier = { id: 'a', extraRolls: 0, currencyBonus: 0 }
    const b: DropModifier = { id: 'b', extraRolls: 0, currencyBonus: 0 }

    expect(qualityBonusStepsFor([BOSS_MODIFIER, TINH_ANH_MODIFIER, a])).toBe(2)
    expect(qualityBonusStepsFor([BOSS_MODIFIER, TINH_ANH_MODIFIER, a, b])).toBe(
      MAX_QUALITY_BONUS_STEPS,
    )
  })
})

describe('DropModifier - rolls', () => {
  it('adds extra rolls', () => {
    expect(totalExtraRolls([])).toBe(0)
    expect(totalExtraRolls([TINH_ANH_MODIFIER])).toBe(1)
    expect(totalExtraRolls([BOSS_MODIFIER])).toBe(3)
    expect(totalExtraRolls([BOSS_MODIFIER, TINH_ANH_MODIFIER])).toBe(4)
  })
})
