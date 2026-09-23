import type { StatType } from '../../core/stats/StatTypes'

// Ky Kinh Bat Mach (spec dot-pha-loi-kiep sec.4.1a) - he song song Luyen
// The, doc quyen Luyen Khi. 8 duong mo moi 2 tang (2/4/.../16).
// 2026-09-23 hidden-perfection-lineage sec.19: duong thu 9 'ky_kinh_thien_
// dia_chi_kieu' (Thien Dia Chi Kieu gate) da bi RETIRE - material-
// gated 9th meridian was a legacy authority the lineage model replaces;
// HIDDEN-B owns the Quan The/Thien Dia Chi Kieu design in its own
// mechanism. Passive KHONG cham mana (mana chi thuoc Phap Tu - Global
// Constraint spec).
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
  thongMachDanCost: number
  stats: StatType[]
  percentAtFullTier: number
}

const QI_PAGE = 'qi_refining'

export const MERIDIANS: readonly MeridianDefinition[] = [
  { id: 'nham_mach', name: 'Nhâm Mạch', description: 'Kinh mạch chính phía trước, nền huyết khí của thân thể.', pageRealmId: QI_PAGE, requiredRealmLevel: 2, thongMachDanCost: 1, stats: ['maxHp'], percentAtFullTier: 0.05 },
  { id: 'doi_mach', name: 'Đới Mạch', description: 'Đai lưng kinh mạch, ôm trọn eo thắt.', pageRealmId: QI_PAGE, requiredRealmLevel: 4, thongMachDanCost: 2, stats: ['defense'], percentAtFullTier: 0.05 },
  { id: 'am_kieu_mach', name: 'Âm Kiều Mạch', description: 'Kiều đạo phía âm, dẫn huyết nuôi thân.', pageRealmId: QI_PAGE, requiredRealmLevel: 6, thongMachDanCost: 4, stats: ['hpRegenPerTurn'], percentAtFullTier: 0.08 },
  { id: 'am_duy_mach', name: 'Âm Duy Mạch', description: 'Duy trì mặt âm của toàn kinh lạc.', pageRealmId: QI_PAGE, requiredRealmLevel: 8, thongMachDanCost: 7, stats: ['maxHp'], percentAtFullTier: 0.05 },
  { id: 'duong_duy_mach', name: 'Dương Duy Mạch', description: 'Duy trì mặt dương của toàn kinh lạc.', pageRealmId: QI_PAGE, requiredRealmLevel: 10, thongMachDanCost: 11, stats: ['might'], percentAtFullTier: 0.05 },
  { id: 'duong_kieu_mach', name: 'Dương Kiều Mạch', description: 'Kiều đạo phía dương, táo bạo uy lực tiến công.', pageRealmId: QI_PAGE, requiredRealmLevel: 12, thongMachDanCost: 16, stats: ['criticalRate'], percentAtFullTier: 0.04 },
  { id: 'xung_mach', name: 'Xung Mạch', description: 'Hải huyết chi mạch — kho huyết lớn của thân.', pageRealmId: QI_PAGE, requiredRealmLevel: 14, thongMachDanCost: 22, stats: ['maxHp'], percentAtFullTier: 0.08 },
  { id: 'doc_mach', name: 'Đốc Mạch', description: 'Kinh mạch chính phía sau, trụ cột của đạo.', pageRealmId: QI_PAGE, requiredRealmLevel: 16, thongMachDanCost: 30, stats: ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality'], percentAtFullTier: 0.05 },
]
