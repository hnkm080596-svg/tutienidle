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
 */
export class StageManager {
  private active: ActiveStage | null = null

  start(stage: Stage): boolean {
    if (this.active) {
      return false
    }

    this.active = {
      stageId: stage.id,

      spawnedCount: 1,

      spawnCountdown: stage.spawnIntervalSeconds,
    }

    return true
  }

  get(): ActiveStage | null {
    return this.active
  }

  restartCycle(stage: Stage) {
    if (!this.active || this.active.stageId !== stage.id) return false

    this.active.spawnedCount = 0
    this.active.spawnCountdown = 0
    return true
  }

  stop() {
    this.active = null
  }
}
