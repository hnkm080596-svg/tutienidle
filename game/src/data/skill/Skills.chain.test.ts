import { describe, expect, it } from 'vitest'
import { CHAIN_SKILL_IDS, SKILLS } from './Skills'
import { ELEMENT_ORDER } from '../../core/element/ElementLabels'

// Spec 2026-09-03 phap-tu-thuan-he §2/§3 (Task 10) — 5 chuỗi thần SHK,
// mỗi hành root A (skill hiện có) + 4 skill B/C/D/E TÊN MỚI đúng bảng
// spec (id N2b: không hậu tố _b/_c). Data validation pattern test data
// hiện có: id duy nhất, type active, có effects.
// Future Systems Task 1 (2026-09-04) — chuỗi 3 skill/hành khớp mô hình
// 3-skill role (Slice 2): giữ vị trí A/C/E của chuỗi 5 cũ. B/D không mất
// — data vẫn trong SKILLS, chỉ rời chuỗi mặc định.
const NEW_CHAIN_IDS: Record<string, string[]> = {
  fire: ['hoa_cau_thuat', 'tam_muoi_chan_hoa', 'hoa_ha_cuu_thien'],
  water: ['thuy_tien_thuat', 'thanh_tuyen_duong_linh', 'bac_hai_cuong_lan'],
  wood: ['doc_chuong', 'cau_mang_can_tri', 'doc_vien_bao_can'],
  metal: ['diem_kim_thuat', 'kim_lang_toan_phong', 'kim_luan_tran_ap'],
  earth: ['tho_cau_thuat', 'dia_tru_thua_thien', 'cuu_tru_dia_lao'],
}

const NEW_ULT_IDS = [
  'tat_phuong_giang_the',
  'bat_thu_can_quet',
  'kien_moc_thong_thien',
  'kim_phat_thu_sat',
  'hau_tho_thanh_luy',
]

