import { describe, expect, it } from 'vitest'
import { collectTalentEffects, getTalentCombatPassiveSkillId, hasTalent } from './TalentEffects'
import { TALENT_PASSIVE_SKILLS } from '@/data/skill/TalentPassives'

// Talent v4 wiring (spec 2026-09-03-talent-catalog-v4-design.md S3.2,
// S4.1) - khoa: (1) getter combat passive tro dung skill, (2) da talent
// so huu that (M-F-TALENT supersede clamp id-dau) cong don effect theo
// level hien tai, (3) moi passive tro buff ton tai + co nhip dung spec.

describe('TalentEffects v4 — combat passive wiring + đa talent', () => {
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

  it('collectTalentEffects đa talent (M-F-TALENT supersede §3.2 clamp) — MỌI id được đọc, theo level', () => {
    // Multi-ownership gio la hop le (NEW grants) - ca hai passive deu thu.
    const effects = collectTalentEffects(['kiem_quang', 'tat_phong'])

    expect(effects).toEqual([
      { kind: 'combat_passive', passiveSkillId: 'talent_passive_kiem_quang' },
      { kind: 'combat_passive', passiveSkillId: 'talent_passive_tat_phong' },
    ])

    // Thu tu so huu quyet dinh thu tu effect (on dinh, deterministic).
    const reversed = collectTalentEffects(['tat_phong', 'kiem_quang'])

    expect(reversed).toEqual([
      { kind: 'combat_passive', passiveSkillId: 'talent_passive_tat_phong' },
      { kind: 'combat_passive', passiveSkillId: 'talent_passive_kiem_quang' },
    ])

    // talentLevels map doc effect theo level (mot breakthrough pool
    // talent o level 2 doc bang levels[0], khong phai base effects).
    const leveled = collectTalentEffects(['lk_dung_nap'], { lk_dung_nap: 2 })

    expect(leveled).toEqual([{ kind: 'cultivation_speed', percent: 0.2 }])
  })

  it('collectTalentEffects — id retired ở đầu → effect rỗng (không cộng dồn v3)', () => {
    // Save cu chi con retired id duy nhat: definition resolve duoc
    // (hien thi ten) nhung effects la [] - khong co hieu luc nao.
    expect(collectTalentEffects(['tu_bao'])).toEqual([])
    expect(collectTalentEffects(['unknown_talent'])).toEqual([])
  })

  it('Phàm Cốt giữ effect cultivation_speed −75%', () => {
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
    // Phan passive cong finalDamageReductionPercent AM (tuc +5% nhan vao).
    expect(phan.passiveModifiers![0]!.percent).toBeLessThan(0)
  })

  it('Hấp Linh — condition hpBelow 0.5, stack vô hạn (chỉ hiệu lực khi thấp HP)', () => {
    const skill = passiveById.get('talent_passive_hap_linh')!

    expect(skill.passiveCondition).toEqual({ kind: 'hpBelow', percent: 0.5 })
    expect(skill.passiveModifiers![0]!.maxStacks).toBeUndefined()
    expect(skill.passiveModifiers![0]!.stat).toBe('leechPercent')
  })

  it('Trọng Kích — trigger critical, 3 tầng crit damage → bùng trong_kich_burst', () => {
    const skill = passiveById.get('talent_passive_trong_kich')!

    expect(skill.passiveTrigger).toBe('critical')
    expect(skill.passiveModifiers![0]!.stat).toBe('criticalDamage')
    expect(skill.passiveModifiers![0]!.percent).toBeCloseTo(0.02)
    expect(skill.passiveModifiers![0]!.maxStacks).toBe(3)
    expect(skill.passiveConvertsTo).toEqual({ buffId: 'trong_kich_burst' })
  })

  it('Thạch Giáp — trigger block, 10 tầng defense → bùng thach_nham', () => {
    const skill = passiveById.get('talent_passive_thach_giap')!

    expect(skill.passiveTrigger).toBe('block')
    expect(skill.passiveModifiers![0]!.stat).toBe('defense')
    expect(skill.passiveModifiers![0]!.percent).toBeCloseTo(0.02)
    expect(skill.passiveModifiers![0]!.maxStacks).toBe(10)
    expect(skill.passiveConvertsTo).toEqual({ buffId: 'thach_nham' })
  })

  it('Vô Ảnh — trigger dodge, 5 tầng evasion → bùng sat_na', () => {
    const skill = passiveById.get('talent_passive_vo_anh')!

    expect(skill.passiveTrigger).toBe('dodge')
    expect(skill.passiveModifiers![0]!.stat).toBe('evasionRate')
    expect(skill.passiveModifiers![0]!.percent).toBeCloseTo(0.02)
    expect(skill.passiveModifiers![0]!.maxStacks).toBe(5)
    expect(skill.passiveConvertsTo).toEqual({ buffId: 'sat_na' })
  })

  it('Hộ Thể — trigger damage_taken, hồi ward theo tầng (nhịp ward vỡ thuộc CombatSystem — không convert)', () => {
    const skill = passiveById.get('talent_passive_ho_the')!

    expect(skill.passiveTrigger).toBe('damage_taken')
    expect(skill.passiveModifiers![0]!.stat).toBe('wardRegenPerTurn')
    expect(skill.passiveModifiers![0]!.maxStacks).toBe(5)
    expect(skill.passiveConvertsTo).toBeUndefined()
  })

  // generic thorns stat retired (spec 2026-09-15 T12) - the stacking
  // retaliation payload is wardBreakDamagePercent (Khien No).
  it('Thứ Phạt — trigger damage_taken, gai theo tầng Hận Thứ (decay thuộc consumer — không convert)', () => {
    const skill = passiveById.get('talent_passive_thu_phat')!

    expect(skill.passiveTrigger).toBe('damage_taken')
    expect(skill.passiveModifiers![0]!.stat).toBe('wardBreakDamagePercent')
    expect(skill.passiveModifiers![0]!.maxStacks).toBe(5)
    expect(skill.passiveConvertsTo).toBeUndefined()
  })

  it('Bất Tử Thể — passive anchor data (buff Tử Sinh Ngộ áp qua CombatSystem survive, không convert)', () => {
    const skill = passiveById.get('talent_passive_bat_tu_the')!

    expect(skill.passiveTrigger).toBe('damage_taken')
    expect(skill.passiveConvertsTo).toBeUndefined()
  })

  it('mọi talent passive đều là type passive (membership = learned authority)', () => {
    for (const skill of TALENT_PASSIVE_SKILLS) {
      expect(skill.type).toBe('passive')
    }
  })
})
