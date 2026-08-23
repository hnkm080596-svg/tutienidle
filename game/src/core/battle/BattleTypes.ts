export type BattleState =
  | 'idle'
  // Countdown 3 giây trước trận (2026-08-22) — quái đầu tiên đã spawn +
  // vị trí đã emit (xem BattleSystem.start()), nhưng movement/attack/
  // spawn-tiếp-theo bị đóng băng cho tới khi đếm về 0 (xem
  // BattleSystem.update()'s countdown branch).
  | 'countdown'
  | 'fighting'
  | 'victory'
  | 'defeat'

// Coi CẢ 'countdown' lẫn 'fighting' là "trận đang thật sự diễn ra" —
// dùng ở mọi nơi cần biết "có đang trong 1 trận" theo nghĩa rộng (ẩn UI
// Động Phủ, chặn mở Tribulation mới trong lúc đang có 1 cái đang chạy,
// không cộng tu vi passive...), khác hẳn việc kiểm tra riêng
// 'fighting' để gate combat logic thật (xem BattleSystem.update()).
// undefined (chưa có Battle nào) coi như KHÔNG đang diễn ra.
export function isBattleInProgress(state: BattleState | undefined): boolean {
  return state === 'fighting' || state === 'countdown'
}