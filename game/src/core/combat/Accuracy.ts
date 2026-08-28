// Accuracy vs Evasion — kiểu Last Epoch: 2 rating đấu nhau thay vì né
// đơn phương (evasionRate cũ là xác suất 0..1, giờ là rating mở).
// Sàn 5% để không bao giờ "chắc chắn trượt" dù evasion cực cao.
const MIN_HIT_CHANCE = 0.05

export function getHitChance(accuracy: number, evasion: number): number {
  // Guard NaN/âm — accuracy = 0 VÀ evasion <= 0 cho 0/0 = NaN, lan thành
  // Math.random() < NaN = luôn trượt (mọi đòn đánh miss). Input không hữu
  // hạn coi như 0; cả 2 rating cùng 0 (không có gì contest) thì đòn trúng.
  const safeAccuracy = Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0
  const safeEvasion = Number.isFinite(evasion) ? Math.max(0, evasion) : 0
  const denominator = safeAccuracy + safeEvasion
  const raw = denominator <= 0 ? 1 : safeAccuracy / denominator

  return Math.min(1, Math.max(MIN_HIT_CHANCE, raw))
}
