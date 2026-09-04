import type { Skill } from '@/core/skill/Skill'
import type { StatModifier } from '@/core/stats/StatCalculator'

// Talent v4 combat passives (spec 2026-09-03-talent-catalog-v4-design.md
// §4.1) — 11 hidden passive skill, mỗi cái thuộc 1 talent combat. Được
// grant/revoke theo talent đã chọn (GameManager wiring, Task 4 của plan
// M1) — KHÔNG học qua node tree, KHÔNG hiện trong skill list UI (chỉ
// passive runtime). `equipped: true` ngay từ đầu vì PassiveSystem chỉ
// quét passive equipped (SkillManager.getPassiveSkills).
//
// Nhịp chung (spec §3.1 dạng A): tích → ngưỡng → bùng nổ → tích lại.
// - Tích: passiveTrigger theo đúng event của talent (critical/hit/kill/
//   dodge/block/damage_taken...).
// - Bùng nổ: passiveConvertsTo trỏ buff E1 (BuffPool convert-on-max)
//   hoặc được BattleSystem đọc trực tiếp (pattern riêng).
// Số liệu first-pass — chờ playtest (spec §5).

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
    remainingCooldown: 0,
    target: 'self',
    effects: [],
    passiveTrigger: trigger,
    passiveModifiers: modifiers,
    unlocked: true,
    equipped: true,
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
    maxStacks,
  }
}

