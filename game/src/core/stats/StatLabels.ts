import type { Stats } from './StatBlock'
import { formatNumber } from '../format/NumberFormatter'
import { isPercentStat, STAT_METADATA } from './StatMetadata'

export type StatCategory = 'combat' | 'survival' | 'special' | 'attribute' | 'defense_advanced'

export interface StatLabelEntry {
  key: keyof Stats

  label: string

  description: string

  category: StatCategory
}

// Trich tu CharacterPanel.vue (2026-08-15, dung chung voi tooltip Tam
// Phap - ca 2 noi deu can label/description nguoi-doc-duoc cho tung
// stat, tranh lap lai bang 30 dong). movementSpeed KHONG co trong danh
// sach - player la tower co dinh, khong di chuyen, stat nay chi con y
// nghia cho quai.
export const BASE_STAT_LABELS: StatLabelEntry[] = [
  // stat-system-reimagined Task 12 (D14): attack -> might, label = Uy Luc
  // (universal damage base, not "basic attack").
  { key: 'might', label: 'Uy Lực', description: 'Nền sát thương chung cho mọi chiêu thức — vật lý, ngũ hành và hỗn nguyên.', category: 'combat' },
  { key: 'defense', label: 'Phòng Ngự', description: 'Giảm % sát thương vật lý phải nhận theo đường cong phòng ngự — càng cao mức giảm tăng thêm càng chậm, có trần.', category: 'combat' },
  { key: 'speed', label: 'Tốc Độ', description: 'Tốc độ tích tụ thanh hành động — càng cao càng sớm xuất chiêu trong chiến đấu theo lượt.', category: 'combat' },

  { key: 'maxHp', label: 'Khí Huyết', description: 'Lượng sinh cơ tối đa — cạn kiệt sẽ trọng thương bại trận.', category: 'survival' },
  { key: 'hpRegenPerTurn', label: 'Hồi Khí Huyết', description: 'Khí huyết tự hồi phục mỗi lượt.', category: 'survival' },
  { key: 'maxMp', label: 'Linh Lực', description: 'Nguồn linh khí hộ thân của Pháp Tu — một phần sát thương sau Hộ Thuẫn chuyển sang tiêu hao Linh Lực thay vì Khí Huyết.', category: 'survival' },
  { key: 'manaRegenPerTurn', label: 'Hồi Linh Lực', description: 'Linh lực tự hồi phục mỗi lượt.', category: 'survival' },
  { key: 'criticalRate', label: 'Tỉ Lệ Bạo Kích', description: 'Xác suất một đòn xuất chiêu bộc phát sát thương bạo kích.', category: 'special' },
  { key: 'criticalDamage', label: 'Uy Lực Bạo Kích', description: 'Hệ số sát thương khi bạo kích. 150% nghĩa là đòn bạo kích mạnh gấp 1.5 lần đòn thường.', category: 'special' },
  { key: 'criticalAvoidance', label: 'Kháng Bạo Kích', description: 'Trừ thẳng vào Tỉ Lệ Bạo Kích của đối phương khi công kích bản thân.', category: 'special' },
  { key: 'accuracyRating', label: 'Chính Xác', description: 'Đấu với Né Tránh của đối phương để quyết định chiêu thức có trúng đích hay không.', category: 'special' },
  { key: 'evasionRate', label: 'Né Tránh', description: 'Điểm thân pháp né đòn đấu với Chính Xác của đối phương — càng cao càng dễ hóa giải hoàn toàn đòn đánh.', category: 'special' },
  { key: 'finalDamagePercent', label: 'Sát Thương Cuối', description: 'Khuếch đại toàn bộ sát thương gây ra ở bước tính cuối cùng.', category: 'special' },
  { key: 'skillDamagePercent', label: 'Uy Lực Chiêu Thức', description: 'Tăng sát thương gây ra bởi các chiêu thức chủ động.', category: 'special' },
  { key: 'finalDamageReductionPercent', label: 'Giảm Thương Cuối', description: 'Giảm trực tiếp toàn bộ sát thương phải nhận ở bước cuối.', category: 'defense_advanced' },
  { key: 'chanceToIgnoreResistance', label: 'Phá Phòng Tuyệt Đối', description: 'Xác suất một đòn đánh xuyên thủng hoàn toàn Phòng Ngự và Kháng Ngũ Hành của đối phương.', category: 'special' },
  { key: 'elementApplicationPercent', label: 'Tỉ Lệ Áp Ấn', description: 'Nhân với tỉ lệ gieo Ấn Ký / Dị Thường (Hỏa Ấn, Độc Căn...) của chiêu thức khi đánh trúng (vd: +10% trên gốc 15% → 16.5%).', category: 'special' },
  { key: 'reactionEffectPercent', label: 'Uy Lực Phản Ứng', description: 'Tăng % uy lực khi Phản Ứng Ngũ Hành kích hoạt.', category: 'special' },
  { key: 'ailmentDurationPercent', label: 'Thời Lượng Dị Thường', description: 'Tăng % số lượt duy trì của mọi dị thường bản thân gây ra.', category: 'special' },
  { key: 'dotResistancePercent', label: 'Kháng Sát Thương Duy Trì', description: 'Giảm thẳng % sát thương nhận từ mọi hiệu ứng rút máu theo lượt (Hỏa Ấn, Độc Căn, Liệt Thương...).', category: 'defense_advanced' },

  { key: 'strength', label: 'Căn Cốt', description: 'Cộng thẳng Uy Lực và Phòng Ngự.', category: 'attribute' },
  { key: 'dexterity', label: 'Thân Pháp', description: 'Cộng Chính Xác, Né Tránh và Tỉ Lệ Bạo Kích.', category: 'attribute' },
  { key: 'intelligence', label: 'Thần Thức', description: 'Cộng Kháng Dị Thường, Uy Lực Dị Thường và Uy Lực Bạo Kích.', category: 'attribute' },
  { key: 'attunement', label: 'Linh Căn', description: 'Cộng đều linh lực công phạt của cả 6 hành (Ngũ Hành + Hỗn Nguyên).', category: 'attribute' },
  { key: 'vitality', label: 'Thể Phách', description: 'Cộng Khí Huyết tối đa, Hồi Khí Huyết và Ngưỡng Kiên Cường.', category: 'attribute' },

  { key: 'blockChance', label: 'Tỉ Lệ Chặn Đòn', description: 'Xác suất đỡ được đòn công kích, giảm sát thương theo Hiệu Quả Chặn Đòn.', category: 'defense_advanced' },
  { key: 'blockEffectiveness', label: 'Hiệu Quả Chặn Đòn', description: 'Tỉ lệ sát thương giảm bớt khi chặn đòn thành công.', category: 'defense_advanced' },
  { key: 'enduranceThreshold', label: 'Ngưỡng Kiên Cường', description: 'Đòn có sát thương ≤ ngưỡng này bị giảm mạnh theo Hiệu Quả Kiên Cường — đòn lớn hơn chỉ bị trừ một lượng cố định.', category: 'defense_advanced' },
  { key: 'endurancePercent', label: 'Hiệu Quả Kiên Cường', description: 'Mức giảm sát thương áp dụng cho đòn đánh dưới Ngưỡng Kiên Cường.', category: 'defense_advanced' },
  { key: 'wardMax', label: 'Hộ Thuẫn Tối Đa', description: 'Lớp linh thuẫn hấp thụ sát thương trước Khí Huyết — tự hồi phục khi không bị đánh trúng.', category: 'defense_advanced' },
  // Phap Tu Reimagined (F13): 'Linh luc ho the' is the reimagine's
  // DR mechanic name -- manaShieldPercent (the damage->mana shield)
  // keeps a distinct label.
  { key: 'manaShieldPercent', label: 'Linh Thuẫn Hóa Thương', description: 'Tỉ lệ sát thương nhận vào được chuyển sang tiêu hao Linh Lực.', category: 'defense_advanced' },
  { key: 'linhLucHoTheCap', label: 'Linh Lực Hộ Thể', description: 'Trần giảm sát thương trực tiếp dựa trên tỉ lệ Linh Lực hiện tại — cạn Linh Lực sẽ mất hiệu lực.', category: 'defense_advanced' },
  { key: 'wardRegenPerTurn', label: 'Hồi Hộ Thuẫn', description: 'Lượng Hộ Thuẫn tự hồi mỗi lượt (sau khi không bị đánh trúng đủ nhịp).', category: 'defense_advanced' },
  { key: 'wardBreakDamagePercent', label: 'Phá Thuẫn Phản Chấn', description: 'Khi Hộ Thuẫn vừa vỡ hẳn, chấn ngược % dung lượng Hộ Thuẫn tối đa thành sát thương vào kẻ tấn công.', category: 'defense_advanced' },
  { key: 'leechPercent', label: 'Hấp Huyết', description: 'Chuyển hóa % sát thương gây ra thành Khí Huyết bản thân.', category: 'defense_advanced' },
  { key: 'healingEffectivenessPercent', label: 'Hiệu Lực Hồi Phục', description: 'Tăng % Khí Huyết nhận được từ hồi phục tự nhiên, chiêu thức trị thương và hiệu ứng hồi phục — không ảnh hưởng Hấp Huyết.', category: 'defense_advanced' },
  // The Tu An reactive chances (spec 2026-09-15 section 3.2).
  { key: 'counterChance', label: 'Tỉ Lệ Phản Kích', description: 'Xác suất lập tức phản đòn khi bị đánh trúng — chỉ từ thuộc tính (Thể Tu Ẩn).', category: 'defense_advanced' },
  { key: 'protectChance', label: 'Tỉ Lệ Hộ Vệ', description: 'Xác suất chặn đòn thay đồng đội — chỉ từ thuộc tính (Thể Tu Ẩn).', category: 'defense_advanced' },
  { key: 'followUpChance', label: 'Tỉ Lệ Truy Kích', description: 'Xác suất đánh bồi theo sau đòn của đồng đội — chỉ từ thuộc tính (Thể Tu Ẩn).', category: 'defense_advanced' },
  // generic thorns stat retired (spec 2026-09-15 T12).
  { key: 'ailmentResistPercent', label: 'Kháng Dị Thường', description: 'Giảm % tỉ lệ trúng và số lượt duy trì của mọi hiệu ứng dị thường (rút máu/khống chế) nhận vào.', category: 'defense_advanced' },
  { key: 'ailmentPotencyPercent', label: 'Uy Lực Dị Thường', description: 'Tăng % sát thương mỗi lượt của mọi dị thường bản thân gây ra.', category: 'defense_advanced' },
]

