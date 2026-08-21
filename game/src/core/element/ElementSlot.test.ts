import { describe, expect, it } from 'vitest'
import { getElementSlotCount, MAX_ELEMENT_SLOTS } from './ElementSlot'

// Pháp Tu Redesign (magicpath mục 28 "Ví dụ progression thực tế") —
// bảng ví dụ chính thức trong spec, dùng thẳng làm test case.
describe('getElementSlotCount (Pháp Tu Redesign, magicpath mục 5/28)', () => {
  it('Phàm Nhân chưa có Element Slot nào', () => {
    expect(getElementSlotCount('pham_nhan')).toBe(0)
  })

  it('Luyện Khí / Trúc Cơ = 2 slots', () => {
    expect(getElementSlotCount('qi_refining')).toBe(2)
    expect(getElementSlotCount('foundation')).toBe(2)
  })

  it('Kim Đan / Nguyên Anh = 3 slots', () => {
    expect(getElementSlotCount('golden_core')).toBe(3)
    expect(getElementSlotCount('nascent_soul')).toBe(3)
  })

  it('Hóa Thần / Luyện Hư = 4 slots', () => {
    expect(getElementSlotCount('soul_transformation')).toBe(4)
    expect(getElementSlotCount('void_refinement')).toBe(4)
  })

  it('Hợp Thể / Đại Thừa = 5 slots (trần tối đa)', () => {
    expect(getElementSlotCount('body_integration')).toBe(5)
    expect(getElementSlotCount('mahayana')).toBe(5)
  })

  it('Độ Kiếp vẫn giữ trần 5, không vượt MAX_ELEMENT_SLOTS', () => {
    expect(getElementSlotCount('tribulation')).toBe(MAX_ELEMENT_SLOTS)
  })

  it('realmId không tồn tại thì trả về 0, không throw', () => {
    expect(getElementSlotCount('unknown_realm')).toBe(0)
  })
})
