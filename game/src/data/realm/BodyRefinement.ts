import type { StatType } from '../../core/stats/StatTypes'

// Currency Luyện Thể — xem data/materials/materials.ts (định nghĩa
// Material) và data/enemy/Enemies.ts (nguồn rơi, 20 quái Phàm Nhân).
export const TINH_HOA_PHAM_THE_MATERIAL_ID = 'tinh_hoa_pham_the'

// Luyện Thể (Realm Passive & Pressure System, 2026-08-20) — 6 tầng rèn
// the TUAN TU, doc quyen Pham Nhan (xem core/realm/body/BodyRefinementChapter.ts).
// Mỗi tầng ứng với ĐÚNG 1 (hoặc 2, tầng cuối) StatType theo tài liệu
// Plan gốc — số liệu (cap/baseGains) là first pass, cần tinh chỉnh qua
// playtest giống mọi hằng số cân bằng khác trong codebase.
export interface BodyRefinementTierDefinition {
  id: string

  name: string

  description: string

  // Tinh Hoa Phàm Thể cần để làm ĐẦY tầng này (tuần tự — phải làm đầy
  // tang truoc moi duoc dau tu vao tang sau, xem BodyRefinementChapter.ts).
  cap: number

  // P7-M-F (D1) — FLAT base-stat gain per stat when the tier is FULL
  // (scale tuyến tính theo progress/cap luc CHUA day — xem
  // body/BodyRefinementChapter.collectBaseStatDeltas()). Body Refinement
  // contributes BASE STATS (assembledBase), not percent modifiers:
  // Luyện Mạch needs per-stat values because maxHp and hpRegenPerTurn
  // are different units.
  baseGains: Partial<Record<StatType, number>>

  // Phàm Nhân tầng tối thiểu để BẮT ĐẦU đầu tư tầng này (2026-08-20,
  // yêu cầu cụ thể: Bì/Nhục/Cốt/Huyết/Tạng/Mạch mở lần lượt ở tầng
  // 2/4/6/8/10/12) — ĐỘC LẬP với thứ tự tuần tự (phải làm đầy tầng
  // truoc MOI toi luot tang nay, xem body/BodyRefinementChapter.invest());
  // cả 2 điều kiện đều phải thoả. Tầng cuối (Luyện Mạch) mở cùng cửa
  // sổ Quán Khí (tầng 12 trở đi, xem TribulationOutcomeService)
  // — cố ý, chừa tầng 12-18 làm cửa sổ hoàn thiện trước khi Quán Khí.
  requiredRealmLevel: number
}

// Typed-key seam (M-F spec §3.5): the single narrow from
// Partial<Record<StatType, number>> keys to StatType[] - consumers
// (chapter delta collector, panel labels) never ad-hoc cast.
export function baseGainKeys(gains: Partial<Record<StatType, number>>): StatType[] {
  return Object.keys(gains) as StatType[]
}

// Caps cấp số nhân (spec dot-pha-loi-kiep §3.1 — hệ số ×3.5/tầng
// first-pass: 50/175/615/2150/7500/26300; đối chiếu tổng nguồn Tinh
// Hoa farm được trong 18 tầng Phàm Nhân khi playtest).
export const BODY_REFINEMENT_TIERS: BodyRefinementTierDefinition[] = [
  {
    id: 'luyen_bi',
    name: 'Luyện Bì',
    description: 'Rèn luyện lớp da và khả năng chịu đựng bên ngoài.',
    cap: 50,
    baseGains: { defense: 4 }, // P7-M-F PLACEHOLDER — pending dedicated balance phase
    requiredRealmLevel: 2,
  },
  {
    id: 'luyen_nhuc',
    name: 'Luyện Nhục',
    description: 'Rèn cơ nhục.',
    cap: 175,
    baseGains: { might: 5 }, // P7-M-F PLACEHOLDER — pending dedicated balance phase
    requiredRealmLevel: 4,
  },
  {
    id: 'luyen_cot',
    name: 'Luyện Cốt',
    description: 'Rèn xương và nền tảng thân thể.',
    cap: 615,
    baseGains: { maxHp: 40 }, // P7-M-F PLACEHOLDER — pending dedicated balance phase
    requiredRealmLevel: 6,
  },
  {
    id: 'luyen_huyet',
    name: 'Luyện Huyết',
    description: 'Rèn khí huyết.',
    cap: 2150,
    baseGains: { hpRegenPerTurn: 1.5 }, // P7-M-F PLACEHOLDER — pending dedicated balance phase
    requiredRealmLevel: 8,
  },
  {
    id: 'luyen_tang',
    name: 'Luyện Tạng',
    description: 'Rèn lục phủ ngũ tạng.',
    cap: 7500,
    // "Damage Reduction / Vitality" (tài liệu mục III.5) — dùng
    // vitality (Thể Chất, tầng Attribute gốc) thay vì 1 stat mitigation
    // trực tiếp: đi qua đúng pipeline deriveAttributeModifiers() sẵn có
    // (StatCalculator.ts), tự dẫn ra maxHp/hpRegen/enduranceThreshold.
    baseGains: { vitality: 2 }, // P7-M-F PLACEHOLDER — pending dedicated balance phase
    requiredRealmLevel: 10,
  },
  {
    id: 'luyen_mach',
    name: 'Luyện Mạch',
    description: 'Khai thông kinh mạch — chuẩn bị Nhập Đạo.',
    cap: 26300,
    baseGains: { maxHp: 60, hpRegenPerTurn: 2 }, // P7-M-F PLACEHOLDER — pending dedicated balance phase
    requiredRealmLevel: 12,
  },
]
