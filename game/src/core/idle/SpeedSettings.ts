/**
 * Nhịp tick THẬT của game loop (ms giữa 2 lần gọi tick()) — CỐ ĐỊNH,
 * không còn cơ chế chọn tốc độ x1/x2/x4 (đã bỏ theo yêu cầu). Rút
 * ngắn xuống 200ms (so với 1000ms trước đây) để movement/timer mượt
 * hơn — không ảnh hưởng tốc độ mô phỏng (pace) vì App.vue dùng
 * deltaSeconds THẬT đo được giữa 2 lần tick, không phải hằng số cố
 * định; interval chỉ quyết định ĐỘ MỊN, không quyết định TỐC ĐỘ.
 */
export const TICK_INTERVAL_MS = 200