// i18n refactor 2026-08-31 - cac stat key khong thuoc CharacterPanel
// stat table (do la cac stat per-entity, vd maxHp/attackSpeed); day la
// cac gia tri "ky thuat" hien qua formatStat() o UI rai rac
// (tooltip tang Tam Phap, bang Dac Quyen Canh Gioi, badge Delta affix
// Cuong Hoa, nhan xtoc do Dia Gioi, xpham Phap Bao, % Tu Vi Dan
// Duoc). Tach rieng khoi BASE_STAT_LABELS de:
//   1. Khong xuat hien trong bang chi so nhan vat (stat key khong
//      thuoc nhan vat - vd production speed la he so site).
//   2. statLabel() van tra ve label nguoi-doc-duoc qua lookup bo
//      sung.
const FORMAT_ADOPTED_STAT_LABELS: Partial<Record<keyof Stats, string>> = {
  realmPassivePercent: 'Cộng % Cảnh Giới',
  affixDeltaPercent: 'Tăng Trưởng Cường Hóa',
  productionSpeedMultiplier: 'Hệ số tốc độ',
  artifactGradeMultiplier: 'Hệ số Pháp Bảo',
  cultivationPercent: 'Tu Vi (Đan Dược)',
}

// Ngu Hanh + Hon Nguyen - KHONG co trong BASE_STAT_LABELS (CharacterPanel.vue
// hien thi rieng qua elementRows, xem ELEMENT_LABELS o do) nhung
// technique.modifiers CO THE nham thang cac stat nay (vd
// xich_viem_combat_fire_power sua `firePower`) - statLabel() duoi day
// can phu luon de tooltip khong hien ten field tho.
const ELEMENT_STAT_LABELS: Partial<Record<keyof Stats, string>> = {
  woodPower: 'Mộc Lực', woodResistance: 'Kháng Mộc', woodPenetration: 'Xuyên Mộc',
  firePower: 'Hỏa Lực', fireResistance: 'Kháng Hỏa', firePenetration: 'Xuyên Hỏa',
  earthPower: 'Thổ Lực', earthResistance: 'Kháng Thổ', earthPenetration: 'Xuyên Thổ',
  metalPower: 'Kim Lực', metalResistance: 'Kháng Kim', metalPenetration: 'Xuyên Kim',
  waterPower: 'Thủy Lực', waterResistance: 'Kháng Thủy', waterPenetration: 'Xuyên Thủy',
  // Spec 2026-08-30-phap-tu-dao-sac sec5 - label Phong/Loi da xoa cung
  // stat wind/lightning khoi Stats.
  primordialPower: 'Hỗn Nguyên Lực',
}

