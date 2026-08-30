import { describe, expect, it } from 'vitest'
import { getSkillLoadoutSlotCount, MAX_SKILL_LOADOUT_SLOTS } from './SkillLoadoutSlots'

// Spec 2026-08-30-phap-tu-dao-sac §6 — slot mở theo realm gate bảng:
// Phàm Nhân 1, Luyện Khí/Trúc Cơ 2, Kim Đan/Nguyên Anh 3, Hóa Thần
// trở đi 4, Độ Kiếp 5 (chuỗi A→B→C→D→E đủ).
describe('getSkillLoadoutSlotCount (spec §6)', () => {
  it('Phàm Nhân 1', () => {
    expect(getSkillLoadoutSlotCount('mortal')).toBe(1)
  })

  it('Luyện Khí + Trúc Cơ 2 (A+B — toàn bộ nội dung hiện có)', () => {
    expect(getSkillLoadoutSlotCount('qi_refining')).toBe(2)
    expect(getSkillLoadoutSlotCount('foundation_establishment')).toBe(2)
  })

  it('Kim Đan + Nguyên Anh 3 (+C)', () => {
    expect(getSkillLoadoutSlotCount('golden_core')).toBe(3)
    expect(getSkillLoadoutSlotCount('nascent_soul')).toBe(3)
  })

  it('Hóa Thần → Đại Thừa 4 (+D)', () => {
    expect(getSkillLoadoutSlotCount('soul_transformation')).toBe(4)
    expect(getSkillLoadoutSlotCount('void_refinement')).toBe(4)
    expect(getSkillLoadoutSlotCount('body_integration')).toBe(4)
    expect(getSkillLoadoutSlotCount('mahayana')).toBe(4)
  })

  it('Độ Kiếp 5 (+E — đủ chuỗi)', () => {
    expect(getSkillLoadoutSlotCount('tribulation')).toBe(5)
  })

  it('realmId lạ → 1 slot an toàn (scheduler luôn có slot 0)', () => {
    expect(getSkillLoadoutSlotCount('unknown_realm')).toBe(1)
  })

  it('MAX_SKILL_LOADOUT_SLOTS = 5', () => {
    expect(MAX_SKILL_LOADOUT_SLOTS).toBe(5)
  })
})
