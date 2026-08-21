import type { Exploration } from './Exploration'

export interface ActiveExploration {
  explorationId: string

  startedAt: number

  /**
   * Số lượt đã hoàn thành
   * trước lần kiểm tra gần nhất.
   */
  claimedRuns: number
}

export class ExplorationManager {
  private readonly active = new Map<string, ActiveExploration>()

  start(exploration: Exploration, currentTime: number): boolean {
    if (!exploration.enabled) {
      return false
    }

    if (this.active.has(exploration.id)) {
      return false
    }

    this.active.set(exploration.id, {
      explorationId: exploration.id,

      startedAt: currentTime,

      claimedRuns: 0,
    })

    return true
  }

  stop(explorationId: string): boolean {
    return this.active.delete(explorationId)
  }

  get(explorationId: string): ActiveExploration | undefined {
    return this.active.get(explorationId)
  }

  getAll(): ActiveExploration[] {
    return Array.from(this.active.values())
  }

  isRunning(explorationId: string): boolean {
    return this.active.has(explorationId)
  }

  /**
   * Nạp lại state từ save — bỏ qua guard của start() (guard đó chỉ
   * hợp lý cho hành động "bắt đầu mới", không hợp cho việc phục hồi
   * save đã có sẵn state hợp lệ).
   */
  restore(entries: ActiveExploration[]) {
    this.active.clear()

    for (const entry of entries) {
      this.active.set(entry.explorationId, entry)
    }
  }
}
