// Cầu nối kích thước giữa DOM chrome (CombatSceneOverlay.vue) và Phaser
// (CombatScene.ts) — WS1 Responsive foundation (2026-08-24).
//
// Nguồn chân lý: đo chiều cao render THẬT của bar DOM rồi cấp xuống
// scene qua setCombatInsets(). Module plain-TS (không import Vue) để
// scene dùng an toàn theo đúng luật phân tầng core↔view.
//
// 6A-T3 (2026-09-01) — TOP-ONLY: 3 bar dưới (Status/Event/Control) rời
// DOM để vào canvas (PlayerHudLayer T4) — bottom inset LUÔN 0; interface
// giữ trường bottom cho tương thích call-site, giá trị bị ép 0.
// Fallback: trước lần đo đầu tiên scene dùng công thức tỷ lệ top-only.
//
// Combat Art Pipeline (2026-09-05) — thêm `right`: chiều rộng thực (px)
// của skill dock panel mới bám mép phải màn hình (spec §7.5). Cùng pattern
// đo-DOM-thật với `top` — KHÔNG suy từ tỉ lệ trừ khi chưa đo được lần nào.
export interface CombatInsets {
  /** Chiều cao thực (px) của Top Bar phía trên. */
  top: number

  /** LUÔN 0 từ 6A — chỉ giữ cho tương thích call-site. */
  bottom: number

  /** Chiều rộng thực (px) của skill dock panel bám mép phải. */
  right: number
}

interface MeasuredCombatInsets extends CombatInsets {
  /** false khi chưa từng có phép đo nào (dùng fallback tỷ lệ). */
  measured: boolean
}

const current: MeasuredCombatInsets = { top: 0, bottom: 0, right: 0, measured: false }

export function setCombatInsets(insets: CombatInsets): void {
  current.top = Math.max(0, insets.top)
  current.bottom = 0
  current.right = Math.max(0, insets.right)
  current.measured = true
}

/** Về trạng thái chưa đo (overlay unmount) để scene dùng lại fallback tỷ lệ. */
export function resetCombatInsets(): void {
  current.top = 0
  current.bottom = 0
  current.right = 0
  current.measured = false
}

export function getCombatInsets(): MeasuredCombatInsets {
  return current
}

// Combat Art Pipeline Task 7 (2026-09-05, spec §7.5) — 2 publisher
// chuyên biệt cho kiến trúc inset 2 nguồn: CombatSceneOverlay (TopBar)
// và CombatSkillDockPanel (dock phải) mỗi bên đo/publish riêng một
// trường, KHÔNG đè trường của bên kia (setCombatInsets thô sẽ ghi đè
// cả 3 trường mỗi lần gọi). `bottom` luôn 0 từ 6A.

/** Overlay publish chiều cao TopBar đo được — giữ nguyên `right` hiện có. */
export function publishTopBarHeight(top: number): void {
  setCombatInsets({ top, bottom: 0, right: current.right })
}

/** Dock publish chiều rộng thực đo được — giữ nguyên `top` hiện có. */
export function publishSkillDockWidth(right: number): void {
  setCombatInsets({ top: current.top, bottom: 0, right })
}

/** Dock unmount — right về 0 (chưa đo) nhưng giữ `top` của TopBar. */
export function clearSkillDockWidth(): void {
  setCombatInsets({ top: current.top, bottom: 0, right: 0 })
}

// Fallback insets TỈ LỆ — chỉ dùng khi chưa đo được DOM (mounted/
// ResizeObserver chưa kịp chạy); frame thiết kế 16:9. Từ 6A bottom
// fallback = 0 (chỉ còn Top Bar phía trên).
const DESIGN_HEIGHT = 1440

const FALLBACK_TOP_BAR = 64
const FALLBACK_STATUS_BAR = 56

export function getFallbackCombatInsets(height: number): CombatInsets {
  return {
    top: (height * (FALLBACK_TOP_BAR + FALLBACK_STATUS_BAR)) / DESIGN_HEIGHT,
    bottom: 0,
    right: 0,
  }
}
