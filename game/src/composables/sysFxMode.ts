// M-UI-OVERHAUL - low-effects mode: kills the decorative rim/sweep/scanline
// animations (the .sys-fx-low rules in system-theme.css) for players on weak
// hardware or who prefer a calmer shell. Persisted like uiScale; applied on
// documentElement so every teleported overlay inherits it.
const STORAGE_KEY = 'tien-hiep-idle-sys-fx-low'

export function loadSysFxLow(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage may be blocked (privacy mode) at boot - same guard as uiScale.
    return false
  }
}

export function applySysFxLow(low: boolean): void {
  document.documentElement.classList.toggle('sys-fx-low', low)
}

export function saveSysFxLow(low: boolean): void {
  localStorage.setItem(STORAGE_KEY, low ? '1' : '0')
  applySysFxLow(low)
}

export function initSysFxLow(): void {
  applySysFxLow(loadSysFxLow())
}
