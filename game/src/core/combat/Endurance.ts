// Endurance kiểu Last Epoch — đòn NHỎ (≤ threshold) bị giảm hẳn
// `percent`%, đòn TO (> threshold) chỉ bị trừ 1 lượng CỐ ĐỊNH
// (threshold * percent) — mô phỏng đúng cảm giác "endurance chống đỡ
// tốt đòn lặt vặt nhưng đòn chí mạng vẫn xuyên qua phần lớn".
export function applyEndurance(damage: number, threshold: number, percent: number): number {
  if (threshold <= 0 || percent <= 0) {
    return damage
  }

  if (damage <= threshold) {
    return damage * (1 - percent)
  }

  return damage - threshold * percent
}
