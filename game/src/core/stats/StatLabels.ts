import type { Stats } from './StatBlock'
import { formatNumber } from '../format/NumberFormatter'
import { isPercentStat } from './StatMetadata'

export type StatCategory = 'combat' | 'survival' | 'special' | 'attribute' | 'defense_advanced'

export interface StatLabelEntry {
  key: keyof Stats

  label: string

  description: string

  category: StatCategory
}

// Trích từ CharacterPanel.vue (2026-08-15, dùng chung với tooltip Tâm
// Pháp — cả 2 nơi đều cần label/description người-đọc-được cho từng
// stat, tránh lặp lại bảng 30 dòng). movementSpeed KHÔNG có trong danh
// sách — player là tower cố định, không di chuyển, stat này chỉ còn ý
// nghĩa cho quái.
export const BASE_STAT_LABELS: StatLabelEntry[] = [
  { key: 'attack', label: 'Công kích', description: 'Sát thương vật lý cơ bản gây ra khi tấn công.', category: 'combat' },
  { key: 'defense', label: 'Phòng ngự (Giáp)', description: 'Giảm % sát thương vật lý phải nhận theo đường cong (Armor) — càng cao càng giảm dần, có trần.', category: 'combat' },
  { key: 'attackSpeed', label: 'Tốc đánh', description: 'Số đòn đánh cơ bản mỗi giây.', category: 'combat' },
  { key: 'movementSpeed', label: 'Tốc độ di chuyển', description: 'Tốc độ di chuyển trên chiến trường.', category: 'combat' },

  { key: 'maxHp', label: 'Khí huyết', description: 'Lượng máu tối đa — về 0 thì gục ngã.', category: 'survival' },
  { key: 'hpRegenPerSecond', label: 'Hồi khí huyết', description: 'Máu hồi tự nhiên mỗi giây.', category: 'survival' },
  { key: 'maxMp', label: 'Linh lực', description: 'Tài nguyên tiêu hao khi dùng skill loại special.', category: 'survival' },
  { key: 'manaRegenPerSecond', label: 'Hồi linh lực', description: 'Linh lực hồi tự nhiên mỗi giây.', category: 'survival' },
  { key: 'criticalRate', label: 'Tỉ lệ bạo kích', description: 'Xác suất một đòn đánh gây sát thương chí mạng.', category: 'special' },
  { key: 'criticalDamage', label: 'ST bạo kích', description: 'Hệ số nhân sát thương khi đòn đánh chí mạng.', category: 'special' },
  { key: 'criticalAvoidance', label: 'Kháng bạo kích', description: 'Trừ thẳng vào tỉ lệ bạo kích của đối phương khi họ đánh mình.', category: 'special' },
  { key: 'accuracyRating', label: 'Độ chính xác', description: 'Đấu với Tỉ lệ né của đối phương để quyết định đòn có trúng hay không.', category: 'special' },
  { key: 'evasionRate', label: 'Tỉ lệ né', description: 'Đấu với Độ chính xác của đối phương — càng cao càng dễ né hoàn toàn 1 đòn.', category: 'special' },
  { key: 'cooldownReduction', label: 'Giảm hồi chiêu', description: 'Giảm % thời gian hồi chiêu của mọi skill.', category: 'special' },
  { key: 'castSpeedPercent', label: 'Tốc Độ Thi Triển', description: 'Rút ngắn % Cast Time của skill cần niệm chú (Cast Time), độc lập với Tốc đánh/Giảm hồi chiêu.', category: 'special' },
  { key: 'finalDamagePercent', label: 'Sát thương cuối', description: 'Tăng toàn bộ sát thương sau các bước tính cơ bản.', category: 'special' },
  { key: 'skillDamagePercent', label: 'Sát thương kỹ năng', description: 'Tăng sát thương gây ra bởi kỹ năng.', category: 'special' },
  { key: 'finalDamageReductionPercent', label: 'Giảm sát thương cuối', description: 'Giảm toàn bộ sát thương nhận vào ở bước cuối.', category: 'defense_advanced' },
  { key: 'chanceToIgnoreResistance', label: 'Xuyên kháng tuyệt đối', description: 'Xác suất 1 đòn bỏ qua HOÀN TOÀN Giáp/Kháng của đối phương.', category: 'special' },
  { key: 'elementApplicationPercent', label: 'Tỉ lệ áp Nguyên Tố', description: 'Cộng thẳng vào tỉ lệ áp dị thường (Thiêu Đốt...) của skill khi đánh trúng.', category: 'special' },
  { key: 'reactionEffectPercent', label: 'Hiệu Ứng Phản Ứng', description: 'Tăng % sát thương khi Phản Ứng Nguyên Tố kích hoạt.', category: 'special' },
  { key: 'ailmentDurationPercent', label: 'Thời Lượng Dị Thường', description: 'Tăng % thời lượng mọi dị thường mình gây ra.', category: 'special' },
  { key: 'dotResistancePercent', label: 'Kháng DoT', description: 'Giảm thẳng % sát thương nhận từ mọi hiệu ứng DoT (Bỏng/Trúng Độc/Chảy Máu...).', category: 'defense_advanced' },
  { key: 'poisonRecoveryPercent', label: 'Hồi Sinh Lực Từ Độc', description: 'Hồi % sát thương Trúng Độc gây ra về Khí huyết bản thân.', category: 'special' },

  { key: 'strength', label: 'Căn Cốt', description: 'Cộng thẳng Công kích + Phòng ngự.', category: 'attribute' },
  { key: 'dexterity', label: 'Thân Pháp', description: 'Cộng Tốc đánh, Độ chính xác, Tỉ lệ né, Tỉ lệ bạo kích.', category: 'attribute' },
  { key: 'intelligence', label: 'Thần Thức', description: 'Cộng Giảm hồi chiêu, Kháng dị thường và ST bạo kích.', category: 'attribute' },
  { key: 'attunement', label: 'Linh Căn', description: 'Cộng đều Power cả 6 hành (Ngũ Hành + Hỗn Nguyên).', category: 'attribute' },
  { key: 'vitality', label: 'Thể Chất', description: 'Cộng Khí huyết tối đa, Hồi khí huyết, Ngưỡng Kiên Cường.', category: 'attribute' },

  { key: 'blockChance', label: 'Tỉ lệ đỡ đòn', description: 'Xác suất đỡ được 1 đòn, giảm sát thương theo Hiệu Quả Đỡ Đòn.', category: 'defense_advanced' },
  { key: 'blockEffectiveness', label: 'Hiệu quả đỡ đòn', description: 'Giảm bao nhiêu % sát thương khi đỡ đòn thành công.', category: 'defense_advanced' },
  { key: 'enduranceThreshold', label: 'Ngưỡng Kiên Cường', description: 'Đòn có sát thương ≤ ngưỡng này bị giảm mạnh theo % Kiên Cường — đòn to hơn chỉ bị trừ 1 lượng cố định.', category: 'defense_advanced' },
  { key: 'endurancePercent', label: '% Kiên Cường', description: 'Mức giảm sát thương áp dụng cho đòn nhỏ (xem Ngưỡng Kiên Cường).', category: 'defense_advanced' },
  { key: 'wardMax', label: 'Hộ Thuẫn tối đa', description: 'Máu phụ hấp thụ sát thương trước Khí huyết — tự hồi khi không bị đánh trúng 1 lúc.', category: 'defense_advanced' },
  { key: 'manaShieldPercent', label: 'Linh lực hộ thể', description: 'Tỉ lệ sát thương được chuyển sang tiêu hao Linh lực.', category: 'defense_advanced' },
  { key: 'wardRegenPerSecond', label: 'Hồi Hộ Thuẫn', description: 'Hộ Thuẫn hồi mỗi giây (sau khi không bị đánh trúng đủ lâu).', category: 'defense_advanced' },
  { key: 'wardBreakDamagePercent', label: 'Khiên Nổ', description: 'Khi Hộ Thuẫn vừa vỡ hẳn, phản % dung lượng Hộ Thuẫn tối đa thành sát thương vào kẻ tấn công.', category: 'defense_advanced' },
  { key: 'leechPercent', label: 'Hút máu', description: 'Hồi máu theo % sát thương gây ra.', category: 'defense_advanced' },
  { key: 'thornsPercent', label: 'Phản đòn', description: 'Đối phương tự nhận lại % sát thương gây cho mình khi đánh trúng.', category: 'defense_advanced' },
  { key: 'ailmentResistPercent', label: 'Kháng dị thường', description: 'Giảm % thời lượng mọi hiệu ứng dị thường (DoT/khống chế) nhận vào.', category: 'defense_advanced' },
  { key: 'ailmentPotencyPercent', label: 'Uy lực dị thường', description: 'Tăng % hiệu lực (sát thương/giây) của dị thường mình gây ra.', category: 'defense_advanced' },
]

