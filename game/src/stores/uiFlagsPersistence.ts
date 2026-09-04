// Ui automation flags persistence (2026-08-26) — người chơi yêu cầu
// "lưu lại flag của các trạng thái tự động" (chế độ auto-refight) nên
// chúng SỐNG qua reload. (2026-08-30) isAutoConsumeTinhHoa đã GỠ — Luyện
// Thể tự đầu tư qua essence stream nên không còn là tuỳ chọn người chơi.
//
// Lựa chọn storage: localStorage RIÊNG thay vì PlayerData/save chính vì
// đây là tuỳ chọn THIẾT BỊ (per-device convenience), không thuộc tiến
// trình nhân vật — không bump CURRENT_SAVE_VERSION, không đụng cloud
// save. Development build: hỏng/quota → fallback giá trị mặc định, không
// throw.

import type { BattleRunMode, CombatInputMode } from './ui'

export const UI_AUTOMATION_STORAGE_KEY = 'tien-hiep-idle-ui-automation'

/** Nhóm flag tự động được lưu — CHỈ gồm các trạng thái có ý nghĩa dài hạn. */
export interface UiAutomationFlagSnapshot {
  /** Chế độ auto-refight đang chọn ở Stage Select (manual/repeat/progress). */
  battleRunMode: BattleRunMode

  /** Slice 7 (2026-09-04) — chế độ input combat (auto = engine không pause; manual = pause chờ chọn skill tại lượt player). Trục RIÊNG khỏi battleRunMode. */
  combatInputMode: CombatInputMode
}

const BATTLE_RUN_MODES: readonly BattleRunMode[] = ['manual', 'repeat', 'progress', 'perfect_farm']

export function isBattleRunMode(value: unknown): value is BattleRunMode {
  return typeof value === 'string' && (BATTLE_RUN_MODES as readonly string[]).includes(value)
}

const COMBAT_INPUT_MODES: readonly CombatInputMode[] = ['manual', 'auto']

export function isCombatInputMode(value: unknown): value is CombatInputMode {
  return typeof value === 'string' && (COMBAT_INPUT_MODES as readonly string[]).includes(value)
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

    if (isBattleRunMode(parsed.battleRunMode)) {
      snapshot.battleRunMode = parsed.battleRunMode
    }

    if (isCombatInputMode(parsed.combatInputMode)) {
      snapshot.combatInputMode = parsed.combatInputMode
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
