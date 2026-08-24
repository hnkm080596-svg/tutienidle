// Util toán học dùng chung cho core — tách khỏi các bản clamp() trùng
// lặp trước đây trong BodyRefinementSystem / Resistance / RealmPressure.
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
