import { describe, expect, it } from 'vitest'
import {
  composeItemQualityNameSegments,
  ITEM_QUALITY_LABELS,
  ITEM_QUALITY_ORDER,
} from './ItemQuality'

describe('ItemQuality contracts', () => {
  it('uses the five quality values in ascending order', () => {
    expect(ITEM_QUALITY_ORDER).toEqual(['hoang', 'huyen', 'dia', 'thien', 'tien'])
  })

  it('labels qualities as Chất names without the old Phẩm term', () => {
    expect(ITEM_QUALITY_ORDER.map((quality) => ITEM_QUALITY_LABELS[quality])).toEqual([
      'Hoàng Chất',
      'Huyền Chất',
      'Địa Chất',
      'Thiên Chất',
      'Tiên Chất',
    ])
    expect(Object.values(ITEM_QUALITY_LABELS).every((label) => !label.includes('Phẩm'))).toBe(true)
  })

  it('composes a quality name with the --grade-* namespace, distinct from the --rank-color-1..10 grade ramp (spec §5.8)', () => {
    expect(composeItemQualityNameSegments('Thanh kiếm', 'thien')).toEqual([
      { text: 'Thiên Chất', colorVar: '--grade-thien', tone: 'thien' },
      { text: 'Thanh kiếm' },
    ])
  })
})
