// R5 (AR-24) — Canonical pacing constants for turn battle phases.
// Lives in core/battle/turn to prevent upward import cycles from presentation
// events into GameManager.

export const COUNTDOWN_TOTAL_TICKS = 30
export const INTRO_TOTAL_TICKS = 20

/**
 * Combat Turn Mechanism spec section 4.1a - how long a parked ANIMATION or
 * SEMANTIC_VFX step waits for the renderer before completing itself.
 *
 * This is not an optimisation. It is what stops a destroyed sprite, a
 * cancelled tween or a texture that failed to load from parking the pipeline
 * forever, which would leave the turn token non-IDLE and the combat clock
 * frozen for the rest of the session.
 *
 * Animation-driven cast timing (impact-sync) also reads this as the legality
 * bound for clip-derived castMs: a clip whose impact lands at or past the
 * fallback would have its domain impact reported by the mechanical settle
 * BEFORE the authored impact frame, so the runner treats such a duration as
 * invalid and falls back to recipe timing.
 */
export const ANIMATION_FALLBACK_MS = 4000
