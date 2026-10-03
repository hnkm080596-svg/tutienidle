export type BattleState =
  | 'idle'
  // Intro/transition phase (2026-09-07 plan Task 4) - curtain + zone/stage
  // reveal BEFORE the countdown (turn-based flow only). Same "wait phase"
  // contract as countdown: no combat logic, battle is still in progress.
  | 'intro'
  // Countdown 3 giay truoc tran (2026-08-22) - quai dau tien da spawn +
  // vi tri da emit (xem BattleSystem.start()), nhung movement/attack/
  // spawn-tiep-theo bi dong bang cho toi khi dem ve 0 (xem
  // BattleSystem.update()'s countdown branch).
  | 'countdown'
  | 'fighting'
  | 'victory'
  | 'defeat'

// Coi CA 'countdown' lan 'fighting' la "tran dang that su dien ra" -
// dung o moi noi can biet "co dang trong 1 tran" theo nghia rong (an UI
// Dong Phu, chan mo Tribulation moi trong luc dang co 1 cai dang chay,
// khong cong tu vi passive...), khac han viec kiem tra rieng
// 'fighting' de gate combat logic that (xem BattleSystem.update()).
// undefined (chua co Battle nao) coi nhu KHONG dang dien ra.
// 'intro' (2026-09-07 plan Task 4) is a wait phase in the same sense -
// same in-progress contract as countdown.
export function isBattleInProgress(state: BattleState | undefined): boolean {
  return state === 'fighting' || state === 'countdown' || state === 'intro'
}