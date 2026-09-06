// Cờ test tạm thời (2026-08-20) — bật để bỏ qua MỌI gate Building/cảnh
// giới, cho phép thử toàn bộ hệ thống trong game mà không cần grind thật.
//
// 2026-08-26 — đổi sang OVERRIDE qua localStorage thay vì hằng số compile-
// time: người chơi/lead cần BẬT TẮT nhanh khi test chức năng building
// (xây miễn phí mọi công trình) mà không phải build lại. Cách bật:
//   localStorage.setItem('dev.testModeUnlockAll', '1')  → reload trang
// Tắt: removeItem('dev.testModeUnlockAll') hoặc set giá trị khác '1'.
// Mặc định FALSE cho bản chạy thực tế.
//
// 2026-08-28 (review 2026-08-28 bug #11) — cờ này CHỈ còn hiệu lực trong
// dev build: production build mà đọc được flag từ localStorage sẽ bypass
// realm gate + chi phí vật liệu, xây mọi công trình miễn phí.

export function isTestModeUnlockAll(): boolean {
  if (!import.meta.env.DEV) {
    return false
  }

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem('dev.testModeUnlockAll') === '1'
  } catch {
    return false
  }
}

// Art test mode (2026-09-06) — tắt CSS trang trí (background/border/
// box-shadow/text-shadow/outline) trên MỌI component qua 1 class gốc
// (xem assets/artTestMode.css), GIỮ NGUYÊN layout (width/height/flex/
// grid/position không đụng tới) để lắp art thật vào xem đúng khung có
// sẵn mà không bị style cũ đè/che. Bật:
//   localStorage.setItem('dev.artTestMode', '1')  → reload trang
// Tắt: removeItem('dev.artTestMode') hoặc set giá trị khác '1'.
export function isArtTestMode(): boolean {
  if (!import.meta.env.DEV) {
    return false
  }

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem('dev.artTestMode') === '1'
  } catch {
    return false
  }
}
