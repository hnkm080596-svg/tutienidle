export type CombatPlaybackSpeed = 1 | 2

// Combat presentation owns this session preference. World clocks never read it.
const SPEED_STORAGE_KEY = 'tutien-combat-playback-speed'
let speed: CombatPlaybackSpeed = 1
try { if (typeof localStorage !== 'undefined' && localStorage.getItem(SPEED_STORAGE_KEY) === '2') speed = 2 } catch { /* Storage may be unavailable. */ }
export function getCombatPlaybackSpeed(): CombatPlaybackSpeed { return speed }
export function setCombatPlaybackSpeed(value: CombatPlaybackSpeed): void {
  speed = value
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SPEED_STORAGE_KEY, String(value)) } catch { /* Keep the in-memory preference. */ }
}

export function combatPlaybackDelta(deltaMs: number): number {
  return Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs * speed : 0
}
