const STORAGE_KEY = 'tutien-reduced-motion'
let sessionPreference: boolean | undefined
export function reducedMotionSetting(): boolean {
  if (sessionPreference !== undefined) return sessionPreference
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}
export function prefersReducedMotion(): boolean {
  return reducedMotionSetting() || (typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
}
export function applyMotionPreference(): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.reducedMotion = String(reducedMotionSetting())
}
export function setReducedMotionSetting(value: boolean): void {
  sessionPreference = value
  try { localStorage.setItem(STORAGE_KEY, String(value)) } catch { /* Session-only DOM preference remains available. */ }
  applyMotionPreference()
}
