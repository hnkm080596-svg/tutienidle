// Cờ test tạm thời (2026-08-20) — bật để bỏ qua MỌI gate Building/cảnh
// giới, cho phép thử toàn bộ hệ thống trong game mà không cần grind thật.
//
// 2026-08-26 — đổi sang OVERRIDE qua localStorage thay vì hằng số compile-
// time: người chơi/lead cần BẬT TẮT nhanh khi test chức năng building
// (xây miễn phí mọi công trình) mà không phải build lại. Cách bật:
//   localStorage.setItem('dev.testModeUnlockAll', '1')  → reload trang
// Tắt: removeItem('dev.testModeUnlockAll') hoặc set giá trị khác '1'.
// Mặc định FALSE cho bản chạy thực tế.

export function isTestModeUnlockAll(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem('dev.testModeUnlockAll') === '1'
  } catch {
    return false
  }
}
