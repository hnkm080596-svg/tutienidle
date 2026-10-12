import { utcDayBucket } from './GameClock'

/**
 * TimeAuthority (GP-01, design-authorized-now.md sec.2) - the ONE
 * authorized wall clock for the whole tick chain.
 *
 * `now()` = server anchor + monotonic elapsed. After the first anchor
 * reads, `Date.now()` is never consulted on the hot path: a system-clock
 * jump (+24h or -24h) cannot move mint deadlines, quota buckets, or
 * expiry checks - the wall-clock exploit dies at the source instead of
 * being patched per callsite.
 *
 * Contract (rulings, locked 2026-10-12):
 * - `now()` is non-decreasing for the lifetime of the instance.
 * - `rebase(serverWallMs)` only moves the clock FORWARD
 *   (`max(now(), server)`): a backward rebase would leave session-stamped
 *   deadlines future-dated, freezing deny-direction guards (the r10-INT
 *   `lastCheckedMs > now` class). Never go backward.
 * - The game is online-only: the authority always has (or will receive)
 *   a server anchor. Before the first server rebase, the cold-boot
 *   anchor is `wallNow()` read ONCE at construction plus monotonic
 *   elapsed - documented residual: a device clock fast-forwarded BEFORE
 *   boot anchors the session at the fake wall (deny direction, bounded
 *   by the first server stamp once rebase feeds land).
 *
 * Injection: `new GameManager({ time })` - GameManager holds the one
 * authority and feeds it into every Ops `deps.time`; domain systems get
 * a `now` provider wired to `time.now()`. A bare `new GameManager()`
 * constructs a default instance so tests keep working.
 */
export interface TimeAuthorityDeps {
  /**
   * Wall clock read ONLY to place an anchor (construction + rebase
   * input). Never read per `now()`. Test seam.
   */
  wallNow?: () => number

  /**
   * Monotonic elapsed source (immune to wall-clock edits).
   * Default `performance.now`. Test seam.
   */
  monotonicNow?: () => number
}

export class TimeAuthority {
  private readonly wallNow: () => number

  private readonly monotonicNow: () => number

  private anchorWallMs: number

  private anchorMonoMs: number

  private lastNowMs: number

  constructor(deps: TimeAuthorityDeps = {}) {
    this.wallNow = deps.wallNow ?? (() => Date.now())
    this.monotonicNow = deps.monotonicNow ?? (() => performance.now())

    // The single wall-clock read this class performs by itself. A
    // non-finite wall is coerced to 0 (deny direction: every persisted
    // deadline reads as future-dated and parks rather than minting).
    const wall = this.wallNow()
    this.anchorWallMs = Number.isFinite(wall) ? wall : 0
    this.anchorMonoMs = this.monotonicNow()
    this.lastNowMs = this.anchorWallMs
  }

  /**
   * Authorized wall-clock ms epoch. Monotonic-driven between anchors -
   * a system-clock edit after construction does not move it. Never
   * decreases (a backward monotonic step is clamped at the last value).
   */
  now(): number {
    const computed = this.anchorWallMs + (this.monotonicNow() - this.anchorMonoMs)

    // A non-finite monotonic read must not poison lastNowMs for the
    // rest of the session - hold the last good value (deny direction).
    this.lastNowMs = Number.isFinite(computed) ? Math.max(this.lastNowMs, computed) : this.lastNowMs

    return this.lastNowMs
  }

  /** `now()` in seconds - for the building accrual seconds-domain. */
  nowSeconds(): number {
    return this.now() / 1000
  }

  /** Raw monotonic clock - pure elapsed reads (leases, debounce). */
  monotonic(): number {
    return this.monotonicNow()
  }

  /**
   * UTC day-bucket of the authorized now - the ONE day boundary for
   * quota/quest surfaces (shared convention via utcDayBucket, same as
   * QuestSystem.dayBucket and the idle insight ledger).
   */
  dayBucket(): number {
    return utcDayBucket(this.now())
  }

  /**
   * Re-anchor the epoch from an authenticated server stamp. FORWARD
   * ONLY: the new anchor is `max(now(), serverWallMs)` at the current
   * monotonic, so the clock may jump ahead to the server bound but
   * never rewinds (backward = future-dated session stamps = deny
   * freeze). Non-finite stamps are ignored - a NaN anchor would poison
   * `now()` for the rest of the session.
   */
  rebase(serverWallMs: number): void {
    if (!Number.isFinite(serverWallMs)) {
      return
    }

    const nowMs = this.now()

    this.anchorWallMs = Math.max(nowMs, serverWallMs)
    this.anchorMonoMs = this.monotonicNow()
  }
}
