import { describe, expect, it } from 'vitest'
import { SKILLS } from '../../data/skill/Skills'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'
import { targetingForSkill } from '../battle/CombatAction'

// Engine 22c8007 (Task 10 follow-up, spec §2 biến thể C/D) —
// SkillSpecialization.targeting override: specialization đổi VÙNG tác
// động (single ↔ line ↔ area ↔ all_lanes). getEffectiveSkill trả
// `targeting` = specialization.targeting ?? skill.targeting;
// BattleSystem.resolveSkillEffects suy vùng qua targetingForSkill(effective).
// Test khóa cả 2 tầng: unit-level getEffectiveSkill + đường BattleSystem
// dùng (targetingForSkill trên effective — cùng hàm mà resolveSkillEffects
// gọi, không cần dựng cả trận).

function findSkill(id: string) {
  const skill = SKILLS.find((candidate) => candidate.id === id)

  if (!skill) {
    throw new Error(`thiếu skill ${id} trong data`)
  }

  return skill
}

function setupFor(skillId: string) {
  const manager = new SkillManager()
  const system = new SkillSystem(manager)

  manager.add(structuredClone(findSkill(skillId)))

  return { manager, system }
}

describe('SkillSystem.getEffectiveSkill — specialization targeting override (22c8007)', () => {
  it('chưa chọn specialization → effective.targeting = targeting gốc của skill', () => {
    const { system, manager } = setupFor('kim_lang_toan_phong')
    const skill = manager.get('kim_lang_toan_phong')!

    const effective = system.getEffectiveSkill(skill)

    expect(effective.targeting).toEqual({ shape: 'area', laneRadius: 1 })
  })

  it('skill không khai targeting → effective.targeting undefined (single mặc định)', () => {
    const { system, manager } = setupFor('chuc_dung_dan_no')
    const skill = manager.get('chuc_dung_dan_no')!

    expect(system.getEffectiveSkill(skill).targeting).toBeUndefined()
  })

  it('kim_lang_xuyen_liet: chọn specialization → targeting gốc area BỊ THAY bằng line', () => {
    const { system, manager } = setupFor('kim_lang_toan_phong')
    const skill = manager.get('kim_lang_toan_phong')!

    expect(system.selectSpecialization(skill.id, 'kim_lang_xuyen_liet')).toBe(true)

    const effective = system.getEffectiveSkill(skill)

    expect(effective.targeting).toEqual({ shape: 'line' })
    // Đường BattleSystem dùng: resolveSkillEffects suy vùng qua
    // targetingForSkill(effective) — phải ra 'line', không còn radius area.
    expect(targetingForSkill({ ...skill, targeting: effective.targeting }).shape).toBe('line')
  })

  it('lan_doc_quang: specialization all_lanes thay area laneRadius 1 columnRadius 1 gốc', () => {
    const { system, manager } = setupFor('van_moc_lan_doc')
    const skill = manager.get('van_moc_lan_doc')!

    expect(system.selectSpecialization(skill.id, 'lan_doc_quang')).toBe(true)

    const effective = system.getEffectiveSkill(skill)

    expect(effective.targeting).toEqual({ shape: 'all_lanes', columnRadius: 1 })
    expect(targetingForSkill({ ...skill, targeting: effective.targeting }).shape).toBe('all_lanes')
  })

  it('chan_dia_quang: area laneRadius 2 columnRadius 1 (gốc laneRadius 1 columnRadius 1)', () => {
    const { system, manager } = setupFor('con_lon_chan_dia')
    const skill = manager.get('con_lon_chan_dia')!

    expect(system.selectSpecialization(skill.id, 'chan_dia_quang')).toBe(true)

    expect(system.getEffectiveSkill(skill).targeting).toEqual({
      shape: 'area',
      laneRadius: 2,
      columnRadius: 1,
    })
  })

  it('chan_dia_tran (single): specialization KHÔNG mang targeting → effective fallback targeting GỐC của skill', () => {
    const { system, manager } = setupFor('con_lon_chan_dia')
    const skill = manager.get('con_lon_chan_dia')!

    expect(system.selectSpecialization(skill.id, 'chan_dia_tran')).toBe(true)

    const effective = system.getEffectiveSkill(skill)

    // Không override = giữ nguyên vùng gốc (area 1×1) — behavior
    // fallback `specialization?.targeting ?? skill.targeting`.
    expect(effective.targeting).toEqual({ shape: 'area', laneRadius: 1, columnRadius: 1 })
  })

  it('mọi specialization biến thể C/D chuỗi Thuần có targeting override đều là ActionTargeting hợp lệ', () => {
    const variantSkillIds = [
      'tam_muoi_chan_hoa',
      'cau_mang_can_tri',
      'van_moc_lan_doc',
      'kim_lang_toan_phong',
      'con_lon_chan_dia',
    ]
    const shapes = new Set(['single', 'area', 'line', 'all_lanes'])
    let overrideCount = 0

    for (const id of variantSkillIds) {
      for (const spec of findSkill(id).specializations ?? []) {
        if (spec.targeting) {
          overrideCount += 1
          expect(shapes.has(spec.targeting.shape), `${id}/${spec.id} shape`).toBe(true)
        }
      }
    }

    // §2: Tán Diễm (area), Lan Quảng (all_lanes), Toàn Vực (area),
    // Xuyên Liệt (line), Chấn Quảng (area) — 5 override vùng.
    expect(overrideCount).toBe(5)
  })
})
