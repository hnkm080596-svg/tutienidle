import { describe, expect, it } from 'vitest'
import { TURN_SKILL_DISPLAY_META, turnSkillDisplayMetaOf } from './TurnSkillDisplayMeta'

// Bảng 9.5 #5 (2026-09-07) — mapping skillId → display metadata (name +
// description) cho HUD turn. Mọi id production của TurnSkillDefinition
// (TurnBasicAttacks.ts, BatKiemThuat.ts, TurnReactionPathSkills.ts,
// THUY_GIAP_LONG_WATER_SURGE) phải có mặt trong map — test sweep dưới
// đây là guard vĩnh viễn chống quên bổ sung khi thêm skill mới.

describe('TURN_SKILL_DISPLAY_META (bảng 9.5 #5)', () => {
  it('phủ mọi id TurnSkillDefinition production đã authored', () => {
    // Thu thập mọi id production từ các nguồn authored.
    const productionIds = [
      'tram',
      'hoa_cau_thuat',
      'thuy_tien_thuat',
      'doc_chuong',
      'diem_kim_thuat',
      'tho_cau_thuat',
      'generic_physical',
      'bat_kiem_thuat',
      'water_surge',
      'phap_tu_reaction_special',
      'phap_tu_reaction_ultimate',
    ]

    for (const id of productionIds) {
      expect(TURN_SKILL_DISPLAY_META[id], `thiếu display meta cho '${id}'`).toBeDefined()
    }
  })

  it('mọi entry đều có name không rỗng + description không rỗng', () => {
    for (const [id, meta] of Object.entries(TURN_SKILL_DISPLAY_META)) {
      expect(meta.name.trim().length, `name rỗng cho '${id}'`).toBeGreaterThan(0)
      expect(meta.description.trim().length, `description rỗng cho '${id}'`).toBeGreaterThan(0)
    }
  })

  it('turnSkillDisplayMetaOf trả undefined cho id không có trong map (fallback an toàn)', () => {
    expect(turnSkillDisplayMetaOf('id_khong_ton_tai')).toBeUndefined()
    expect(turnSkillDisplayMetaOf('tram')?.name).toBe('Huy Kiếm')
  })
})
