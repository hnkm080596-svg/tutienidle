// combat-telegraph (Wave-3 large-file split) — tach tu CombatScene.ts.
// Countdown-telegraph chase: the party's shared countdownProgress arrives as
// snapshots; this module owns the from/to/segment interpolation that closes
// the distance every render frame. State fields stay on the scene
// (Internal module boundary) — the handles it drives live alongside
// turnCountdownSpawnVfxHandles/entityVisual there by design.
import Phaser from 'phaser'

import type { CombatScene } from '../CombatScene'
import { MAX_SEGMENT_DURATION_MS, MIN_SEGMENT_DURATION_MS } from './combatConstants'

export class CombatTelegraph {
  constructor(private readonly scene: CombatScene) {}

  /**
   * Task 9 (telegraph interpolation) — closes the distance between the last
   * shown progress and the latest snapshot target every render frame. This
   * is art, not mechanism: it never writes combat state, only reads
   * `telegraphSegment` (set by reconcileTurnCountdownSpawn/setTarget from
   * the snapshot) and repaints the VFX handles already owned by the
   * countdown telegraph.
   *
   * Progress comes from absolute elapsed time over the segment — clamped to
   * 1 — exactly like `CombatPositionInterpolation.interpolate()`
   * (combat-position-interpolation.ts), NOT a per-frame exponential chase:
   * that formula never reached its target and closed a different fraction
   * of the remaining distance per wall-clock window at different frame
   * rates, violating §4.4.
   */
  advance(): void {
    if (this.scene.turnCountdownSpawnVfxHandles.size === 0) {
      return
    }

    this.scene.telegraphShown = this.progressNow()

    for (const handle of this.scene.turnCountdownSpawnVfxHandles.values()) {
      handle.update(this.scene.telegraphShown)
    }
  }

  /** Instantaneous interpolated value of `telegraphSegment` at `scene.time.now`. */
  progressNow(): number {
    const { from, to, segmentStart, segmentDuration } = this.scene.telegraphSegment
    const progress = Phaser.Math.Clamp(
      (this.scene.time.now - segmentStart) / segmentDuration,
      0,
      1,
    )

    return Phaser.Math.Linear(from, to, progress)
  }

  /**
   * Store the latest countdownProgress as a chase target instead of painting
   * it directly — mirrors `CombatPositionInterpolation.setInterpolationTarget`
   * (segment from current visual value to the new target, duration from the
   * actual inter-snapshot cadence, floored at MIN_SEGMENT_DURATION_MS).
   */
  setTarget(target: number): void {
    const now = this.scene.time.now
    const scene = this.scene

    if (scene.telegraphSnapshotAt === undefined) {
      // First value since the countdown started (or since the last flush) —
      // nothing to chase from yet; snap so advance() has a real baseline
      // instead of chasing from a stale/zeroed segment.
      scene.telegraphSegment = {
        from: target,
        to: target,
        segmentStart: now,
        segmentDuration: MIN_SEGMENT_DURATION_MS,
      }
      scene.telegraphSnapshotAt = now
      scene.telegraphTarget = target

      return
    }

    if (target === scene.telegraphSegment.to) {
      scene.telegraphSnapshotAt = now

      return
    }

    const cadenceMs = Math.min(
      MAX_SEGMENT_DURATION_MS,
      Math.max(MIN_SEGMENT_DURATION_MS, now - scene.telegraphSnapshotAt),
    )

    scene.telegraphSegment = {
      from: this.progressNow(),
      to: target,
      segmentStart: now,
      segmentDuration: cadenceMs,
    }
    scene.telegraphSnapshotAt = now
    scene.telegraphTarget = target
  }

  /** Zeroes the telegraph's target/shown/segment state — see call sites. */
  reset(): void {
    this.scene.telegraphTarget = 0
    this.scene.telegraphShown = 0
    this.scene.telegraphSegment = {
      from: 0,
      to: 0,
      segmentStart: this.scene.time.now,
      segmentDuration: MIN_SEGMENT_DURATION_MS,
    }
    this.scene.telegraphSnapshotAt = undefined
  }
}
