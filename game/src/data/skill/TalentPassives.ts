import type { Skill } from '@/core/skill/Skill'
import type { StatModifier } from '@/core/stats/StatCalculator'

// Talent v4 combat passives (spec 2026-09-03-talent-catalog-v4-design.md
// sec.4.1) - 11 hidden passive skill, moi cai thuoc 1 talent combat. Duoc
// grant/revoke theo talent da chon (GameManager wiring, Task 4 cua plan
// M1) - KHONG hoc qua node tree, KHONG hien trong skill list UI (chi
// passive runtime). P7-M4 - learned passives always apply (SkillManager
// membership is the authority); no equip flag remains.
//
// Nhip chung (spec sec.3.1 dang A): tich -> nguong -> bung no -> tich lai.
// - Tich: passiveTrigger theo dung event cua talent (critical/hit/kill/
//   dodge/block/damage_taken...).
// - Bung no: passiveConvertsTo tro buff E1 (BuffPool convert-on-max)
//   hoac duoc BattleSystem doc truc tiep (pattern rieng).
// So lieu first-pass - cho playtest (spec sec.5).

function talentPassive(
  id: string,
  name: string,
  description: string,
  trigger: Skill['passiveTrigger'],
  modifiers: StatModifier[],
  extras: Partial<Skill> = {},
): Skill {
  return {
    id,
    name,
    description,
    type: 'passive',
    level: 1,
    maxLevel: 1,
    cooldown: 0,
    target: 'self',
    effects: [],
    passiveTrigger: trigger,
    passiveModifiers: modifiers,
    ...extras,
  }
}

function stat(
  stat: StatModifier['stat'],
  percent: number,
  maxStacks?: number,
): StatModifier {
  return {
    id: `talent:${stat}:${maxStacks ?? 'inf'}`,
    sourceId: 'talent',
    sourceType: 'talent',
    stat,
    percent,
    stacks: 0,
    maxStacks,
  }
}

// CP-01 - variant flat cho stat base-0 (rate stat): percent nhan len
// (base+flat)=0 van ra 0, nen cac passive duoi day phai cong tuyet doi.
function flatStat(
  stat: StatModifier['stat'],
  flat: number,
  maxStacks?: number,
): StatModifier {
  return {
    id: `talent:${stat}:${maxStacks ?? 'inf'}:flat`,
    sourceId: 'talent',
    sourceType: 'talent',
    stat,
    flat,
    stacks: 0,
    maxStacks,
  }
}

