import { describe, expect, it } from 'vitest'
import { COMPANIONS } from '../companion/Companions'
import { BAT_KIEM_THUAT, TRU_TIEN_KIEM_TRAN } from './BatKiemThuat'
import { BASIC_ATTACKS_BY_BUILD, THUY_GIAP_LONG_WATER_SURGE } from './TurnBasicAttacks'
import { TURN_SKILL_DISPLAY_META, turnSkillDisplayMetaOf } from './TurnSkillDisplayMeta'

// Bang 9.5 #5 (2026-09-07) - mapping skillId -> display metadata (name +
// description) for the turn HUD. Every production TurnSkillDefinition id
// must appear in the map; the sweep below DERIVES the expected set from
// the authored registries plus every COMPANIONS skill slot, so adding or
// renaming a skill without a meta entry fails this test instead of
// silently falling back to a role label in the HUD.

// Production TurnSkillDefinition sources: BASIC_ATTACKS_BY_BUILD (build
// basics, incl. PHAP_TU_BASICS + GENERIC_PHYSICAL_BASIC) and
// THUY_GIAP_LONG_WATER_SURGE (TurnBasicAttacks.ts), BAT_KIEM_THUAT +
// TRU_TIEN_KIEM_TRAN (BatKiemThuat.ts), and COMPANIONS
// basic/special/ultimate kits (data/companion/Companions.ts).
function productionTurnSkillIds(): string[] {
  const ids = new Set<string>()

  for (const definition of Object.values(BASIC_ATTACKS_BY_BUILD)) {
    ids.add(definition.id)
  }

  ids.add(THUY_GIAP_LONG_WATER_SURGE.id)
  ids.add(BAT_KIEM_THUAT.id)
  ids.add(TRU_TIEN_KIEM_TRAN.id)

  for (const companion of COMPANIONS) {
    for (const skill of [companion.basic, companion.special, companion.ultimate]) {
      if (skill !== undefined) {
        ids.add(skill.id)
      }
    }
  }

  return [...ids]
}

describe('TURN_SKILL_DISPLAY_META (bảng 9.5 #5)', () => {
  it('phủ mọi id TurnSkillDefinition production đã authored', () => {
    for (const id of productionTurnSkillIds()) {
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
