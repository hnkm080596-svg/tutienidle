// Endurance kieu Last Epoch - don NHO (<= threshold) bi giam han
// `percent`%, don TO (> threshold) chi bi tru 1 luong CO DINH
// (threshold * percent) - mo phong dung cam giac "endurance chong do
// tot don lat vat nhung don chi mang van xuyen qua phan lon".
export function applyEndurance(damage: number, threshold: number, percent: number): number {
  if (threshold <= 0 || percent <= 0) {
    return damage
  }

  if (damage <= threshold) {
    return damage * (1 - percent)
  }

  return damage - threshold * percent
}
