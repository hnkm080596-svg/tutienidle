import type { Stage } from './Stage'

declare const stageLeaseBrand: unique symbol

/**
 * Ownership capability for the single stage slot. Opaque by design: only
 * StageManager.acquire() mints it, and only the exact minted object
 * passes the owns()/release() identity checks. The brand keeps it
 * non-constructible and non-forgeable at the type level - the
 * ActiveStageSnapshot handed out by getActive() deliberately lacks it,
 * so an observational read can never be passed back to release().
 */
export interface StageLease {
  readonly stageId: string
  readonly [stageLeaseBrand]: true
}

/**
 * Read-only view of the held slot - stage bookkeeping for observational
 * consumers (progress, loot-stage reads). NOT the capability: this object
 * cannot be passed to release() (no brand at compile time, not the
 * minted token at runtime).
 *
 * spawnCountdown: seconds until the next spawn - uses deltaSeconds
 * (like every other combat timer in Battle), NOT Date.now(), so it
 * honors pause and the x1-x4 speed control like all combat timers
 * (unlike Exploration/Crafting, which deliberately keep running
 * while offline).
 */
export interface ActiveStageSnapshot {
  readonly stageId: string
  readonly spawnedCount: number
  readonly spawnCountdown: number
}

/**
 * Chỉ 1 slot đang chạy tại 1 thời điểm — cùng cardinality với Battle
 * (BattleSystem.battle: Battle | null), không phải nhiều tab chạy
 * song song như CraftingManager (Map theo resultType).
 *
 * Mission C audit (capability hardening, C5): the slot is a CAPABILITY -
 * acquire() mints an opaque StageLease token and only that exact object
 * can release the slot. Owners (manual stage run, auto-farm) keep their
 * token privately; a stale, forged, or foreign token passed to release()
 * is a no-op, and the observational getActive() snapshot can never be
 * used to release somebody else's lease - not even one holding the same
 * stageId.
 */
export class StageManager {
  private active: {
    readonly lease: StageLease
    readonly snapshot: ActiveStageSnapshot
  } | null = null

  /**
   * Take the single slot. Returns the ownership token - keep it private;
   * it is the ONLY object that can release this lease. Null when the
   * slot is already held by anyone.
   */
  acquire(stage: Stage): StageLease | null {
    if (this.active) {
      return null
    }

    const lease = { stageId: stage.id } as StageLease

    this.active = {
      lease,
      snapshot: {
        stageId: stage.id,
        spawnedCount: 1,
        spawnCountdown: stage.spawnIntervalSeconds,
      },
    }

    return lease
  }

  /**
   * Observational read - a snapshot of the held slot, deliberately NOT
   * the ownership token. Consumers may inspect stageId/bookkeeping but
   * can never recover release capability from it.
   */
  getActive(): ActiveStageSnapshot | null {
    const snapshot = this.active?.snapshot

    // Defensive copy - the held record is internal bookkeeping; handing
    // out the same reference would let a consumer mutate it behind the
    // owner's back.
    return snapshot ? { ...snapshot } : null
  }

  /**
   * Is `lease` the token this slot currently holds? The only ownership
   * question that exists - "someone holds the slot" is intentionally not
   * answerable as a capability.
   */
  owns(lease: StageLease | null | undefined): boolean {
    return lease != null && this.active?.lease === lease
  }

  /**
   * Capability release - frees the slot only when `lease` IS the current
   * owner (object identity). A stale token (its lease already released),
   * a forged literal, a getActive() snapshot, or a foreign token is a
   * safe no-op; there is intentionally no ownerless "stop" - whoever
   * holds the token holds the slot.
   */
  release(lease: StageLease | null | undefined): boolean {
    if (!this.owns(lease)) {
      return false
    }

    this.active = null
    return true
  }
}
