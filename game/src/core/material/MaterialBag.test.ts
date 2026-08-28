import { describe, expect, it } from 'vitest'
import { MaterialBag } from './MaterialBag'
import type { Material } from './Material'

const MATERIAL: Material = {
  id: 'test_material',
  name: 'Test Material',
  category: 'other',
  sourceType: 'monster',
}

const LIMITED_MATERIAL: Material = {
  ...MATERIAL,
  id: 'limited_material',
  stackLimit: 10,
}

describe('MaterialBag — add/remove invariants', () => {
  it('add cộng dồn và trả 0 khi vừa chỗ', () => {
    const bag = new MaterialBag()

    expect(bag.add(MATERIAL, 5)).toBe(0)
    expect(bag.add(MATERIAL, 3)).toBe(0)
    expect(bag.getAmount('test_material')).toBe(8)
  })

  it('add vượt stackLimit trả lượng tràn', () => {
    const bag = new MaterialBag()

    expect(bag.add(LIMITED_MATERIAL, 7)).toBe(0)
    expect(bag.add(LIMITED_MATERIAL, 6)).toBe(3)
    expect(bag.getAmount('limited_material')).toBe(10)
  })

  it('remove trừ đúng và xoá stack khi cạn', () => {
    const bag = new MaterialBag()

    bag.add(MATERIAL, 5)

    expect(bag.remove('test_material', 3)).toBe(true)
    expect(bag.getAmount('test_material')).toBe(2)

    expect(bag.remove('test_material', 2)).toBe(true)
    expect(bag.get('test_material')).toBeUndefined()
  })

  it('remove nhiều hơn có → từ chối, giữ nguyên stack', () => {
    const bag = new MaterialBag()

    bag.add(MATERIAL, 5)

    expect(bag.remove('test_material', 6)).toBe(false)
    expect(bag.getAmount('test_material')).toBe(5)
  })
})

describe('MaterialBag — guard NaN/Infinity/âm (review 2026-08-28)', () => {
  it('add NaN/Infinity/âm bị từ chối, KHÔNG poison stack', () => {
    const bag = new MaterialBag()

    bag.add(MATERIAL, 5)

    expect(bag.add(MATERIAL, Number.NaN)).toBe(0)
    expect(bag.add(MATERIAL, Number.POSITIVE_INFINITY)).toBe(0)
    expect(bag.add(MATERIAL, -3)).toBe(0)
    expect(bag.add(MATERIAL, 0)).toBe(0)

    expect(bag.getAmount('test_material')).toBe(5)
    expect(Number.isFinite(bag.getAmount('test_material'))).toBe(true)
  })

  it('add NaN vào stack MỚI không tạo stack NaN', () => {
    const bag = new MaterialBag()

    bag.add(MATERIAL, Number.NaN)

    expect(bag.get('test_material')).toBeUndefined()
  })

  it('remove NaN/Infinity/âm bị từ chối', () => {
    const bag = new MaterialBag()

    bag.add(MATERIAL, 5)

    expect(bag.remove('test_material', Number.NaN)).toBe(false)
    expect(bag.remove('test_material', Number.NEGATIVE_INFINITY)).toBe(false)
    expect(bag.remove('test_material', -1)).toBe(false)

    expect(bag.getAmount('test_material')).toBe(5)
  })

  it('has với NaN trả false (không bao giờ thoả điều kiện)', () => {
    const bag = new MaterialBag()

    bag.add(MATERIAL, 5)

    expect(bag.has('test_material', Number.NaN)).toBe(false)
  })
})
