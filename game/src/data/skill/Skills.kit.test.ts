import { describe, expect, it } from 'vitest'
import { SPELL_KIT_IDS, SKILLS } from './Skills'
import { ELEMENT_ORDER } from '../../core/element/ElementLabels'
import {
  PHAP_TU_TRANG_COST_PERCENT_OF_MAX,
  PHAP_TU_SPECIAL_COOLDOWN_TURNS,
  PHAP_TU_SPECIAL_CAST_TIME,
} from './PhapTuSkills'

// Phap Tu Reimagine (2026-09-26 spec) — the kit is a 2-slot pair per
// element: [basic, special]. The chain C/D/E + god-ult + empowered-ult +
// route-variant content is retired; the specials are the Phap Trang
// self-buff windows authored in PhapTuSkills.ts.

const KIT_PAIRS: Record<string, [string, string]> = {
  fire: ['hoa_cau_thuat', 'tam_muoi_chan_hoa'],
  water: ['thuy_tien_thuat', 'thanh_tuyen_duong_linh'],
  wood: ['doc_chuong', 'van_moc_sinh_co'],
  metal: ['diem_kim_thuat', 'kim_y_ngung_phong'],
  earth: ['tho_cau_thuat', 'trong_nhac'],
}

const RETIRED_IDS = [
  // chain B/C/D/E + god-ults + empowered ults, all removed by the reimagine
  'bac_hai_cuong_lan',
  'doc_vien_bao_can',
  'kim_luan_tran_ap',
  'cuu_tru_dia_lao',
  'tat_phuong_giang_the',
  'bat_thu_can_quet',
  'kien_moc_thong_thien',
  'kim_phat_thu_sat',
  'hau_tho_thanh_luy',
  'cau_mang_can_tri',
  'kim_lang_toan_phong',
  'dia_tru_thua_thien',
  'hoa_ha_cuu_thien',
]

describe('Data Phap Tu kit 2-slot (Reimagine 2026-09-26)', () => {
  it('SPELL_KIT_IDS đủ 5 hành × 2 slot [basic, special]', () => {
    expect(Object.keys(SPELL_KIT_IDS).sort()).toEqual([...ELEMENT_ORDER].sort())

    for (const element of ELEMENT_ORDER) {
      expect(SPELL_KIT_IDS[element]).toEqual(KIT_PAIRS[element])
    }
  })

  it('10 kit skills tồn tại trong SKILLS, unique, active, có effects', () => {
    const allIds = SKILLS.map((s) => s.id)
    expect(new Set(allIds).size).toBe(allIds.length)

    for (const element of ELEMENT_ORDER) {
      for (const skillId of SPELL_KIT_IDS[element]) {
        const skill = SKILLS.find((s) => s.id === skillId)

        expect(skill, `thiếu skill ${skillId}`).toBeDefined()
        expect(skill!.type).toBe('active')
        expect(skill!.effects.length).toBeGreaterThan(0)
        expect(skill!.execution).toBeDefined()
      }
    }
  })

  it('id N2b: kit skills KHÔNG mang hậu tố _b/_c/_d/_e', () => {
    for (const element of ELEMENT_ORDER) {
      for (const skillId of SPELL_KIT_IDS[element]) {
        expect(skillId, `id ${skillId} vi phạm N2b`).not.toMatch(/_[bcde]$/)
      }
    }
  })

  it('specials: resourceType mana (Linh Lực), flat cost absent — %MaxLL stamped at seam', () => {
    expect(PHAP_TU_TRANG_COST_PERCENT_OF_MAX).toBeCloseTo(0.3)
    expect(PHAP_TU_SPECIAL_COOLDOWN_TURNS).toBe(5)
    expect(PHAP_TU_SPECIAL_CAST_TIME).toBeCloseTo(1.2)

    for (const element of ELEMENT_ORDER) {
      const specialId = SPELL_KIT_IDS[element][1]
      const skill = SKILLS.find((s) => s.id === specialId)!

      expect(skill.resourceType, `${specialId} resourceType`).toBe('mana')
      expect(skill.cost, `${specialId} flat cost`).toBeUndefined()
      expect(skill.cooldown, `${specialId} cooldown`).toBe(PHAP_TU_SPECIAL_COOLDOWN_TURNS)
    }
  })

  it('retired chain/ult ids không còn trong SKILLS', () => {
    for (const id of RETIRED_IDS) {
      expect(SKILLS.find((s) => s.id === id), `retired ${id} còn sót`).toBeUndefined()
    }
  })

  it('element component khớp hành của pair', () => {
    for (const element of ELEMENT_ORDER) {
      for (const skillId of SPELL_KIT_IDS[element]) {
        const skill = SKILLS.find((s) => s.id === skillId)

        for (const effect of skill?.effects ?? []) {
          for (const component of effect.components ?? []) {
            if (component.kind === 'element') {
              expect(component.element).toBe(element)
            }
          }
        }
      }
    }
  })
})
