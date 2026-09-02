export interface OfflineResult {
  elapsedSeconds: number
  cultivation: number
}

/**
 * Quy đổi thời gian offline (đã được GameClock tính và clamp sẵn)
 * thành tu vi nhận được.
 *
 * KHÔNG tự tính elapsed time ở đây — offlineSeconds phải lấy từ
 * GameClock.calculateOfflineTime() (hoặc hàm thuần cùng tên trong
 * core/idle/GameClock.ts) để toàn bộ game chỉ có một nguồn tính
 * thời gian offline duy nhất.
 */
export function calculateOfflineProgress(
  offlineSeconds: number,
  cultivationPerSecond: number,
): OfflineResult {
  const elapsedSeconds = Math.max(0, offlineSeconds)

  return {
    elapsedSeconds,

    // QA-007 belt-and-suspenders — save validator (v55) đã chặn NaN/±Infinity
    // cultivationPerSecond ở boot; guard này bảo vệ consumer hiện tại + future
    // caller khỏi giá trị non-finite từ path khác. NaN * n = NaN, và clamp
    // Math.min(NaN, x) = NaN ở player.ts không chứa được — chặn ở nguồn.
    cultivation: Number.isFinite(cultivationPerSecond)
      ? cultivationPerSecond * elapsedSeconds
      : 0,
  }
}