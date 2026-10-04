// Util toan hoc dung chung cho core - tach khoi cac ban clamp() trung
// lap truoc day trong BodyRefinementChapter / Resistance / RealmPressure.
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
