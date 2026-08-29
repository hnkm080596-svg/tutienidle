// Cầu nối kích thước giữa DOM chrome (CombatSceneOverlay.vue) và Phaser
// (CombatScene.ts) — WS1 Responsive foundation (2026-08-24).
//
// Trước đây 2 bên TỰ tính khoảng reserved theo cùng công thức tỷ lệ
// (height * COMBAT_*_HEIGHT / DESIGN_HEIGHT) — chỉ đúng khi toàn khung
// bị scale đồng nhất. Sau khi bỏ transform-scale toàn game (bar DOM có
// kích thước px thực theo clamp()), công thức tỷ lệ sẽ LỆCH so với bar
// thật khi viewport rời khỏi tỉ lệ 16:9 (vd 1280x800).
//
// Nguồn chân lý MỚI: đo chiều cao render THẬT của các bar DOM rồi cấp
// xuống scene qua setCombatInsets(). Module plain-TS (không import Vue)
// để scene dùng an toàn theo đúng luật phân tầng core↔view.
//
// Fallback: trước lần đo đầu tiên (mounted + ResizeObserver chưa kịp
// chạy), scene dùng công thức tỷ lệ cũ với cờ measured=false.
export interface CombatInsets {
  /** Chiều cao thực (px) của Top Bar + Status Bar phía trên. */
  top: number

  /** Chiều cao thực (px) của Event Bar + Control Bar phía dưới. */
  bottom: number
}

interface MeasuredCombatInsets extends CombatInsets {
  /** false khi chưa từng có phép đo nào (dùng fallback tỷ lệ). */
  measured: boolean
}

const current: MeasuredCombatInsets = { top: 0, bottom: 0, measured: false }

export function setCombatInsets(insets: CombatInsets): void {
  current.top = Math.max(0, insets.top)
  current.bottom = Math.max(0, insets.bottom)
  current.measured = true
}

/** Về trạng thái chưa đo (overlay unmount) để scene dùng lại fallback tỷ lệ. */
export function resetCombatInsets(): void {
  current.top = 0
  current.bottom = 0
  current.measured = false
}

export function getCombatInsets(): MeasuredCombatInsets {
  return current
}

// ui-discoverability-refactor-plan.md §3.3 (2026-08-29) — fallback insets
// TỈ LỆ chuyển từ hằng COMBAT_*_HEIGHT (DesignFrame.ts, ĐÃ XÓA) về ĐÂY —
// một nguồn duy nhất cho "kích thước chrome combat" dùng khi chưa đo được
// DOM (mounted/ResizeObserver chưa kịp chạy). Fallback này CHỈ cho frame
// thiết kế 16:9; khi viewport rời tỉ lệ, đo thật (measured=true) đúng hơn
// và có ưu tiên.
const DESIGN_HEIGHT = 1440

const FALLBACK_TOP_BAR = 64
const FALLBACK_STATUS_BAR = 56
const FALLBACK_EVENT_BAR = 40
const FALLBACK_CONTROL_BAR = 64

export function getFallbackCombatInsets(height: number): CombatInsets {
  return {
    top: (height * (FALLBACK_TOP_BAR + FALLBACK_STATUS_BAR)) / DESIGN_HEIGHT,
    bottom: (height * (FALLBACK_EVENT_BAR + FALLBACK_CONTROL_BAR)) / DESIGN_HEIGHT,
  }
}
