// Util toán học dùng chung cho core — tách khỏi các bản clamp() trùng
// lap truoc day trong BodyRefinementChapter / Resistance / RealmPressure.
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
