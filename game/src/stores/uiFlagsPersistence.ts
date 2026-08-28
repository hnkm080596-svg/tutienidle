// Ui automation flags persistence (2026-08-26) — người chơi yêu cầu
// "lưu lại flag của các trạng thái tự động" (tự động dùng Tinh Hoa, chế
// độ auto-refight) nên chúng SỐNG qua reload.
//
// 2026-08-28: bỏ isAutoBreakthrough (tiểu cảnh giới tự tăng không qua
// flag nữa), nhưng type vẫn giữ field để đọc an toàn từ localStorage cũ.
//
// Lựa chọn storage: localStorage RIÊNG thay vì PlayerData/save chính vì
// đây là tuỳ chọn THIẾT BỊ (per-device convenience), không thuộc tiến
// trình nhân vật — không bump CURRENT_SAVE_VERSION, không đụng cloud
// save. Development build: hỏng/quota → fallback giá trị mặc định, không
// throw.

import type { BattleRunMode } from './ui'

export const UI_AUTOMATION_STORAGE_KEY = 'tien-hiep-idle-ui-automation'

/** Nhóm flag tự động được lưu — CHỈ gồm các trạng thái có ý nghĩa dài hạn. */
export interface UiAutomationFlagSnapshot {
  /** Deprecated (2026-08-28) — tiểu cảnh giới tự tăng, không còn flag.
   *  Vẫn đọc từ localStorage cũ để không crash save, bị bỏ qua runtime. */
  isAutoBreakthrough?: boolean

  /** Tự tiêu Tinh Hoa Phàm Thể vào Luyện Thể (LuyenThePanel). */
  isAutoConsumeTinhHoa: boolean

  /** Chế độ auto-refight đang chọn ở Stage Select (manual/repeat/progress). */
  battleRunMode: BattleRunMode
}

const BATTLE_RUN_MODES: readonly BattleRunMode[] = ['manual', 'repeat', 'progress']

export function isBattleRunMode(value: unknown): value is BattleRunMode {
  return typeof value === 'string' && (BATTLE_RUN_MODES as readonly string[]).includes(value)
}

/**
 * Đọc snapshot đã lưu — giá trị thiếu/sai kiểu bị BỎ (caller dùng
 * `?? default`), JSON hỏng trả về rỗng hoàn toàn, không bao giờ throw.
 */
export function loadPersistedUiAutomationFlags(): Partial<UiAutomationFlagSnapshot> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return {}
  }

  try {
    const raw = localStorage.getItem(UI_AUTOMATION_STORAGE_KEY)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>

    const snapshot: Partial<UiAutomationFlagSnapshot> = {}

    if (typeof parsed.isAutoBreakthrough === 'boolean') {
      snapshot.isAutoBreakthrough = parsed.isAutoBreakthrough
    }

    if (typeof parsed.isAutoConsumeTinhHoa === 'boolean') {
      snapshot.isAutoConsumeTinhHoa = parsed.isAutoConsumeTinhHoa
    }

    if (isBattleRunMode(parsed.battleRunMode)) {
      snapshot.battleRunMode = parsed.battleRunMode
    }

    return snapshot
  } catch {
    return {}
  }
}

export function savePersistedUiAutomationFlags(snapshot: UiAutomationFlagSnapshot): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(UI_AUTOMATION_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Private mode/quota exceeded — bỏ qua, flags vẫn chạy trong phiên.
  }
}