// ================= SYSTEM vs DISPLAY =================
// System value (StatMetadata.unit + gia tri trong Stats) CHI phuc vu
// tinh toan (CombatSystem, ProductionSystem...). Display layer DUOI
// DAY la duy nhat chiu trach nhiem bien system value thanh chuoi cho
// UI/tooltip - khong UI nao tu format stat.
//
// System units (StatMetadata):
//   percent    - fraction 0..1 trong cong thuc (0.05 = +5%)
//   multiplier - he so nhan truc tiep (1.5 = x1.5 damage/speed)
//   rating/flat- diem thuan (accuracy 100, might 1250)
//
// Display rules:
//   percent    -> LUON "5.0%" (khong ngoai le; bug cu: blockEffectiveness
//                tung roi vao DECIMAL hien thi "0.25")
//   multiplier -> 2 kieu hien thi theo y nghia nguoi choi doc:
//                  DISPLAY_AS_PERCENT: he so sat thuong/phong thu doc
//                    qua % (crit dmg 1.5 -> "150%": 100% don thuong + 50%)
//                  mac dinh: he so throughput doc qua he so (1.25 -> "1.25")
//   rating/flat-> formatNumber
export const DECIMAL_STAT_KEYS: (keyof Stats)[] = []

// Multiplier he so DOC qua % - chi hien thi, khong doi unit cong thuc.
const MULTIPLIER_DISPLAY_AS_PERCENT: readonly (keyof Stats)[] = ['criticalDamage']

