// % giam dame PHANG co tran (khac Armor.ts - Armor giam dan theo
// duong cong, Resistance la % tuyen tinh co tran cung) - dung cach
// Last Epoch phan biet 2 truc phong thu Vat Ly (Armor) va Elemental
// (Resistance). Dung cho 5 hanh Hoa/Thuy/Kim/Moc/Tho - moi hanh doc
// lap, KHONG con chu ky sinh/khac nhu truoc.
import { clamp } from '../math/clamp'

const RESISTANCE_CAP = 0.75

// Resistance am (bi debuff/xuyen qua tay) khuech dai damage, tran o
// -100% (toi da nhan gap doi) - tranh chia cho 0/am vo han.
const RESISTANCE_FLOOR = -1.0

/**
 * 1 diem resistance rong (resistance - penetration) = 1% giam dame -
 * giu nguyen thang do du lieu hien co (enemy resistance 5-45 hom nay
 * van co y nghia tuong tu, khong can rescale lai toan bo Enemies.ts).
 */
export function getResistanceMitigationPercent(resistance: number, penetration: number): number {
  const net = resistance - penetration

  return clamp(net / 100, RESISTANCE_FLOOR, RESISTANCE_CAP)
}
