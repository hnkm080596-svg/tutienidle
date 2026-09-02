import { SKILL_RESOURCE_STAT_KEYS } from './Skill'
import type { Skill, SkillResourceStatKey } from './Skill'

// Skill rework (2026-08-21) — label/description/định dạng cho 19 field
// "Thế tài nguyên" trên Skill (trước đây sống chung với StatLabels.ts
// khi còn là CombatEntity.stats — xem đó cho phần label chỉ số nhân
// vật còn lại). Task 4 (i18n followups 2.3) — chuỗi label/description
// sống trong locale JSON (skillResource.<key>.label/.description, cả
// vi + en); file core này KHÔNG import i18n (core-no-i18n), chỉ xuất
// KEY cho consumer Vue render qua t() (hiện là NodeInspector.vue).
export type SkillResourceStatLabelKey = `skillResource.${SkillResourceStatKey}.label`

export type SkillResourceStatDescriptionKey = `skillResource.${SkillResourceStatKey}.description`

export interface SkillResourceStatLabelEntry {
  key: SkillResourceStatKey

  labelKey: SkillResourceStatLabelKey

  descriptionKey: SkillResourceStatDescriptionKey
}

// Dẫn từ SKILL_RESOURCE_STAT_KEYS — một nguồn sự thật với runtime
// stats: thêm field mới là entry tự theo (locale JSON vẫn thêm tay,
// parity test i18n/index.test.ts + test dưới đây bắt thiếu).
export const SKILL_RESOURCE_STAT_LABELS: SkillResourceStatLabelEntry[] = SKILL_RESOURCE_STAT_KEYS.map(
  (key): SkillResourceStatLabelEntry => ({
    key,
    labelKey: `skillResource.${key}.label`,
    descriptionKey: `skillResource.${key}.description`,
  }),
)

// Cùng nhóm "*Percent" hiện theo % 1 chữ số thập phân — giữ đúng danh
// sách con trong 19 field (loại trừ waterReactionExtensionSeconds/
// earthAoeRadius/earthKnockbackDistance/thoTheGainPerCast/
// hoaTheGainPerCast/kimTheGainPerProc/kimTheMaxStacksBonus/
// huyetPhaGainPerProc/huyetPhaBurstDamage/poisonRootMaxStacks — số
// nguyên/flat, không phải %).
const PERCENT_KEYS: SkillResourceStatKey[] = [
  'hoaTheDecayReductionPercent', 'thuyThePercent', 'poisonRootPercentPerStack',
  'poisonRootThresholdBonusPercent', 'earthAoeSecondaryDamagePercent', 'skillImpactPercent',
  'kimTheDotDamagePercentPerStack', 'kimTheDotResistancePenetrationPercentPerStack',
  'metalAilmentPotencyPercent',
]

// Task 4 (2.3) — ĐÃ đối chiếu formatNumber (core/format/NumberFormatter):
// KHÔNG đồng nhất output nên KHÔNG route qua formatter chung:
// - percent: formatNumber làm tròn về số nguyên dưới 10,000
//   (formatNumber(15.5) === '16' — mất hẳn chữ số thập phân của
//   '15.5%') và thêm dấu phẩy ngăn cách từ 1,000 ('1,500%' thay vì
//   '1500%').
// - flat: Math.round trùng behavior dưới 10,000 ('2' === '2') nhưng từ
//   10,000 formatNumber rút gọn hậu tố K/M ('15000' → '15K') — không
//   phải ý đồ hiển thị của stat này.
// Giữ (value * 100).toFixed(1) + Math.round.local cho đến khi
// formatter có chế độ decimal riêng (roadmap formatter followup).
export function formatSkillResourceStat(key: SkillResourceStatKey, value: number): string {
  if (PERCENT_KEYS.includes(key)) {
    return `${(value * 100).toFixed(1)}%`
  }

  return Math.round(value).toString()
}

// Mọi entry ≠0 (chưa mua node cấp field đó thì undefined/0, không hiện)
// trên 1 skill — consumer render labelKey/descriptionKey qua t()
// (NodeInspector.vue).
export interface ActiveSkillResourceStat {
  labelKey: SkillResourceStatLabelKey

  descriptionKey: SkillResourceStatDescriptionKey

  formatted: string
}

export function getActiveSkillResourceStats(skill: Skill): ActiveSkillResourceStat[] {
  return SKILL_RESOURCE_STAT_LABELS
    .filter(entry => (skill[entry.key] ?? 0) !== 0)
    .map(entry => ({
      labelKey: entry.labelKey,
      descriptionKey: entry.descriptionKey,
      formatted: formatSkillResourceStat(entry.key, skill[entry.key] ?? 0),
    }))
}
