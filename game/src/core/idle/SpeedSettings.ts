/**
 * Nhịp tick THẬT của game loop (ms giữa 2 lần gọi tick()) — CỐ ĐỊNH,
 * không còn cơ chế chọn tốc độ x1/x2/x4 (đã bỏ theo yêu cầu). Rút ngắn
 * dần: 1000ms -> 200ms -> 100ms (electron-combat-timing-smoothing-
 * plan.md mục 3) để khớp đúng BATTLE_FIXED_STEP_SECONDS=0.1 của
 * GameManager (bình thường 1 outer tick = đúng 1 battle step) — không
 * ảnh hưởng tốc độ mô phỏng (pace) vì App.vue dùng deltaSeconds THẬT đo
 * được giữa 2 lần tick, không phải hằng số cố định; interval chỉ quyết
 * định ĐỘ MỊN, không quyết định TỐC ĐỘ. Khi timer bị trễ (throttle/tab
 * ẩn), 1 outer tick vẫn có thể chứa NHIỀU fixed-step — coalescing phía
 * CombatScene (xem CombatScene.ts's applyPendingPositions()) xử lý
 * đúng trường hợp đó, không dựa vào con số 100ms này để "che" lỗi.
 */
export const TICK_INTERVAL_MS = 100
