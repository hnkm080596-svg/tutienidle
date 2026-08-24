import type { Skill, SkillResourceStatKey } from './Skill'

// Skill rework (2026-08-21) — label/description/định dạng cho 19 field
// "Thế tài nguyên" trên Skill (trước đây sống chung với StatLabels.ts
// khi còn là CombatEntity.stats — xem đó cho phần label chỉ số nhân
// vật còn lại). Dùng cho SkillDetailView.vue hiện khối "Thế tài
// nguyên" gắn liền skill, thay vì bảng chỉ số nhân vật chung.
export interface SkillResourceStatLabelEntry {
  key: SkillResourceStatKey

  label: string

  description: string
}

export const SKILL_RESOURCE_STAT_LABELS: SkillResourceStatLabelEntry[] = [
  { key: 'hoaTheGainPerCast', label: 'Hỏa Thế Tích/Lượt', description: 'Lượng Hỏa Thế nhận mỗi lần thi triển.' },
  { key: 'hoaTheDecayReductionPercent', label: 'Giảm Suy Hỏa Thế', description: 'Giảm % tốc độ Hỏa Thế tự tiêu tán theo thời gian.' },
  { key: 'thuyThePercent', label: 'Thủy Thế', description: 'Giảm thẳng % sát thương cuối cùng phải nhận.' },
  { key: 'waterReactionExtensionSeconds', label: 'Duy Trì Thủy', description: 'Khi Thủy kích hoạt Phản Ứng, gia hạn thêm số giây này thay vì tiêu hao Thủy trên mục tiêu.' },
  { key: 'poisonRootPercentPerStack', label: 'Mộc Thế/Tầng', description: 'Mỗi tầng Mộc Thế cộng thêm % sát thương Độc lên đúng mục tiêu đó.' },
  { key: 'poisonRootMaxStacks', label: 'Trần Mộc Thế', description: 'Số tầng Mộc Thế tối đa 1 mục tiêu có thể tích được.' },
  { key: 'poisonRootThresholdBonusPercent', label: 'Độc Mạch', description: 'Khi mục tiêu có từ 3 tầng Mộc Thế trở lên, cộng thêm % sát thương Độc.' },
  { key: 'earthAoeRadius', label: 'Bán Kính Chấn Địa', description: 'Số ô lan theo mỗi hướng quanh ô mục tiêu.' },
  { key: 'earthAoeSecondaryDamagePercent', label: 'ST Mục Tiêu Phụ', description: 'Sát thương lên mục tiêu phụ (qua Bán Kính Chấn Địa) so với mục tiêu chính.' },
  { key: 'earthKnockbackDistance', label: 'Lực Đẩy Lùi', description: 'Đẩy lùi mục tiêu khỏi nguồn bắn mỗi lần trúng đòn.' },
  { key: 'thoTheGainPerCast', label: 'Thổ Thế Tích/Lượt', description: 'Lượng Thổ Thế nhận mỗi lần thi triển.' },
  { key: 'skillImpactPercent', label: 'Chấn Lực Kỹ Năng', description: 'Stat nền dự phòng cho các cơ chế Thổ Tu tương lai.' },
  { key: 'kimTheGainPerProc', label: 'Kim Thế Tích/Lần', description: 'Lượng Kim Thế nhận mỗi lần áp thành công Xuất Huyết.' },
  { key: 'kimTheDotDamagePercentPerStack', label: 'Kim Thế/Tầng', description: 'Mỗi tầng Kim Thế cộng thêm % sát thương DoT Kim.' },
  { key: 'kimTheDotResistancePenetrationPercentPerStack', label: 'Xuyên Kháng DoT/Tầng', description: 'Stat nền dự phòng cho cơ chế Xuyên Kháng DoT tương lai.' },
  { key: 'kimTheMaxStacksBonus', label: 'Trần Kim Thế', description: 'Cộng thêm số tầng Kim Thế tối đa.' },
  { key: 'metalAilmentPotencyPercent', label: 'Sát Thương Xuất Huyết', description: 'Tăng % sát thương/giây của DoT Kim (Xuất Huyết).' },
  { key: 'huyetPhaGainPerProc', label: 'Huyết Phá Tích/Lần', description: 'Lượng Huyết Phá charge nhận mỗi lần áp thành công Xuất Huyết.' },
  { key: 'huyetPhaBurstDamage', label: 'Huyết Phá Bạo Phát', description: 'Sát thương bùng nổ 1 lần khi Huyết Phá chạm đủ 5 tầng.' },
]

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

export function formatSkillResourceStat(key: SkillResourceStatKey, value: number): string {
  if (PERCENT_KEYS.includes(key)) {
    return `${(value * 100).toFixed(1)}%`
  }

  return Math.round(value).toString()
}

// Mọi entry ≠0 (chưa mua node cấp field đó thì undefined/0, không hiện)
// trên 1 skill — dùng thẳng bởi SkillDetailView.vue.
export function getActiveSkillResourceStats(skill: Skill): { label: string; description: string; formatted: string }[] {
  return SKILL_RESOURCE_STAT_LABELS
    .filter(entry => (skill[entry.key] ?? 0) !== 0)
    .map(entry => ({
      label: entry.label,
      description: entry.description,
      formatted: formatSkillResourceStat(entry.key, skill[entry.key] ?? 0),
    }))
}
