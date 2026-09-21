import { describe, expect, it } from 'vitest'
import { COMPANIONS } from '../companion/Companions'
import { KIEM_PHO_COMBOS } from './KiemPhoCombos' // used below in the K11 negative assertion
import { KIEM_PHO_ORBS } from './KiemPhoOrbs'
import { KIEM_DAO_CASCADE_EMBLEM, NGU_KIEM_THUAT, TU_KIEM_Y_EMBLEM } from './NguKiemDaoSkills'
import { BASIC_ATTACKS_BY_BUILD, THUY_GIAP_LONG_WATER_SURGE } from './TurnBasicAttacks'
import { TURN_SKILL_DISPLAY_META, turnSkillDisplayMetaOf } from './TurnSkillDisplayMeta'

// Bang 9.5 #5 (2026-09-07) - mapping skillId -> display metadata (name +
// description) for the turn HUD. Every production TurnSkillDefinition id
// must appear in the map; the sweep below DERIVES the expected set from
// the authored registries plus every COMPANIONS skill slot, so adding or
// renaming a skill without a meta entry fails this test instead of
// silently falling back to a role label in the HUD.

// Production TurnSkillDefinition sources: BASIC_ATTACKS_BY_BUILD (build
// basics, incl. SPELL_BASICS + GENERIC_PHYSICAL_BASIC) and
// THUY_GIAP_LONG_WATER_SURGE (TurnBasicAttacks.ts), BAT_KIEM_THUAT +
// TRU_TIEN_KIEM_TRAN (BatKiemThuat.ts), and COMPANIONS
// basic/special/ultimate kits (data/companion/Companions.ts).

// THUY_GIAP_LONG_WATER_SURGE (TurnBasicAttacks.ts), the Kiem Pho orb
// set + combo table + Ngu Kiem Dao defs (KiemPhoOrbs/KiemPhoCombos/
// NguKiemDaoSkills), the reaction-path pool + marker
// pair (TurnReactionPathSkills.ts), and COMPANIONS basic/special/ultimate
// kits (data/companion/Companions.ts).
function productionTurnSkillIds(): string[] {
  const ids = new Set<string>()

  for (const definition of Object.values(BASIC_ATTACKS_BY_BUILD)) {
    ids.add(definition.id)
  }

  ids.add(THUY_GIAP_LONG_WATER_SURGE.id)
  ids.add(NGU_KIEM_THUAT.id)
  ids.add(TU_KIEM_Y_EMBLEM.id)
  ids.add(KIEM_DAO_CASCADE_EMBLEM.id)

  for (const orb of Object.values(KIEM_PHO_ORBS)) {
    ids.add(orb.id)
  }
  // KIEM_PHO_COMBOS deliberately excluded — K11: no combo id may
  // resolve to display text (the fired payload is the only signal).

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

  it('không combo id nào resolve ra display text (K11 — tên chỉ là data/debug)', () => {
    for (const combo of KIEM_PHO_COMBOS) {
      expect(TURN_SKILL_DISPLAY_META[combo.id], `'${combo.id}' lộ name sang presentation`).toBeUndefined()
      expect(turnSkillDisplayMetaOf(combo.id)).toBeUndefined()
    }
  })

  it('turnSkillDisplayMetaOf trả undefined cho id không có trong map (fallback an toàn)', () => {
    expect(turnSkillDisplayMetaOf('id_khong_ton_tai')).toBeUndefined()
    expect(turnSkillDisplayMetaOf('tram')?.name).toBe('Huy Kiếm')
  })
})
