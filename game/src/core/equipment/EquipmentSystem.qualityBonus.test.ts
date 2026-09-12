import { describe, expect, it } from 'vitest'
import { ITEM_QUALITY_ORDER } from '../item/ItemQuality'
import { applyQualityBonusSteps } from './EquipmentSystem'

describe('applyQualityBonusSteps (spec E5)', () => {
  it('is the identity when no bonus is given', () => {
    for (const quality of ITEM_QUALITY_ORDER) {
      expect(applyQualityBonusSteps(quality, 0)).toBe(quality)
    }
  })

  it('moves one step up the ladder', () => {
    expect(applyQualityBonusSteps('hoang', 1)).toBe('huyen')
    expect(applyQualityBonusSteps('huyen', 1)).toBe('dia')
  })

  it('clamps at the top of the ladder', () => {
    expect(applyQualityBonusSteps('thien', 2)).toBe('tien')
    expect(applyQualityBonusSteps('tien', 2)).toBe('tien')
  })

  it('never moves down', () => {
    expect(applyQualityBonusSteps('dia', -3)).toBe('dia')
  })
})
