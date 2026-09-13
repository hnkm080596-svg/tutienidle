// combat-telegraph (Wave-3 large-file split) — tach tu CombatScene.ts.
// Countdown-telegraph chase: the party's shared countdownProgress arrives as
// snapshots; this module owns the from/to/segment interpolation that closes
// the distance every render frame.
//
// R11 (AR-29) — the chase state (target/shown/segment/snapshotAt) moved INTO
// this module; the host only supplies the clock and the read-only VFX handle
// map the chase drives. The scene no longer owns telegraph fields.
import Phaser from 'phaser'

import type { EnemySpawnVfxHandle } from '@/game/support/EnemySpawnVfx'
import { MAX_SEGMENT_DURATION_MS, MIN_SEGMENT_DURATION_MS } from './combatConstants'

/**
 * The narrow capability the telegraph needs from its host — a wall-clock and
 * the live countdown-VFX handle map (owned by the scene's entity-visual
 * lifecycle, iterated read-only here).
 */
export interface TelegraphHost {
  readonly time: { readonly now: number }
  readonly turnCountdownSpawnVfxHandles: ReadonlyMap<string, EnemySpawnVfxHandle>
}

export class CombatTelegraph {
  private targetValue = 0
  private shownValue = 0
  private segment = {
    from: 0,
    to: 0,
    segmentStart: 0,
    segmentDuration: MIN_SEGMENT_DURATION_MS,
  }
  private snapshotAtValue: number | undefined = undefined

  // S3/R11 (AR-29) — read-only exposure; mutation only via the owned
  // advance/setTarget/reset API below.
  get target(): number {
    return this.targetValue
  }

  get shown(): number {
    return this.shownValue
  }

  constructor(private readonly host: TelegraphHost) {}

  /**
   * Task 9 (telegraph interpolation) — closes the distance between the last
   * shown progress and the latest snapshot target every render frame. This
   * is art, not mechanism: it never writes combat state, only reads the
   * owned segment (set by setTarget from the snapshot) and repaints the VFX
   * handles already owned by the countdown telegraph.
   *
   * Progress comes from absolute elapsed time over the segment — clamped to
   * 1 — exactly like `CombatPositionInterpolation.interpolate()`
   * (combat-position-interpolation.ts), NOT a per-frame exponential chase:
   * that formula never reached its target and closed a different fraction
   * of the remaining distance per wall-clock window at different frame
   * rates, violating §4.4.
   */
  advance(): void {
    if (this.host.turnCountdownSpawnVfxHandles.size === 0) {
      return
    }

    this.shownValue = this.progressNow()

    for (const handle of this.host.turnCountdownSpawnVfxHandles.values()) {
      handle.update(this.shownValue)
    }
  }

  /** Instantaneous interpolated value of the owned segment at the clock's now. */
  progressNow(): number {
    const { from, to, segmentStart, segmentDuration } = this.segment
    const progress = Phaser.Math.Clamp(
      (this.host.time.now - segmentStart) / segmentDuration,
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
    const now = this.host.time.now

    if (this.snapshotAtValue === undefined) {
      // First value since the countdown started (or since the last flush) —
      // nothing to chase from yet; snap so advance() has a real baseline
      // instead of chasing from a stale/zeroed segment.
      this.segment = {
        from: target,
        to: target,
        segmentStart: now,
        segmentDuration: MIN_SEGMENT_DURATION_MS,
      }
      this.snapshotAtValue = now
      this.targetValue = target

      return
    }

    if (target === this.segment.to) {
      this.snapshotAtValue = now

      return
    }

    const cadenceMs = Math.min(
      MAX_SEGMENT_DURATION_MS,
      Math.max(MIN_SEGMENT_DURATION_MS, now - this.snapshotAtValue),
    )

    this.segment = {
      from: this.progressNow(),
      to: target,
      segmentStart: now,
      segmentDuration: cadenceMs,
    }
    this.snapshotAtValue = now
    this.targetValue = target
  }

  /** Zeroes the telegraph's target/shown/segment state — see call sites. */
  reset(): void {
    this.targetValue = 0
    this.shownValue = 0
    this.segment = {
      from: 0,
      to: 0,
      segmentStart: this.host.time.now,
      segmentDuration: MIN_SEGMENT_DURATION_MS,
    }
    this.snapshotAtValue = undefined
  }
}
