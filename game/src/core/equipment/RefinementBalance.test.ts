import { describe, expect, it } from 'vitest'
import {
  REFINE_INCREASE_MAX,
  REFINE_INCREASE_MIN,
  REFINE_TINH_HOA_COST_BY_QUALITY,
  WASH_SPIRIT_STONE_COST,
  WASH_TIER_WEIGHTS_BY_QUALITY,
  WASH_TINH_HOA_COST_BY_QUALITY,
} from './RefinementBalance'

describe('RefinementBalance — five-quality wash contract', () => {
  it('scales Luyện Khí Tinh Hoa costs across all five qualities', () => {
    expect(WASH_TINH_HOA_COST_BY_QUALITY).toEqual({
      hoang: 2,
      huyen: 5,
      dia: 9,
      thien: 13,
      tien: 18,
    })
    expect(WASH_SPIRIT_STONE_COST).toBe(100)
  })

  it('uses quality-keyed tier 1–3 weights', () => {
    expect(WASH_TIER_WEIGHTS_BY_QUALITY).toEqual({
      hoang: [70, 25, 5],
      huyen: [50, 35, 15],
      dia: [35, 35, 30],
      thien: [20, 40, 40],
      tien: [10, 35, 55],
    })
  })
})

describe('RefinementBalance — five-quality refine contract', () => {
  it('charges quality-scaled Luyện Khí Tinh Hoa and only rolls 5–20% increases', () => {
    expect(REFINE_TINH_HOA_COST_BY_QUALITY).toEqual({
      hoang: 1,
      huyen: 3,
      dia: 5,
      thien: 7,
      tien: 9,
    })
    expect(REFINE_INCREASE_MIN).toBe(0.05)
    expect(REFINE_INCREASE_MAX).toBe(0.2)
  })
})
