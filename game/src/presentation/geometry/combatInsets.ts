// Cau noi kich thuoc giua DOM chrome (CombatSceneOverlay.vue) va Phaser
// (CombatScene.ts) - WS1 Responsive foundation (2026-08-24).
//
// Nguon chan ly: do chieu cao render THAT cua bar DOM roi cap xuong
// scene qua setCombatInsets(). Module plain-TS (khong import Vue) de
// scene dung an toan theo dung luat phan tang core<->view.
//
// Measured top, bottom party dock and optional right chrome reserve
// physical pixels inside the common 16:9 frame.
export interface CombatInsets {
  /** Chieu cao thuc (px) cua Top Bar phia tren. */
  top: number

  /** Measured bottom party dock reservation. */
  bottom: number

  /** Chieu rong thuc (px) cua skill dock panel bam mep phai. */
  right: number
}

interface MeasuredCombatInsets extends CombatInsets {
  /** false khi chua tung co phep do nao (dung fallback ty le). */
  measured: boolean
}

const current: MeasuredCombatInsets = { top: 0, bottom: 0, right: 0, measured: false }

export function setCombatInsets(insets: CombatInsets): void {
  current.top = Math.max(0, insets.top)
  current.bottom = Math.max(0, insets.bottom)
  current.right = Math.max(0, insets.right)
  current.measured = true
}

/** Ve trang thai chua do (overlay unmount) de scene dung lai fallback ty le. */
export function resetCombatInsets(): void {
  current.top = 0
  current.bottom = 0
  current.right = 0
  current.measured = false
}

export function getCombatInsets(): MeasuredCombatInsets {
  return current
}

// Combat Art Pipeline Task 7 (2026-09-05, spec sec7.5) - 2 publisher
// chuyen biet cho kien truc inset 2 nguon: CombatSceneOverlay (TopBar)
// va CombatSkillDockPanel (dock phai) moi ben do/publish rieng mot
// truong, KHONG de truong cua ben kia (setCombatInsets tho se ghi de
// ca 3 truong moi lan goi). Dedicated publishers preserve sibling reservations.

/** Overlay publish chieu cao TopBar do duoc - giu nguyen `right` hien co. */
export function publishTopBarHeight(top: number): void {
  setCombatInsets({ top, bottom: current.bottom, right: current.right })
}

/** Dock publish chieu rong thuc do duoc - giu nguyen `top` hien co. */
export function publishSkillDockWidth(right: number): void {
  setCombatInsets({ top: current.top, bottom: current.bottom, right })
}

/** Dock unmount - right ve 0 (chua do) nhung giu `top` cua TopBar. */
export function clearSkillDockWidth(): void {
  setCombatInsets({ top: current.top, bottom: current.bottom, right: 0 })
}

// Fallback insets TI LE - chi dung khi chua do duoc DOM (mounted/
// ResizeObserver chua kip chay); frame thiet ke 16:9.
// The bottom dock is 204 design pixels plus its edge clearance.
const DESIGN_HEIGHT = 1440

const FALLBACK_TOP_BAR = 64
const FALLBACK_STATUS_BAR = 56

export function getFallbackCombatInsets(height: number): CombatInsets {
  return {
    top: (height * (FALLBACK_TOP_BAR + FALLBACK_STATUS_BAR)) / DESIGN_HEIGHT,
    bottom: height * 228 / 810,
    right: 0,
  }
}

// The party dock reserves physical pixels within the shared design frame.
export function publishPartyDockHeight(bottom: number): void {
  setCombatInsets({ top: current.top, bottom, right: current.right })
}
