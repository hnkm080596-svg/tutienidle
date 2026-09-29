// screenShakePolicy - W10 (OQ-D) reduced screen-shake accessibility gate.
//
// Single choke point for camera impulses. `src/game/**` scenes call
// `applyScreenShake` instead of `camera.shake` directly - the scenes may
// import presentation but never `@/stores` (frontendImportDirection), so
// the flag lives here and `App.vue` pushes it via `setReducedShakeEnabled`
// (watch on `audio.reducedShake`, immediate).
//
// Reduced mode scales intensity to REDUCED_SHAKE_SCALE (not 0): the toggle
// softens shake, it does not remove impact feedback entirely.

export const REDUCED_SHAKE_SCALE = 0.35

let reducedShake = false

export function setReducedShakeEnabled(value: boolean): void {
  reducedShake = value
}

export function isReducedShakeEnabled(): boolean {
  return reducedShake
}

export function screenShakeScale(): number {
  return reducedShake ? REDUCED_SHAKE_SCALE : 1
}

interface ShakeCamera {
  shake(durationMs?: number, intensity?: number, force?: boolean): void
}

/** Fire a camera shake honoring the reduced-shake flag. */
export function applyScreenShake(
  camera: ShakeCamera,
  durationMs: number,
  intensity: number,
  force = false,
): void {
  camera.shake(durationMs, intensity * screenShakeScale(), force)
}
