// Accuracy vs Evasion - kieu Last Epoch: 2 rating dau nhau thay vi ne
// don phuong (evasionRate cu la xac suat 0..1, gio la rating mo).
// San 5% de khong bao gio "chac chan truot" du evasion cuc cao.
const MIN_HIT_CHANCE = 0.05

export function getHitChance(accuracy: number, evasion: number): number {
  // Guard NaN/am - accuracy = 0 VA evasion <= 0 cho 0/0 = NaN, lan thanh
  // Math.random() < NaN = luon truot (moi don danh miss). Input khong huu
  // han coi nhu 0; ca 2 rating cung 0 (khong co gi contest) thi don trung.
  const safeAccuracy = Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0
  const safeEvasion = Number.isFinite(evasion) ? Math.max(0, evasion) : 0
  const denominator = safeAccuracy + safeEvasion
  const raw = denominator <= 0 ? 1 : safeAccuracy / denominator

  return Math.min(1, Math.max(MIN_HIT_CHANCE, raw))
}
