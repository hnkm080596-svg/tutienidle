// Migration gate 2.5D (2026-08-24) — feature flag chọn renderer chiến
// trường:
// - 'perspective': renderer 2.5D mới (mặt phẳng nghiêng, foot anchor,
//   depth sort, VFX theo space — xem BattleGridProjection.ts).
// - 'flat'       : renderer top-down vuông CŨ giữ nguyên từng pixel
//   (cellSize đồng đều, letterbox) để rollback tức thì nếu gate chưa đạt.
//
// Flag đọc/ghi localStorage, KHÔNG đụng gameplay: core vẫn làm việc thuần
// row/column qua BattleGrid — chỉ lớp PRESENTATION đổi cách chiếu lên màn
// hình. Đổi mode có hiệu lực ở lần create() kế tiếp của CombatScene
// (đổi scene Home <-> Combat là đủ, không cần reload app).
export type BattlefieldRenderMode = 'flat' | 'perspective'

const STORAGE_KEY = 'tutienidle.battlefieldRenderMode'

// Mặc định bật renderer mới; 'flat' chỉ còn là lối tho hiểm khi gate
// (screenshot parity / hover cell / AOE footprint / depth ổn định / e2e)
// báo lỗi.
const DEFAULT_MODE: BattlefieldRenderMode = 'perspective'

function isRenderMode(value: unknown): value is BattlefieldRenderMode {
  return value === 'flat' || value === 'perspective'
}

export function getBattlefieldRenderMode(): BattlefieldRenderMode {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_MODE
    }

    const raw = localStorage.getItem(STORAGE_KEY)

    return isRenderMode(raw) ? raw : DEFAULT_MODE
  } catch {
    // localStorage có thể bị chặn (privacy mode/electron profile) — rơi
    // về default thay vì làm vỡ boot flow.
    return DEFAULT_MODE
  }
}

export function setBattlefieldRenderMode(mode: BattlefieldRenderMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode)
    }
  } catch {
    // No-op — flag là tiện ích QA/dev, không đáng để vỡ game vì storage lỗi.
  }
}