export function statLabel(key: keyof Stats): string {
  return BASE_STAT_LABELS.find(entry => entry.key === key)?.label ?? ELEMENT_STAT_LABELS[key] ?? FORMAT_ADOPTED_STAT_LABELS[key] ?? key
}

// Trich tu CharacterPanel.vue - dung chung cho moi noi hien gia tri
// stat cho nguoi choi doc (bang chi so, tooltip Tam Phap...).
export function formatStat(key: keyof Stats, value: number): string {
  // percent (fraction 0..1) -> LUON % - khong ngoai le.
  if (isPercentStat(key)) {
    return `${(value * 100).toFixed(1)}%`
  }

  // multiplier doc qua % (crit damage 1.5 -> "150%").
  if (MULTIPLIER_DISPLAY_AS_PERCENT.includes(key)) {
    return `${Math.round(value * 100)}%`
  }

  // multiplier throughput (attackSpeed 1.25 -> "1.25").
  if (DECIMAL_STAT_KEYS.includes(key)) {
    return (Math.round(value * 100) / 100).toString()
  }

  // Multiplier con lai (productionSpeedMultiplier/artifactGradeMultiplier).
  if (STAT_METADATA[key]?.unit === 'multiplier') {
    return (Math.round(value * 100) / 100).toString()
  }

  // rating/flat.
  return formatNumber(Math.round(value))
}
