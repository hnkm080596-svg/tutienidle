import { describe, expect, it } from 'vitest'
import {
  ITEM_QUALITY_LABELS,
  ITEM_QUALITY_ORDER,
  ITEM_QUALITY_SHORT_LABELS,
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

  it('short labels are the tier word only — used as the "Chat - Name" name prefix (2026-09-14 ruling)', () => {
    expect(ITEM_QUALITY_ORDER.map((quality) => ITEM_QUALITY_SHORT_LABELS[quality])).toEqual([
      'Hoàng',
      'Huyền',
      'Địa',
      'Thiên',
      'Tiên',
    ])
  })
})
