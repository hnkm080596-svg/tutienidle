// % giảm dame PHẲNG có trần (khác Armor.ts — Armor giảm dần theo
// đường cong, Resistance là % tuyến tính có trần cứng) — đúng cách
// Last Epoch phân biệt 2 trục phòng thủ Vật Lý (Armor) và Elemental
// (Resistance). Dùng cho 5 hành Hỏa/Thủy/Kim/Mộc/Thổ — mỗi hành độc
// lập, KHÔNG còn chu kỳ sinh/khắc như trước.
import { clamp } from '../math/clamp'

const RESISTANCE_CAP = 0.75

// Resistance âm (bị debuff/xuyên quá tay) khuếch đại damage, trần ở
// -100% (tối đa nhận gấp đôi) — tránh chia cho 0/âm vô hạn.
const RESISTANCE_FLOOR = -1.0

/**
 * 1 điểm resistance ròng (resistance - penetration) = 1% giảm dame —
 * giữ nguyên thang đo dữ liệu hiện có (enemy resistance 5-45 hôm nay
 * vẫn có ý nghĩa tương tự, không cần rescale lại toàn bộ Enemies.ts).
 */
export function getResistanceMitigationPercent(resistance: number, penetration: number): number {
  const net = resistance - penetration

  return clamp(net / 100, RESISTANCE_FLOOR, RESISTANCE_CAP)
}
