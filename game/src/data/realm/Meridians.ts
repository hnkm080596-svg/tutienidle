import type { StatType } from '../../core/stats/StatTypes'

// Ky Kinh Bat Mach (spec dot-pha-loi-kiep sec.4.1a) - he song song Luyen
// The, doc quyen Luyen Khi. 8 duong mo moi 2 tang (2/4/.../16).
// 2026-09-23 hidden-perfection-lineage sec.19: duong thu 9 'ky_kinh_thien_
// dia_chi_kieu' (Thien Dia Chi Kieu gate) da bi RETIRE - material-
// gated 9th meridian was a legacy authority the lineage model replaces;
// HIDDEN-B owns the Quan The/Thien Dia Chi Kieu design in its own
// mechanism. Passive KHONG cham mana (mana chi thuoc Phap Tu - Global
// Constraint spec).
//
// 2026-10-10 owner rework: Khai Mach becomes PROGRESSIVE - each meridian
// holds a float progress 0..100; each invest consumes EXACTLY 1 Thong
// Mach Dan and adds a uniform random gain inside `investGainRange`
// (Math.random, capped at 100, no pity). Stats apply per 20% milestone:
// floor(progress/20) milestones grant percentAtFullTier * milestones/5
// of each stat in `stats` (full value at 100).
export const THONG_MACH_DAN_MATERIAL_ID = 'thong_mach_dan'

export interface MeridianDefinition {
  id: string
  name: string
  description: string
  /** M-E (D2): the realm that owns this meridian's PAGE. Page unlock is
   * monotonic - unlockedPageRealmIndex <= currentRealmIndex, never
   * re-locks. All current content lives on the qi_refining page. */
  pageRealmId: string
  requiredRealmLevel: number
  /** Thong Mach Dan pills consumed per invest - exactly 1 by rule. */
  thongMachDanCost: number
  stats: StatType[]
  /** Uniform random gain [min, max] in percent points added per invest
   * (floats kept), per data index: Nham 5~10, Doi 4~9, Am Kieu 3~8,
   * Am Duy 2~7, Duong Duy 1~6, Duong Kieu 1~4, Xung 1~2, Doc 0.1~1. */
  investGainRange: { min: number; max: number }
  percentAtFullTier: number
}

const QI_PAGE = 'qi_refining'

export const MERIDIANS: readonly MeridianDefinition[] = [
  { id: 'nham_mach', name: 'Nhâm Mạch', description: 'Kinh mạch chính phía trước, nền huyết khí của thân thể.', pageRealmId: QI_PAGE, requiredRealmLevel: 2, thongMachDanCost: 1, stats: ['maxHp'], investGainRange: { min: 5, max: 10 }, percentAtFullTier: 0.05 },
  { id: 'doi_mach', name: 'Đới Mạch', description: 'Đai lưng kinh mạch, ôm trọn eo thắt.', pageRealmId: QI_PAGE, requiredRealmLevel: 4, thongMachDanCost: 1, stats: ['defense'], investGainRange: { min: 4, max: 9 }, percentAtFullTier: 0.05 },
  { id: 'am_kieu_mach', name: 'Âm Kiều Mạch', description: 'Kiều đạo phía âm, dẫn huyết nuôi thân.', pageRealmId: QI_PAGE, requiredRealmLevel: 6, thongMachDanCost: 1, stats: ['hpRegenPerTurn'], investGainRange: { min: 3, max: 8 }, percentAtFullTier: 0.08 },
  { id: 'am_duy_mach', name: 'Âm Duy Mạch', description: 'Duy trì mặt âm của toàn kinh lạc.', pageRealmId: QI_PAGE, requiredRealmLevel: 8, thongMachDanCost: 1, stats: ['maxHp'], investGainRange: { min: 2, max: 7 }, percentAtFullTier: 0.05 },
  { id: 'duong_duy_mach', name: 'Dương Duy Mạch', description: 'Duy trì mặt dương của toàn kinh lạc.', pageRealmId: QI_PAGE, requiredRealmLevel: 10, thongMachDanCost: 1, stats: ['might'], investGainRange: { min: 1, max: 6 }, percentAtFullTier: 0.05 },
  { id: 'duong_kieu_mach', name: 'Dương Kiều Mạch', description: 'Kiều đạo phía dương, táo bạo uy lực tiến công.', pageRealmId: QI_PAGE, requiredRealmLevel: 12, thongMachDanCost: 1, stats: ['criticalRate'], investGainRange: { min: 1, max: 4 }, percentAtFullTier: 0.04 },
  { id: 'xung_mach', name: 'Xung Mạch', description: 'Hải huyết chi mạch — kho huyết lớn của thân.', pageRealmId: QI_PAGE, requiredRealmLevel: 14, thongMachDanCost: 1, stats: ['maxHp'], investGainRange: { min: 1, max: 2 }, percentAtFullTier: 0.08 },
  { id: 'doc_mach', name: 'Đốc Mạch', description: 'Kinh mạch chính phía sau, trụ cột của đạo.', pageRealmId: QI_PAGE, requiredRealmLevel: 16, thongMachDanCost: 1, stats: ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality'], investGainRange: { min: 0.1, max: 1 }, percentAtFullTier: 0.05 },
]
