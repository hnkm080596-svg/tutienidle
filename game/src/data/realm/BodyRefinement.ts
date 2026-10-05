import type { StatType } from '../../core/stats/StatTypes'

// Currency Luyen The - xem data/materials/materials.ts (dinh nghia
// Material) va data/enemy/Enemies.ts (nguon roi, 20 quai Pham Nhan).
export const TINH_HOA_PHAM_THE_MATERIAL_ID = 'tinh_hoa_pham_the'

// Luyen The (Realm Passive & Pressure System, 2026-08-20) - 6 tang ren
// the TUAN TU, doc quyen Pham Nhan (xem core/realm/body/BodyRefinementChapter.ts).
// Moi tang ung voi DUNG 1 (hoac 2, tang cuoi) StatType theo tai lieu
// Original plan - the numbers (cap/baseGains) are a first pass, to be tuned in
// playtest giong moi hang so can bang khac trong codebase.
export interface BodyRefinementTierDefinition {
  id: string

  name: string

  description: string

  // Tinh Hoa Pham The can de lam DAY tang nay (tuan tu - phai lam day
  // tang truoc moi duoc dau tu vao tang sau, xem BodyRefinementChapter.ts).
  cap: number

  // P7-M-F (D1) - FLAT base-stat gain per stat when the tier is FULL
  // (scale tuyen tinh theo progress/cap luc CHUA day - xem
  // body/BodyRefinementChapter.collectBaseStatDeltas()). Body Refinement
  // contributes BASE STATS (assembledBase), not percent modifiers:
  // Luyen Mach needs per-stat values because maxHp and hpRegenPerTurn
  // are different units.
  baseGains: Partial<Record<StatType, number>>

  // Pham Nhan tang toi thieu de BAT DAU dau tu tang nay (2026-08-20,
  // yeu cau cu the: Bi/Nhuc/Cot/Huyet/Tang/Mach mo lan luot o tang
  // 2/4/6/8/10/12) - DOC LAP voi thu tu tuan tu (phai lam day tang
  // truoc MOI toi luot tang nay, xem body/BodyRefinementChapter.invest());
  // ca 2 dieu kien deu phai thoa. Tang cuoi (Luyen Mach) mo cung cua
  // so Quan Khi (tang 12 tro di, xem TribulationOutcomeService)
  // - co y, chua tang 12-18 lam cua so hoan thien truoc khi Quan Khi.
  requiredRealmLevel: number
}

// Typed-key seam (M-F spec sec.3.5): the single narrow from
// Partial<Record<StatType, number>> keys to StatType[] - consumers
// (chapter delta collector, panel labels) never ad-hoc cast.
export function baseGainKeys(gains: Partial<Record<StatType, number>>): StatType[] {
  return Object.keys(gains) as StatType[]
}

// Caps cap so nhan (spec dot-pha-loi-kiep sec3.1 - he so x3.5/tang
// first-pass: 50/175/615/2150/7500/26300; doi chieu tong nguon Tinh
// Hoa farm duoc trong 18 tang Pham Nhan khi playtest).
// balance-review 2026-10-04 (progression-review C2.5): full 6-tier
// Thien Kien Co needed 36,790 pham-eq (~6.5k Truc Co kills) - past the
// whole beta arc. Tiers 5-6 drop to 2500/8000 (total 13,490) so the
// top grade is a long grind, not unreachable.
export const BODY_REFINEMENT_TIERS: BodyRefinementTierDefinition[] = [
  {
    id: 'luyen_bi',
    name: 'Luyện Bì',
    description: 'Rèn luyện lớp da và khả năng chịu đựng bên ngoài.',
    cap: 50,
    baseGains: { defense: 4 }, // P7-M-F PLACEHOLDER - pending dedicated balance phase
    requiredRealmLevel: 2,
  },
  {
    id: 'luyen_nhuc',
    name: 'Luyện Nhục',
    description: 'Rèn cơ nhục.',
    cap: 175,
    baseGains: { might: 5 }, // P7-M-F PLACEHOLDER - pending dedicated balance phase
    requiredRealmLevel: 4,
  },
  {
    id: 'luyen_cot',
    name: 'Luyện Cốt',
    description: 'Rèn xương và nền tảng thân thể.',
    cap: 615,
    baseGains: { maxHp: 40 }, // P7-M-F PLACEHOLDER - pending dedicated balance phase
    requiredRealmLevel: 6,
  },
  {
    id: 'luyen_huyet',
    name: 'Luyện Huyết',
    description: 'Rèn khí huyết.',
    cap: 2150,
    baseGains: { hpRegenPerTurn: 1.5 }, // P7-M-F PLACEHOLDER - pending dedicated balance phase
    requiredRealmLevel: 8,
  },
  {
    id: 'luyen_tang',
    name: 'Luyện Tạng',
    description: 'Rèn lục phủ ngũ tạng.',
    cap: 2500,
    // "Damage Reduction / Vitality" (tai lieu muc III.5) - dung
    // vitality (The Chat, tang Attribute goc) thay vi 1 stat mitigation
    // truc tiep: di qua dung pipeline deriveAttributeModifiers() san co
    // (StatCalculator.ts), tu dan ra maxHp/hpRegen/enduranceThreshold.
    baseGains: { vitality: 2 }, // P7-M-F PLACEHOLDER - pending dedicated balance phase
    requiredRealmLevel: 10,
  },
  {
    id: 'luyen_mach',
    name: 'Luyện Mạch',
    description: 'Khai thông kinh mạch — chuẩn bị Nhập Đạo.',
    cap: 8000,
    baseGains: { maxHp: 60, hpRegenPerTurn: 2 }, // P7-M-F PLACEHOLDER - pending dedicated balance phase
    requiredRealmLevel: 12,
  },
]
