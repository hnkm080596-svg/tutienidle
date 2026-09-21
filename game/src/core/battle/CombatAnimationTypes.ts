// R5 (AR-24) — Canonical animation name types for combat presentation.
// Lives in core/battle to prevent upward dependencies from core runtime
// into game support.

/**
 * The uniform clip contract (locked 2026-09-19,
 * docs/superpowers/plans/2026-09-19-entity-art-mode-switch.md): EVERY combat
 * entity - player, companion, enemy, boss - carries the same five clips.
 * `idle` and `standby` are loops; `death` and the two transitions are
 * one-shots. `cultivate` is the lone player-side extra, played only on
 * non-combat surfaces.
 *
 * `hit`, `basic_attack` and `victory` were removed on 2026-09-11 (Spec B
 * sec.4.5): they were declared here and existed nowhere else in the tree - no
 * clip, no caller - and the animation-set builder's `as` cast asserted they
 * were present
 * anyway, so `set.hit` type-checked and was `undefined` at runtime.
 *
 * `ready`, `cast`, `sweep_hand` and `punch` were removed on 2026-09-19: attack
 * readability lives on the shared lunge tween for every entity (uniformity -
 * no per-faction attack clips), and `ready` collapsed into `standby`: the
 * engaged state is one loop reached through `idle_to_standby`, left through
 * `standby_to_idle`. An entity whose catalogue has no transition clips snaps
 * straight to the destination loop (playback resolves the fallback).
 *
 * Each name returns the day it has a clip and a caller together. A name in
 * this union with nothing behind it is what let that cast lie for as long as
 * it did.
 */
export type CombatAnimationName =
  | 'idle'
  | 'standby'
  | 'death'
  | 'idle_to_standby'
  | 'standby_to_idle'
  | 'cultivate'
