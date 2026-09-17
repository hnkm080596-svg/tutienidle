import type { Stage } from './Stage'

export interface ActiveStage {
  stageId: string

  spawnedCount: number

  // Giây còn lại tới lần spawn kế — dùng deltaSeconds (giống các
  // timer combat trong Battle), KHÔNG dùng Date.now(), để tôn trọng
  // pause/tốc độ x1-x4 giống mọi timer combat khác (khác Exploration/
  // Crafting, cố ý chạy cả khi offline).
  spawnCountdown: number
}

/**
 * Chỉ 1 slot đang chạy tại 1 thời điểm — cùng cardinality với Battle
 * (BattleSystem.battle: Battle | null), không phải nhiều tab chạy
 * song song như CraftingManager (Map theo resultType).
 *
 * Mission C audit (lease/ownership unification) — the slot is a
 * CAPABILITY, not ambient state: acquire() returns the ActiveStage
 * object that IS the ownership token, and only that exact object can
 * release the slot. Owners (manual stage run, auto-farm) keep their
 * token; a stale or foreign token passed to release() is a no-op, so
 * one system's teardown can never stomp another owner's lease — not
 * even one that holds the same stageId.
 */
export class StageManager {
  private active: ActiveStage | null = null

  /**
   * Take the single slot. Returns the lease object — the ownership
   * capability — or null when the slot is already held by anyone.
   */
  acquire(stage: Stage): ActiveStage | null {
    if (this.active) {
      return null
    }

    this.active = {
      stageId: stage.id,

      spawnedCount: 1,

      spawnCountdown: stage.spawnIntervalSeconds,
    }

    return this.active
  }

  get(): ActiveStage | null {
    return this.active
  }

  /**
   * Capability release — frees the slot only when `lease` IS the current
   * owner (object identity). A stale token (its lease already released)
   * or a foreign token is a safe no-op; there is intentionally no
   * ownerless "stop" — whoever holds the token holds the slot.
   */
  release(lease: ActiveStage | null | undefined): boolean {
    if (!lease || this.active !== lease) {
      return false
    }

    this.active = null
    return true
  }
}
