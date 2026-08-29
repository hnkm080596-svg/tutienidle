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

// Linh Thạch thật đặt MAX_SAFE_INTEGER (Material.ts) — chi phí Đột Phá
// scale tới hàng tỷ, KHÔNG được bị clamp về MAX_STACK_AMOUNT chung.
const SPIRIT_STONE_MATERIAL: Material = {
  ...MATERIAL,
  id: 'spirit_stone_test',
  name: 'Linh Thạch Test',
  category: 'spirit_stone',
  stackLimit: Number.MAX_SAFE_INTEGER,
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

describe('MaterialBag — cap stackLimit riêng (plan Workstream F)', () => {
  it('stackLimit custom được tôn trọng thay vì MAX_STACK_AMOUNT chung', () => {
    const bag = new MaterialBag()

    expect(bag.add(LIMITED_MATERIAL, 8)).toBe(0)
    expect(bag.add(LIMITED_MATERIAL, 8)).toBe(6)
    expect(bag.getAmount('limited_material')).toBe(10)
  })

  it('Linh Thạch stackLimit MAX_SAFE_INTEGER — cộng hàng tỷ không bị clamp 1000', () => {
    const bag = new MaterialBag()

    expect(bag.add(SPIRIT_STONE_MATERIAL, 1_500)).toBe(0)
    expect(bag.getAmount('spirit_stone_test')).toBe(1_500)

    expect(bag.add(SPIRIT_STONE_MATERIAL, 999_999_999)).toBe(0)
    expect(bag.getAmount('spirit_stone_test')).toBe(1_000_001_499)
  })

  it('add vượt stackLimit — stack giữ ở trần, phần dư trả về dưới dạng overflow', () => {
    const bag = new MaterialBag()

    expect(bag.add(LIMITED_MATERIAL, 3)).toBe(0)
    expect(bag.add(LIMITED_MATERIAL, 10)).toBe(3)
    expect(bag.getAmount('limited_material')).toBe(10)
  })
})

describe('MaterialBag — thứ tự getAll theo thứ tự insert (đơn vị cấp ô)', () => {
  it('getAll giữ thứ tự stack được thêm lần đầu', () => {
    const bag = new MaterialBag()

    bag.add(LIMITED_MATERIAL, 1)
    bag.add(MATERIAL, 2)
    bag.add(SPIRIT_STONE_MATERIAL, 3)

    expect(bag.getAll().map((stack) => stack.material.id)).toEqual([
      'limited_material',
      'test_material',
      'spirit_stone_test',
    ])
  })

  it('add vào stack đã tồn tại KHÔNG đổi thứ tự stack đó', () => {
    const bag = new MaterialBag()

    bag.add(LIMITED_MATERIAL, 1)
    bag.add(MATERIAL, 2)

    bag.add(LIMITED_MATERIAL, 5)

    expect(bag.getAll().map((stack) => stack.material.id)).toEqual([
      'limited_material',
      'test_material',
    ])
  })

  it('remove một nửa rồi thêm lại — stack cũ giữ vị trí ban đầu', () => {
    const bag = new MaterialBag()

    bag.add(LIMITED_MATERIAL, 5)
    bag.add(MATERIAL, 3)

    bag.remove('limited_material', 4)
    bag.add(LIMITED_MATERIAL, 2)

    expect(bag.getAll().map((stack) => stack.material.id)).toEqual([
      'limited_material',
      'test_material',
    ])
  })
})

describe('MaterialBag — remove an toàn với id/stack không tồn tại', () => {
  it('remove id chưa từng có — false, không throw, không tạo stack', () => {
    const bag = new MaterialBag()

    expect(bag.remove('ghost_material', 1)).toBe(false)
    expect(bag.get('ghost_material')).toBeUndefined()
    expect(bag.getAll()).toHaveLength(0)
  })

  it('remove id không tồn tại sau khi đã clear — false, không throw', () => {
    const bag = new MaterialBag()

    bag.add(MATERIAL, 5)
    bag.clear()

    expect(bag.get('test_material')).toBeUndefined()
    expect(bag.remove('test_material', 1)).toBe(false)
    expect(bag.getAll()).toHaveLength(0)
  })

  it('remove số âm/NaN lên id không tồn tại — false, không throw', () => {
    const bag = new MaterialBag()

    expect(bag.remove('ghost_material', -5)).toBe(false)
    expect(bag.remove('ghost_material', Number.NaN)).toBe(false)
  })

  it('remove 0 — false (amount <= 0 không phải remove hợp lệ)', () => {
    const bag = new MaterialBag()

    bag.add(MATERIAL, 5)

    expect(bag.remove('test_material', 0)).toBe(false)
    expect(bag.getAmount('test_material')).toBe(5)
  })
})

describe('MaterialBag — round-trip add/remove đầy đủ', () => {
  it('vòng add rồi remove về 0 — stack bị xoá hẳn', () => {
    const bag = new MaterialBag()

    expect(bag.add(MATERIAL, 7)).toBe(0)
    expect(bag.remove('test_material', 3)).toBe(true)
    expect(bag.remove('test_material', 4)).toBe(true)
    expect(bag.get('test_material')).toBeUndefined()
    expect(bag.has('test_material', 1)).toBe(false)
  })

  it('remove chính xác số đang có — true, stack xoá, không sót 0', () => {
    const bag = new MaterialBag()

    bag.add(LIMITED_MATERIAL, 6)
    bag.add(MATERIAL, 2)

    expect(bag.remove('limited_material', 6)).toBe(true)
    expect(bag.get('limited_material')).toBeUndefined()
    expect(bag.getAll()).toHaveLength(1)
  })
})
