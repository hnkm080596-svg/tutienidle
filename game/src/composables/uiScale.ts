// WS8 - UI scale setting (2026-08-24): nguoi choi chon 90/100/110/125%.
// CHI nhan cac semantic token (typography/interaction sizing trong
// theme.css qua var(--ui-scale)), KHONG quay lai transform-scale toan
// game root - canvas Phaser va khung layout giu nguyen.
const STORAGE_KEY = 'tien-hiep-idle-ui-scale'

export const UI_SCALE_OPTIONS = [0.9, 1, 1.1, 1.25] as const

export const DEFAULT_UI_SCALE: number = 1

function isValidScale(value: number): value is (typeof UI_SCALE_OPTIONS)[number] {
  return (UI_SCALE_OPTIONS as readonly number[]).includes(value)
}

function clampToOptions(value: number): number {
  return isValidScale(value) ? value : DEFAULT_UI_SCALE
}

export function loadUiScale(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return DEFAULT_UI_SCALE
    }

    return clampToOptions(Number(raw))
  } catch {
    // Audit fix 2026-08-31 - storage bi chan (privacy mode/SSR) tung
    // throw o boot (main.ts goi initUiScale() truoc app.mount()).
    return DEFAULT_UI_SCALE
  }
}

export function applyUiScale(scale: number): void {
  document.documentElement.style.setProperty('--ui-scale', String(clampToOptions(scale)))
}

export function saveUiScale(scale: number): void {
  const valid = clampToOptions(scale)

  localStorage.setItem(STORAGE_KEY, String(valid))
  applyUiScale(valid)
}

// Goi 1 lan luc boot (main.ts) - truoc app.mount() de khong nhap nhay.
export function initUiScale(): void {
  applyUiScale(loadUiScale())
}
