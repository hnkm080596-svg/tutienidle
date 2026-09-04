import type { StatType } from '../../core/stats/StatTypes'

// Kỳ Kinh Bát Mạch (spec dot-pha-loi-kiep §4.1a) — hệ song song Luyện
// Thể, độc quyền Luyện Khí. 8 đường mở mỗi 2 tầng (2/4/.../16), Kỳ
// Kinh Thiên Địa Chi Kiều mở tầng 18. Passive KHÔNG chạm mana (mana
// chỉ thuộc Pháp Tu — Global Constraint spec).
export const THONG_MACH_DAN_MATERIAL_ID = 'thong_mach_dan'
export const THIEN_DIA_CHI_KIEU_MATERIAL_ID = 'thien_dia_chi_kieu'

export interface MeridianDefinition {
  id: string
  name: string
  description: string
  requiredRealmLevel: number
  thongMachDanCost: number
  requiresThienDiaChiKieu?: boolean
  stats: StatType[]
  percentAtFullTier: number
}

export const MERIDIANS: readonly MeridianDefinition[] = [
  { id: 'nham_mach', name: 'Nhâm Mạch', description: 'Kinh mạch chính phía trước, nền huyết khí của thân thể.', requiredRealmLevel: 2, thongMachDanCost: 1, stats: ['maxHp'], percentAtFullTier: 0.05 },
  { id: 'doi_mach', name: 'Đới Mạch', description: 'Đai lưng kinh mạch, ôm trọn eo thắt.', requiredRealmLevel: 4, thongMachDanCost: 2, stats: ['defense'], percentAtFullTier: 0.05 },
  { id: 'am_kieu_mach', name: 'Âm Kiều Mạch', description: 'Kiều đạo phía âm, dẫn huyết nuôi thân.', requiredRealmLevel: 6, thongMachDanCost: 4, stats: ['hpRegenPerTurn'], percentAtFullTier: 0.08 },
  { id: 'am_duy_mach', name: 'Âm Duy Mạch', description: 'Duy trì mặt âm của toàn kinh lạc.', requiredRealmLevel: 8, thongMachDanCost: 7, stats: ['maxHp'], percentAtFullTier: 0.05 },
  { id: 'duong_duy_mach', name: 'Dương Duy Mạch', description: 'Duy trì mặt dương của toàn kinh lạc.', requiredRealmLevel: 10, thongMachDanCost: 11, stats: ['attack'], percentAtFullTier: 0.05 },
  { id: 'duong_kieu_mach', name: 'Dương Kiều Mạch', description: 'Kiều đạo phía dương, táo bạo uy lực tiến công.', requiredRealmLevel: 12, thongMachDanCost: 16, stats: ['criticalRate'], percentAtFullTier: 0.04 },
  { id: 'xung_mach', name: 'Xung Mạch', description: 'Hải huyết chi mạch — kho huyết lớn của thân.', requiredRealmLevel: 14, thongMachDanCost: 22, stats: ['maxHp'], percentAtFullTier: 0.08 },
  { id: 'doc_mach', name: 'Đốc Mạch', description: 'Kinh mạch chính phía sau, trụ cột của đạo.', requiredRealmLevel: 16, thongMachDanCost: 30, stats: ['strength', 'dexterity', 'intelligence', 'attunement', 'vitality'], percentAtFullTier: 0.05 },
  { id: 'ky_kinh_thien_dia_chi_kieu', name: 'Kỳ Kinh — Thiên Địa Chi Kiều', description: 'Cửa kiều nối trời đất, đỉnh của bát mạch.', requiredRealmLevel: 18, thongMachDanCost: 40, requiresThienDiaChiKieu: true, stats: ['maxHp', 'hpRegenPerTurn'], percentAtFullTier: 0.1 },
]
