// R5 (AR-24) — Canonical animation name types for combat presentation.
// Lives in core/battle to prevent upward dependencies from core runtime
// into game support.

/**
 * Names that have BOTH a clip and a call site.
 *
 * `hit`, `basic_attack` and `victory` were removed on 2026-09-11 (Spec B §4.5):
 * they were declared here and existed nowhere else in the tree — no clip, no
 * caller — and the animation-set builder's `as` cast asserted they were present
 * anyway, so `set.hit` type-checked and was `undefined` at runtime.
 *
 * Each returns the day it has a clip and a caller together. A name in this union
 * with nothing behind it is what let that cast lie for as long as it did.
 */
export type CombatAnimationName =
  | 'idle'
  | 'ready'
  | 'cast'
  | 'sweep_hand'
  | 'punch'
  | 'standby'
  | 'death'
