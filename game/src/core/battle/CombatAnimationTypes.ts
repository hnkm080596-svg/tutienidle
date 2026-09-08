// R5 (AR-24) — Canonical animation name types for combat presentation.
// Lives in core/battle to prevent upward dependencies from core runtime
// into game support.

export type CombatAnimationName =
  | 'idle'
  | 'ready'
  | 'cast'
  | 'standby'
  | 'hit'
  | 'death'
  | 'basic_attack'
  | 'victory'
