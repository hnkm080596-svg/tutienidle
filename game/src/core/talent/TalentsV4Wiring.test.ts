import { describe, expect, it } from 'vitest'
import { collectTalentEffects, getTalentCombatPassiveSkillId, hasTalent } from './TalentEffects'
import { TALENT_PASSIVE_SKILLS } from '@/data/skill/TalentPassives'

// Talent v4 wiring (spec 2026-09-03-talent-catalog-v4-design.md §3.2,
// §4.1) — khóa: (1) getter combat passive trỏ đúng skill, (2) siết đa
// talent chỉ đọc id đầu (save edit không cộng dồn ngân sách), (3) mọi
// passive trỏ buff tồn tại + có nhịp đúng spec.

describe('TalentEffects v4 — combat passive wiring + siết đa talent', () => {
  it('getTalentCombatPassiveSkillId — talent combat trả đúng id passive', () => {
    expect(getTalentCombatPassiveSkillId(['kiem_quang'])).toBe('talent_passive_kiem_quang')
    expect(getTalentCombatPassiveSkillId(['vo_anh'])).toBe('talent_passive_vo_anh')
    expect(getTalentCombatPassiveSkillId(['bat_tu_the'])).toBe('talent_passive_bat_tu_the')
  })

  it('getTalentCombatPassiveSkillId — talent không combat / không talent → undefined', () => {
    expect(getTalentCombatPassiveSkillId(['pham_cot'])).toBeUndefined()
    expect(getTalentCombatPassiveSkillId([])).toBeUndefined()
    expect(getTalentCombatPassiveSkillId(undefined)).toBeUndefined()
    expect(getTalentCombatPassiveSkillId(['talent_khong_ton_tai'])).toBeUndefined()
  })

  it('collectTalentEffects siết đa talent — chỉ id ĐẦU TIÊN được đọc (spec §3.2)', () => {
    // Save edit chứa 2 id: chỉ kiem_quang (id đầu) có hiệu lực.
    const effects = collectTalentEffects(['kiem_quang', 'tat_phong'])

    expect(effects).toEqual([{ kind: 'combat_passive', passiveSkillId: 'talent_passive_kiem_quang' }])

    // Đảo thứ tự — tat_phong thắng.
    const reversed = collectTalentEffects(['tat_phong', 'kiem_quang'])

    expect(reversed).toEqual([{ kind: 'combat_passive', passiveSkillId: 'talent_passive_tat_phong' }])
  })

  it('collectTalentEffects — id retired ở đầu → effect rỗng (không cộng dồn v3)', () => {
    // Save cũ chỉ còn retired id duy nhất: definition resolve được
    // (hiển thị tên) nhưng effects là [] — không có hiệu lực nào.
    expect(collectTalentEffects(['tu_bao'])).toEqual([])
    expect(collectTalentEffects(['unknown_talent'])).toEqual([])
  })

  it('Phàm Cốt giữ effect cultivation_speed −75% qua đường siết', () => {
    expect(collectTalentEffects(['pham_cot'])).toEqual([{ kind: 'cultivation_speed', percent: -0.75 }])
  })

  it('hasTalent — helper tra talent theo id', () => {
    expect(hasTalent(['kiem_quang'], 'kiem_quang')).toBe(true)
    expect(hasTalent(['kiem_quang'], 'vo_anh')).toBe(false)
    expect(hasTalent([], 'kiem_quang')).toBe(false)
    expect(hasTalent(undefined, 'kiem_quang')).toBe(false)
  })
})

describe('TalentPassives v4 — shape & nhịp engine của 11 passive', () => {
  const passiveById = new Map(TALENT_PASSIVE_SKILLS.map((skill) => [skill.id, skill]))

  it('đúng 12 passive (11 talent + Cẩn Thận có cặp chính/phản)', () => {
    expect(TALENT_PASSIVE_SKILLS).toHaveLength(12)
  })

  it('Kiếm Quang — trigger critical, max 10 tầng, convert Kiếm Vực', () => {
    const skill = passiveById.get('talent_passive_kiem_quang')!

    expect(skill.passiveTrigger).toBe('critical')
    expect(skill.passiveModifiers![0]!.maxStacks).toBe(10)
    expect(skill.passiveConvertsTo).toEqual({ buffId: 'kiem_vuc' })
  })

  it('Phá Giáp — trigger hit, max 5 tầng, KHÔNG convert (M1 trong trận)', () => {
    const skill = passiveById.get('talent_passive_pha_giap')!

    expect(skill.passiveTrigger).toBe('hit')
    expect(skill.passiveModifiers![0]!.maxStacks).toBe(5)
    expect(skill.passiveConvertsTo).toBeUndefined()
  })

  it('Tật Phong — trigger kill, stack vô hạn (không maxStacks)', () => {
    const skill = passiveById.get('talent_passive_tat_phong')!

    expect(skill.passiveTrigger).toBe('kill')
    expect(skill.passiveModifiers![0]!.maxStacks).toBeUndefined()
  })

  it('Cẩn Thận — cặp passive chính (condition hpBelow 0.35) + phản (không condition)', () => {
    const chinh = passiveById.get('talent_passive_can_than')!
    const phan = passiveById.get('talent_passive_can_than_phi')!

    expect(chinh.passiveCondition).toEqual({ kind: 'hpBelow', percent: 0.35 })
    expect(phan.passiveCondition).toBeUndefined()
    // Phản passive cộng finalDamageReductionPercent ÂM (tức +5% nhận vào).
    expect(phan.passiveModifiers![0]!.percent).toBeLessThan(0)
  })

  it('Hấp Linh — condition hpBelow 0.5, stack vô hạn (chỉ hiệu lực khi thấp HP)', () => {
    const skill = passiveById.get('talent_passive_hap_linh')!

    expect(skill.passiveCondition).toEqual({ kind: 'hpBelow', percent: 0.5 })
    expect(skill.passiveModifiers![0]!.maxStacks).toBeUndefined()
  })

  it('mọi passive equipped + unlocked (PassiveSystem chỉ quét equipped)', () => {
    for (const skill of TALENT_PASSIVE_SKILLS) {
      expect(skill.equipped).toBe(true)
      expect(skill.unlocked).toBe(true)
      expect(skill.type).toBe('passive')
    }
  })
})
