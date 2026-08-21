// Accuracy vs Evasion — kiểu Last Epoch: 2 rating đấu nhau thay vì né
// đơn phương (evasionRate cũ là xác suất 0..1, giờ là rating mở).
// Sàn 5% để không bao giờ "chắc chắn trượt" dù evasion cực cao.
const MIN_HIT_CHANCE = 0.05

export function getHitChance(accuracy: number, evasion: number): number {
  const raw = accuracy / (accuracy + Math.max(0, evasion))

  return Math.min(1, Math.max(MIN_HIT_CHANCE, raw))
}
