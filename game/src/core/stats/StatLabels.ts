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
  // stat-system-reimagined Task 12 (D14): attack -> might, label = Suc manh
  // (universal damage base, not "basic attack").
  { key: 'might', label: 'Sức mạnh', description: 'Nền sát thương chung cho mọi loại damage — vật lý, ngũ hành và hỗn nguyên.', category: 'combat' },
  { key: 'defense', label: 'Phòng ngự (Giáp)', description: 'Giảm % sát thương vật lý phải nhận theo đường cong (Armor) — càng cao càng giảm dần, có trần.', category: 'combat' },
  { key: 'speed', label: 'Thân Pháp (Tốc Độ)', description: 'Tốc độ lấp đầy thanh hành động — càng cao càng sớm được ra đòn trong chiến đấu theo lượt.', category: 'combat' },

  { key: 'maxHp', label: 'Khí huyết', description: 'Lượng máu tối đa — về 0 thì gục ngã.', category: 'survival' },
  { key: 'hpRegenPerTurn', label: 'Hồi khí huyết', description: 'Máu hồi tự nhiên mỗi lượt.', category: 'survival' },
  { key: 'maxMp', label: 'Linh lực', description: 'Tài nguyên phòng thủ của Pháp Tu — một phần sát thương sau Hộ Thuẫn chuyển sang trừ Linh lực thay vì Sinh mệnh.', category: 'survival' },
  { key: 'manaRegenPerTurn', label: 'Hồi linh lực', description: 'Linh lực hồi tự nhiên mỗi lượt.', category: 'survival' },
  { key: 'criticalRate', label: 'Tỉ lệ bạo kích', description: 'Xác suất một đòn đánh gây sát thương chí mạng.', category: 'special' },
  { key: 'criticalDamage', label: 'ST bạo kích', description: 'Sát thương đòn chí mạng. 150% nghĩa là đòn chí mạng mạnh gấp 1.5 lần đòn thường.', category: 'special' },
  { key: 'criticalAvoidance', label: 'Kháng bạo kích', description: 'Trừ thẳng vào tỉ lệ bạo kích của đối phương khi họ đánh mình.', category: 'special' },
  { key: 'accuracyRating', label: 'Độ chính xác', description: 'Đấu với Tỉ lệ né của đối phương để quyết định đòn có trúng hay không.', category: 'special' },
  { key: 'evasionRate', label: 'Tỉ lệ né', description: 'Đấu với Độ chính xác của đối phương — càng cao càng dễ né hoàn toàn 1 đòn.', category: 'special' },
  { key: 'finalDamagePercent', label: 'Sát thương cuối', description: 'Tăng toàn bộ sát thương sau các bước tính cơ bản.', category: 'special' },
  { key: 'skillDamagePercent', label: 'Sát thương kỹ năng', description: 'Tăng sát thương gây ra bởi kỹ năng.', category: 'special' },
  { key: 'finalDamageReductionPercent', label: 'Giảm sát thương cuối', description: 'Giảm toàn bộ sát thương nhận vào ở bước cuối.', category: 'defense_advanced' },
  { key: 'chanceToIgnoreResistance', label: 'Xuyên kháng tuyệt đối', description: 'Xác suất 1 đòn bỏ qua HOÀN TOÀN Giáp/Kháng của đối phương.', category: 'special' },
  { key: 'elementApplicationPercent', label: 'Tỉ lệ áp Nguyên Tố', description: 'Nhân với tỉ lệ áp dị thường (Thiêu Đốt...) của skill khi đánh trúng (vd: +10% trên gốc 15% → 16.5%).', category: 'special' },
  { key: 'reactionEffectPercent', label: 'Hiệu Ứng Phản Ứng', description: 'Tăng % sát thương khi Phản Ứng Nguyên Tố kích hoạt.', category: 'special' },
  { key: 'ailmentDurationPercent', label: 'Thời Lượng Dị Thường', description: 'Tăng % thời lượng mọi dị thường mình gây ra.', category: 'special' },
  { key: 'dotResistancePercent', label: 'Kháng DoT', description: 'Giảm thẳng % sát thương nhận từ mọi hiệu ứng DoT (Bỏng/Trúng Độc/Chảy Máu...).', category: 'defense_advanced' },

  { key: 'strength', label: 'Căn Cốt', description: 'Cộng thẳng Sức mạnh + Phòng ngự.', category: 'attribute' },
  { key: 'dexterity', label: 'Thân Pháp', description: 'Cộng Độ chính xác, Tỉ lệ né và Tỉ lệ bạo kích.', category: 'attribute' },
  { key: 'intelligence', label: 'Thần Thức', description: 'Cộng Kháng dị thường, Uy lực dị thường và ST bạo kích.', category: 'attribute' },
  { key: 'attunement', label: 'Linh Căn', description: 'Cộng đều Power cả 6 hành (Ngũ Hành + Hỗn Nguyên).', category: 'attribute' },
  { key: 'vitality', label: 'Thể Chất', description: 'Cộng Khí huyết tối đa, Hồi khí huyết, Ngưỡng Kiên Cường.', category: 'attribute' },

  { key: 'blockChance', label: 'Tỉ lệ đỡ đòn', description: 'Xác suất đỡ được 1 đòn, giảm sát thương theo Hiệu Quả Đỡ Đòn.', category: 'defense_advanced' },
  { key: 'blockEffectiveness', label: 'Hiệu quả đỡ đòn', description: 'Giảm bao nhiêu % sát thương khi đỡ đòn thành công.', category: 'defense_advanced' },
  { key: 'enduranceThreshold', label: 'Ngưỡng Kiên Cường', description: 'Đòn có sát thương ≤ ngưỡng này bị giảm mạnh theo % Kiên Cường — đòn to hơn chỉ bị trừ 1 lượng cố định.', category: 'defense_advanced' },
  { key: 'endurancePercent', label: '% Kiên Cường', description: 'Mức giảm sát thương áp dụng cho đòn nhỏ (xem Ngưỡng Kiên Cường).', category: 'defense_advanced' },
  { key: 'wardMax', label: 'Hộ Thuẫn tối đa', description: 'Máu phụ hấp thụ sát thương trước Khí huyết — tự hồi khi không bị đánh trúng 1 lúc.', category: 'defense_advanced' },
  // Phap Tu Reimagined (F13): 'Linh luc ho the' is the reimagine's
  // DR mechanic name -- manaShieldPercent (the damage->mana shield)
  // keeps a distinct label.
  { key: 'manaShieldPercent', label: 'Khiên linh lực', description: 'Tỉ lệ sát thương được chuyển sang tiêu hao Linh lực.', category: 'defense_advanced' },
  { key: 'linhLucHoTheCap', label: 'Linh lực hộ thể', description: 'Trần giảm sát thương trực tiếp, tỉ lệ theo Linh lực hiện tại — cạn Linh lực thì không còn giảm.', category: 'defense_advanced' },
  { key: 'wardRegenPerTurn', label: 'Hồi Hộ Thuẫn', description: 'Hộ Thuẫn hồi mỗi lượt (sau khi không bị đánh trúng đủ lâu).', category: 'defense_advanced' },
  { key: 'wardBreakDamagePercent', label: 'Khiên Nổ', description: 'Khi Hộ Thuẫn vừa vỡ hẳn, phản % dung lượng Hộ Thuẫn tối đa thành sát thương vào kẻ tấn công.', category: 'defense_advanced' },
  { key: 'leechPercent', label: 'Hút máu', description: 'Hồi máu theo % sát thương gây ra.', category: 'defense_advanced' },
  { key: 'healingEffectivenessPercent', label: 'Hiệu quả hồi phục', description: 'Tăng % máu hồi được từ hồi phục tự nhiên, skill hồi máu và hiệu ứng hồi phục có sẵn — không ảnh hưởng Hút máu.', category: 'defense_advanced' },
  // The Tu An reactive chances (spec 2026-09-15 section 3.2).
  { key: 'counterChance', label: 'Tỉ lệ phản kích', description: 'Xác suất phản đòn khi bị đánh trúng — chỉ từ thuộc tính (Thể Tu Ẩn).', category: 'defense_advanced' },
  { key: 'protectChance', label: 'Tỉ lệ hộ thể', description: 'Xác suất chặn đòn thay đồng đội — chỉ từ thuộc tính (Thể Tu Ẩn).', category: 'defense_advanced' },
  { key: 'followUpChance', label: 'Tỉ lệ truy kích', description: 'Xác suất đánh theo sau đòn của đồng đội — chỉ từ thuộc tính (Thể Tu Ẩn).', category: 'defense_advanced' },
  // generic thorns stat retired (spec 2026-09-15 T12).
  { key: 'ailmentResistPercent', label: 'Kháng dị thường', description: 'Giảm % thời lượng mọi hiệu ứng dị thường (DoT/khống chế) nhận vào.', category: 'defense_advanced' },
  { key: 'ailmentPotencyPercent', label: 'Uy lực dị thường', description: 'Tăng % hiệu lực (sát thương/giây) của dị thường mình gây ra.', category: 'defense_advanced' },
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
  affixDeltaPercent: 'Tăng Trưởng Affix',
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