export const TALENT_PASSIVE_SKILLS: Skill[] = [
  // 1. Kiếm Quang — chí mạng: mỗi crit +1% crit (max 10) → Kiếm Vực 8s.
  talentPassive(
    'talent_passive_kiem_quang',
    'Kiếm Quang',
    'Nội tại Kiếm Quang của thiên phú — tích Kiếm Mạch bằng chí mạng.',
    'critical',
    [stat('criticalRate', 0.01, 10)],
    { passiveConvertsTo: { buffId: 'kiem_vuc' } },
  ),
  // 2. Phá Giáp — xuyên giáp: mỗi hit +2% xuyên (max 5). M1: trong trận.
  talentPassive(
    'talent_passive_pha_giap',
    'Phá Giáp',
    'Nội tại Phá Giáp của thiên phú — tích Mổ Tạc bằng mỗi đòn trúng.',
    'hit',
    [stat('metalPenetration', 0.02, 5)],
  ),
  // 3. Tật Phong — tốc đánh: mỗi kill +2% attackSpeed, stack vô hạn
  // trong trận, bị trúng đòn reset (reset thực thi ở consumer event
  // 'damage' target=player — passiveModifiers stacks = 0).
  talentPassive(
    'talent_passive_tat_phong',
    'Tật Phong',
    'Nội tại Tật Phong của thiên phú — tích tốc đánh bằng mỗi lần diệt địch.',
    'kill',
    [stat('speed', 0.02)],
  ),
  // 4. Trọng Kích — sát thương chí mạng: crit damage +2% mỗi crit
  // (stack vô hạn trong trận, ngưỡng bùng +30% finalDamagePercent 8s
  // qua buff — mỗi 3 crit chạm ngưỡng 3 tầng converter).
  talentPassive(
    'talent_passive_trong_kich',
    'Trọng Kích',
    'Nội tại Trọng Kích của thiên phú — chí mạng càng nhiều đòn càng trọng.',
    'critical',
    [stat('criticalDamage', 0.02, 3)],
    { passiveConvertsTo: { buffId: 'trong_kich_burst' } },
  ),
  // 5. Hấp Linh — hút máu: chỉ hiệu lực khi HP < 50% nhưng ×2.5 hiệu
  // lực — passiveCondition chặn tích, modifier leechPercent lớn.
  talentPassive(
    'talent_passive_hap_linh',
    'Hấp Linh',
    'Nội tại Hấp Linh của thiên phú — hút máu bùng phát khi thân thương.',
    'per_second',
    [stat('leechPercent', 0.0125)],
    { passiveCondition: { kind: 'hpBelow', percent: 0.5 } },
  ),
  // 6. Thạch Giáp — phòng thủ: block thành công +2% defense (max 10)
  // → Thạch Nham 5s (E1).
  talentPassive(
    'talent_passive_thach_giap',
    'Thạch Giáp',
    'Nội tại Thạch Giáp của thiên phú — tích phòng thủ bằng mỗi lần chặn đòn.',
    'block',
    [stat('defense', 0.02, 10)],
    { passiveConvertsTo: { buffId: 'thach_nham' } },
  ),
  // 7. Vô Ảnh — né: dodge +1 tầng (max 5, +2%/tầng) → Sát Na 6s (E1).
  talentPassive(
    'talent_passive_vo_anh',
    'Vô Ảnh',
    'Nội tại Vô Ảnh của thiên phú — tích né tránh bằng mỗi lần tránh đòn.',
    'dodge',
    [stat('evasionRate', 0.02, 5)],
    { passiveConvertsTo: { buffId: 'sat_na' } },
  ),
  // 8. Cẩn Thận — endurance: dưới ngưỡng HP nhận −10% (finalDamage
  // ReductionPercent), trên ngưỡng nhận +5% — dao đôi sinh tử: 2
  // passive trái dấu theo condition.
  talentPassive(
    'talent_passive_can_than',
    'Cẩn Thận',
    'Nội tại Cẩn Thận của thiên phú — lạnh lòng khi sát tử đường.',
    'per_second',
    [stat('finalDamageReductionPercent', 0.1)],
    { passiveCondition: { kind: 'hpBelow', percent: 0.35 } },
  ),
  talentPassive(
    'talent_passive_can_than_phi',
    'Cẩn Thận (phản)',
    'Nội tại Cẩn Thận của thiên phú — chủ quan khi an toàn.',
    'per_second',
    [stat('finalDamageReductionPercent', -0.05)],
  ),
  // 9. Hộ Thể — ward vỡ nổ AoE + hồi ward: phần bùng nổ ward-break nằm
  // ở CombatSystem (Task 4) — passive này giữ phần hồi ward sau vỡ
  // (wardRegenPerSecond tích theo damage_taken khi ward = 0).
  talentPassive(
    'talent_passive_ho_the',
    'Hộ Thể',
    'Nội tại Hộ Thể của thiên phú — khiên vỡ càng lâu càng mau hồi.',
    'damage_taken',
    [stat('wardRegenPerSecond', 0.02, 5)],
  ),
  // 10. Thứ Phạt — gai: bị đánh gần +30% thorns, mỗi phản +1 tầng Hận
  // Thứ (max 5, +5%/tầng), decay khi không bị đánh 3s (decay thực thi
  // consumer tick).
  talentPassive(
    'talent_passive_thu_phat',
    'Thứ Phạt',
    'Nội tại Thứ Phạt của thiên phú — mỗi đòn ăn vào nuôi gai sắc.',
    'damage_taken',
    [stat('thornsPercent', 0.05, 5)],
  ),
  // 11. Bất Tử Thể — phần passive bổ sung cho guard hiện có: sau khi
  // guard cứu sống, Tử Sinh Ngộ 10s áp trực tiếp (CombatSystem, Task 4)
  // — passive này không tích stack, chỉ là anchor data cho grant/revoke
  // đơn giản hoá wiring (mọi talent combat đều có 1 passive).
  talentPassive(
    'talent_passive_bat_tu_the',
    'Bất Tử Thể',
    'Nội tại Bất Tử Th thể của thiên phú — tráo đổi tử kỳ lấy đạo cơ.',
    'damage_taken',
    [stat('criticalAvoidance', 0)],
  ),
]

export function getTalentPassiveSkill(id: string): Skill | undefined {
  return TALENT_PASSIVE_SKILLS.find((skill) => skill.id === id)
}