export const TALENT_PASSIVE_SKILLS: Skill[] = [
  // 1. Kiem Quang - chi mang: moi crit +1% crit (max 10) -> Kiem Vuc.
  talentPassive(
    'talent_passive_kiem_quang',
    'Kiếm Quang',
    'Nội tại Kiếm Quang của thiên phú — tích Kiếm Mạch bằng đòn bạo kích.',
    'critical',
    [flatStat('criticalRate', 0.01, 10)],
    { passiveConvertsTo: { buffId: 'kiem_vuc' } },
  ),
  // 2. Pha Giap - xuyen khang: moi hit +2 diem xuyen (max 5). M1: trong tran.
  talentPassive(
    'talent_passive_pha_giap',
    'Phá Giáp',
    'Nội tại Phá Giáp của thiên phú — tích Mổ Tạc bằng mỗi đòn trúng.',
    'hit',
    [flatStat('metalPenetration', 2, 5)],
  ),
  // 3. Tat Phong - toc do: moi kill +2% speed, stack vo han
  // trong tran, bi trung don reset (reset thuc thi o consumer event
  // 'damage' target=player - passiveModifiers stacks = 0).
  talentPassive(
    'talent_passive_tat_phong',
    'Tật Phong',
    'Nội tại Tật Phong của thiên phú — tích Tốc Độ bằng mỗi lần diệt địch.',
    'kill',
    [stat('speed', 0.02)],
  ),
  // 4. Trong Kich - sat thuong chi mang: crit damage +2% moi crit
  // (stack vo han trong tran, nguong bung +18% finalDamagePercent
  // qua buff - moi 3 crit cham nguong 3 tang converter).
  talentPassive(
    'talent_passive_trong_kich',
    'Trọng Kích',
    'Nội tại Trọng Kích của thiên phú — bạo kích càng nhiều đòn càng trọng.',
    'critical',
    [stat('criticalDamage', 0.02, 3)],
    { passiveConvertsTo: { buffId: 'trong_kich_burst' } },
  ),
  // 5. Hap Linh - hap huyet: chi hieu luc khi HP < 50% nhung x2.5 hieu
  // luc - passiveCondition chan tich, modifier leechPercent lon.
  talentPassive(
    'talent_passive_hap_linh',
    'Hấp Linh',
    'Nội tại Hấp Linh của thiên phú — hấp huyết bùng phát khi trọng thương.',
    'per_second',
    [stat('leechPercent', 0.03)],
    { passiveCondition: { kind: 'hpBelow', percent: 0.5 } },
  ),
  // 6. Thach Giap - phong thu: block thanh cong +2% defense (max 10)
  // -> Thach Nham (E1).
  talentPassive(
    'talent_passive_thach_giap',
    'Thạch Giáp',
    'Nội tại Thạch Giáp của thiên phú — tích phòng ngự bằng mỗi lần chặn đòn.',
    'block',
    [stat('defense', 0.02, 10)],
    { passiveConvertsTo: { buffId: 'thach_nham' } },
  ),
  // 7. Vo Anh - ne: dodge +1 tang (max 5, +2%/tang) -> Sat Na (E1).
  talentPassive(
    'talent_passive_vo_anh',
    'Vô Ảnh',
    'Nội tại Vô Ảnh của thiên phú — tích né tránh bằng mỗi lần tránh đòn.',
    'dodge',
    [stat('evasionRate', 0.02, 5)],
    { passiveConvertsTo: { buffId: 'sat_na' } },
  ),
  // 8. Can Than - duoi nguong HP nhan +10% (finalDamageReductionPercent),
  // tren nguong nhan -2% - dao doi sinh tu: 2 passive trai dau theo
  // condition, maxStacks = 1 de khong cong don vo han theo giay.
  talentPassive(
    'talent_passive_can_than',
    'Cẩn Thận',
    'Nội tại Cẩn Thận của thiên phú — lạnh lòng khi sát tử đường.',
    'per_second',
    [flatStat('finalDamageReductionPercent', 0.1, 1)],
    { passiveCondition: { kind: 'hpBelow', percent: 0.35 } },
  ),
  talentPassive(
    'talent_passive_can_than_phi',
    'Cẩn Thận (phản)',
    'Nội tại Cẩn Thận của thiên phú — chủ quan khi an toàn.',
    'per_second',
    [flatStat('finalDamageReductionPercent', -0.02, 1)],
    // CP-01 - downside leg chi ap TREN nguong; khong condition thi no
    // luon active va triet tieu mot nua leg 'hpBelow' phia tren.
    { passiveCondition: { kind: 'hpNotBelow', percent: 0.35 } },
  ),
  // 9. Ho The - ward vo no AoE + hoi ward: phan bung no ward-break nam
  // o CombatSystem (Task 4) - passive nay giu phan hoi ward sau vo
  // (wardRegenPerTurn tich theo damage_taken khi ward = 0).
  talentPassive(
    'talent_passive_ho_the',
    'Hộ Thể',
    'Nội tại Hộ Thể của thiên phú — hộ thuẫn vỡ càng lâu càng mau hồi.',
    'damage_taken',
    [stat('wardRegenPerTurn', 0.02, 5)],
  ),
  // 10. Thu Phat - phan chan: moi don an vao +1 tang Han Thu (max 5,
  // +5% Pha Thuan Phan Chan/tang). Dung flatStat vi wardBreakDamagePercent
  // co base = 0.
  talentPassive(
    'talent_passive_thu_phat',
    'Thứ Phạt',
    'Nội tại Thứ Phạt của thiên phú — mỗi đòn ăn vào nuôi phản chấn.',
    'damage_taken',
    [flatStat('wardBreakDamagePercent', 0.05, 5)],
  ),
  // 11. Bat Tu The - phan passive bo sung cho guard hien co: sau khi
  // guard cuu song, Tu Sinh Ngo ap truc tiep (CombatSystem, Task 4)
  // - passive nay khong tich stack, chi la anchor data cho grant/revoke
  // don gian hoa wiring (moi talent combat deu co 1 passive).
  talentPassive(
    'talent_passive_bat_tu_the',
    'Bất Tử Thể',
    'Nội tại Bất Tử Thể của thiên phú — tráo đổi tử kỳ lấy đạo cơ.',
    'damage_taken',
    [stat('criticalAvoidance', 0)],
  ),
]

export function getTalentPassiveSkill(id: string): Skill | undefined {
  return TALENT_PASSIVE_SKILLS.find((skill) => skill.id === id)
}
