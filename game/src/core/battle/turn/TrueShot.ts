// Turn-Based Combat Foundation (spec Phần 4) — thay Homing cũ: không còn
// là cơ chế targeting (không "xuyên tường" tìm mục tiêu ẩn), chỉ là 1 cờ
// damage bỏ qua Dodge/Evasion lúc resolve. Target vẫn phải hợp lệ theo
// luật targeting bình thường (xem AoeShape.ts / grid targeting).
export interface TrueShotFlaggable {
  ignoresEvasion?: boolean
}

export function bypassesEvasion(skill: TrueShotFlaggable): boolean {
  return skill.ignoresEvasion === true
}