// Ngũ Hành + Hỗn Nguyên — KHÔNG có trong BASE_STAT_LABELS (CharacterPanel.vue
// hiện thị riêng qua elementRows, xem ELEMENT_LABELS ở đó) nhưng
// technique.modifiers CÓ THỂ nhắm thẳng các stat này (vd
// xich_viem_combat_fire_power sửa `firePower`) — statLabel() dưới đây
// cần phủ luôn để tooltip không hiện tên field thô.
const ELEMENT_STAT_LABELS: Partial<Record<keyof Stats, string>> = {
  woodPower: 'Mộc Lực', woodResistance: 'Kháng Mộc', woodPenetration: 'Xuyên Mộc',
  firePower: 'Hỏa Lực', fireResistance: 'Kháng Hỏa', firePenetration: 'Xuyên Hỏa',
  earthPower: 'Thổ Lực', earthResistance: 'Kháng Thổ', earthPenetration: 'Xuyên Thổ',
  metalPower: 'Kim Lực', metalResistance: 'Kháng Kim', metalPenetration: 'Xuyên Kim',
  waterPower: 'Thủy Lực', waterResistance: 'Kháng Thủy', waterPenetration: 'Xuyên Thủy',
  // Spec 2026-08-30-phap-tu-dao-sac §5 — label Phong/Lôi đã xoá cùng
  // stat wind/lightning khỏi Stats.
  primordialPower: 'Hỗn Nguyên Lực',
}

// attackSpeed/criticalDamage/blockEffectiveness là hệ số gần 1 (vd
// 1.5) — làm tròn nguyên sẽ mất hết ý nghĩa, giữ tối đa 2 chữ số
// thập phân.
export const DECIMAL_STAT_KEYS: (keyof Stats)[] = ['attackSpeed', 'criticalDamage', 'blockEffectiveness']

export function statLabel(key: keyof Stats): string {
  return BASE_STAT_LABELS.find(entry => entry.key === key)?.label ?? ELEMENT_STAT_LABELS[key] ?? key
}

// Trích từ CharacterPanel.vue — dùng chung cho mọi nơi hiện giá trị
// stat cho người chơi đọc (bảng chỉ số, tooltip Tâm Pháp...).
export function formatStat(key: keyof Stats, value: number): string {
  if (isPercentStat(key)) {
    return `${(value * 100).toFixed(1)}%`
  }

  if (DECIMAL_STAT_KEYS.includes(key)) {
    return (Math.round(value * 100) / 100).toString()
  }

  return formatNumber(Math.round(value))
}
