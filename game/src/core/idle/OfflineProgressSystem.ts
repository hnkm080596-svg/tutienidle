export interface OfflineResult {
  elapsedSeconds: number
  cultivation: number
}

/**
 * Quy doi thoi gian offline (da duoc GameClock tinh va clamp san)
 * thanh tu vi nhan duoc.
 *
 * KHONG tu tinh elapsed time o day - offlineSeconds phai lay tu
 * GameClock.calculateOfflineTime() (hoac ham thuan cung ten trong
 * core/idle/GameClock.ts) de toan bo game chi co mot nguon tinh
 * thoi gian offline duy nhat.
 */
export function calculateOfflineProgress(
  offlineSeconds: number,
  cultivationPerSecond: number,
): OfflineResult {
  const elapsedSeconds = Math.max(0, offlineSeconds)

  return {
    elapsedSeconds,

    // QA-007 belt-and-suspenders - save validator (v55) da chan NaN/+/-Infinity
    // cultivationPerSecond o boot; guard nay bao ve consumer hien tai + future
    // caller khoi gia tri non-finite tu path khac. NaN * n = NaN, va clamp
    // Math.min(NaN, x) = NaN o player.ts khong chua duoc - chan o nguon.
    cultivation: Number.isFinite(cultivationPerSecond)
      ? cultivationPerSecond * elapsedSeconds
      : 0,
  }
}