describe('Data chuỗi thần thoại 3-skill (Future Systems Task 1)', () => {
  it('CHAIN_SKILL_IDS đủ 5 hành × 3 slot (Future Systems Task 1), ĐÚNG id chuỗi 3', () => {
    expect(Object.keys(CHAIN_SKILL_IDS).sort()).toEqual([...ELEMENT_ORDER].sort())

    for (const element of ELEMENT_ORDER) {
      expect(CHAIN_SKILL_IDS[element]).toEqual(NEW_CHAIN_IDS[element])
    }
  })

  it('A là root hiện có của hành (đã tồn tại trước redesign)', () => {
    expect(CHAIN_SKILL_IDS.fire[0]).toBe('hoa_cau_thuat')
    expect(CHAIN_SKILL_IDS.water[0]).toBe('thuy_tien_thuat')
    expect(CHAIN_SKILL_IDS.wood[0]).toBe('doc_chuong')
    expect(CHAIN_SKILL_IDS.metal[0]).toBe('diem_kim_thuat')
    expect(CHAIN_SKILL_IDS.earth[0]).toBe('tho_cau_thuat')
  })

  it('20 skill mới B–E: có trong SKILLS, active, có effects', () => {
    for (const element of ELEMENT_ORDER) {
      for (const skillId of CHAIN_SKILL_IDS[element].slice(1)) {
        const skill = SKILLS.find(s => s.id === skillId)

        expect(skill, `thiếu skill ${skillId}`).toBeDefined()
        expect(skill!.type).toBe('active')
        expect(skill!.effects.length).toBeGreaterThan(0)
        expect(skill!.execution).toBeDefined()
      }
    }
  })

  it('id N2b: skill chuỗi KHÔNG mang hậu tố _b/_c/_d/_e', () => {
    for (const element of ELEMENT_ORDER) {
      for (const skillId of CHAIN_SKILL_IDS[element]) {
        expect(skillId, `id ${skillId} vi phạm N2b`).not.toMatch(/_[bcde]$/)
      }
    }
  })

  it('mọi effect damage của skill chuỗi có manaScalingRatio + attributeScaling (attunement) — quy tắc §1.3', () => {
    for (const element of ELEMENT_ORDER) {
      for (const skillId of CHAIN_SKILL_IDS[element]) {
        const skill = SKILLS.find(s => s.id === skillId)!

        for (const effect of skill.effects) {
          if (effect.type === 'damage') {
            expect(
              effect.manaScalingRatio,
              `${skillId} damage effect thiếu manaScalingRatio`,
            ).toBe(0.001)
            expect(
              effect.attributeScaling,
              `${skillId} damage effect thiếu attributeScaling`,
            ).toEqual([{ attributes: ['attunement'], ratioPerPoint: 0.004 }])
          }
        }

        for (const spec of skill.specializations ?? []) {
          for (const effect of spec.effectsOverride ?? []) {
            if (effect.type === 'damage') {
              expect(
                effect.manaScalingRatio,
                `${skillId}/${spec.id} damage effect thiếu manaScalingRatio`,
              ).toBe(0.001)
              expect(
                effect.attributeScaling,
                `${skillId}/${spec.id} damage effect thiếu attributeScaling`,
              ).toEqual([{ attributes: ['attunement'], ratioPerPoint: 0.004 }])
            }
          }
        }
      }
    }
  })

  it('5 ult mới: có trong SKILLS, buildTag ult, unlocked false, không requiredRealmId', () => {
    for (const id of NEW_ULT_IDS) {
      const skill = SKILLS.find(s => s.id === id)

      expect(skill, `thiếu ult ${id}`).toBeDefined()
      expect(skill!.buildTag).toBe('ult')
      expect(skill!.unlocked).toBe(false)
      expect(skill!.requiredRealmId).toBeUndefined()
      expect(skill!.execution).toEqual({ kind: 'cast_time', castTime: 1.5 })
    }
  })

  // Review round 1 (Finding 1) — biến thể Thổ C dùng buff RIÊNG đúng số
  // liệu §2.5, không mượn buff hành khác (bang_giap = Thủy, kim_giap = Kim).
  it('dia_tru variants dùng buff riêng dia_tru_bich/dia_tru_thu, không mượn buff hành khác', () => {
    const diaTru = SKILLS.find((s) => s.id === 'dia_tru_thua_thien')!
    const bich = diaTru.specializations?.find((s) => s.id === 'dia_tru_bich')!
    const thu = diaTru.specializations?.find((s) => s.id === 'dia_tru_thu')!

    expect(bich.effectsOverride).toEqual([{ type: 'buff', buffId: 'dia_tru_bich' }])
    expect(thu.effectsOverride).toEqual([{ type: 'buff', buffId: 'dia_tru_thu' }])
  })

  it('placeholder cũ KHÔNG còn tồn tại (đã thay bằng id mới)', () => {    const oldIds = [
      'chuc_dung_b', 'chuc_dung_c', 'chuc_dung_d', 'chuc_dung_e',
      'thien_ngo_b', 'thien_ngo_c', 'thien_ngo_d', 'thien_ngo_e',
      'cau_mang_b', 'cau_mang_c', 'cau_mang_d', 'cau_mang_e',
      'nhuc_thu_b', 'nhuc_thu_c', 'nhuc_thu_d', 'nhuc_thu_e',
      'hau_tho_b', 'hau_tho_c', 'hau_tho_d', 'hau_tho_e',
      'tat_phuong', 'bat_thu', 'kien_moc', 'kim_phat',
    ]

    for (const id of oldIds) {
      expect(SKILLS.find(s => s.id === id), `placeholder ${id} còn sót`).toBeUndefined()
    }
  })

  it('mọi id skill trong SKILLS là duy nhất', () => {
    const allIds = SKILLS.map(s => s.id)

    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('skill mới KHÔNG unlocked mặc định (phải mua qua node chuỗi)', () => {
    for (const element of ELEMENT_ORDER) {
      for (const skillId of CHAIN_SKILL_IDS[element].slice(1)) {
        const skill = SKILLS.find(s => s.id === skillId)

        expect(skill!.unlocked).toBe(false)
        expect(skill!.equipped).toBe(false)
      }
    }
  })

  it('element component khớp hành của chuỗi', () => {
    const elementByChain: Record<string, string> = {
      fire: 'fire',
      water: 'water',
      wood: 'wood',
      metal: 'metal',
      earth: 'earth',
    }

    for (const [chainKey, chain] of Object.entries(CHAIN_SKILL_IDS)) {
      for (const skillId of chain) {
        const skill = SKILLS.find(s => s.id === skillId)

        for (const effect of skill?.effects ?? []) {
          for (const component of effect.components ?? []) {
            if (component.kind === 'element') {
              expect(component.element).toBe(elementByChain[chainKey])
            }
          }
        }
      }
    }
  })
})
