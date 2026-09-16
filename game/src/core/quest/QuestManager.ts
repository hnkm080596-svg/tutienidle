import type { QuestProgress } from './QuestProgress'
import type { Quest } from './Quest'

export interface QuestManagerState {
  active: QuestProgress[]

  completedOnceIds: string[]

  lastDailyResetAtMs: number
}

function createDefaultState(): QuestManagerState {
  return {
    active: [],

    completedOnceIds: [],

    lastDailyResetAtMs: 0,
  }
}

/**
 * Quest KHÔNG giữ state trong PlayerData (giống productionSites/
 * alchemyJobs) — save như slice riêng trong GameSave (xem
 * SaveSystem.ts). QuestManager chỉ CRUD state runtime, mọi logic
 * (activate/claim/reset) nằm ở QuestSystem (stateless, giống
 * BuildingSystem).
 */
export class QuestManager {
  private state: QuestManagerState = createDefaultState()

  getActive(): QuestProgress[] {
    return this.state.active
  }

  getProgress(questId: string): QuestProgress | undefined {
    return this.state.active.find((progress) => progress.questId === questId)
  }

  ensureActive(quest: Quest): QuestProgress {
    const existing = this.getProgress(quest.id)

    if (existing) {
      return existing
    }

    const progress: QuestProgress = {
      questId: quest.id,

      progress: 0,

      claimed: false,
    }

    this.state.active.push(progress)

    return progress
  }

  incrementProgress(questId: string, amount: number): void {
    const progress = this.getProgress(questId)

    if (!progress || progress.claimed) {
      return
    }

    progress.progress += amount
  }

  markClaimed(questId: string): void {
    const progress = this.getProgress(questId)

    if (progress) {
      progress.claimed = true
    }
  }

  isCompletedOnce(questId: string): boolean {
    return this.state.completedOnceIds.includes(questId)
  }

  markCompletedOnce(questId: string): void {
    if (!this.isCompletedOnce(questId)) {
      this.state.completedOnceIds.push(questId)
    }
  }

  getLastDailyResetAtMs(): number {
    return this.state.lastDailyResetAtMs
  }

  /**
   * Xoá progress 'daily' CHƯA claim, giữ nguyên completedOnceIds (quest
   * 'once' không liên quan tới daily reset). newActiveDailyQuestIds là
   * toàn bộ id quest 'daily' đang mở khoá hôm nay — QuestSystem tính
   * trước rồi truyền vào để QuestManager không cần biết QuestRegistry.
   */
  resetDaily(newActiveDailyQuestIds: string[], now: number): void {
    this.state.active = this.state.active.filter(
      (progress) => !newActiveDailyQuestIds.includes(progress.questId),
    )

    this.state.lastDailyResetAtMs = now
  }

  /**
   * M1 (ARCH-001) — restore replaces the whole state with a DETACHED
   * copy: the payload is a value, so mutating it afterwards must not
   * leak into live state (A3).
   */
  restore(state: QuestManagerState): void {
    // Mission A3 defense-in-depth: normalize instead of trusting the
    // declared shape — a payload that bypassed the validator (active as
    // a string, non-finite reset marker) must not crash consumers.
    this.state = {
      // Canonicalize to the declared element shape — a bypassed payload
      // carrying extra keys must not self-replicate into future saves
      // (same invariant as the player top-level whitelist, MA-R1-01).
      active: Array.isArray(state.active)
        ? state.active
            .filter(
              (entry): entry is QuestManagerState['active'][number] =>
                typeof entry === 'object' &&
                entry !== null &&
                typeof (entry as { questId?: unknown }).questId === 'string' &&
                Number.isFinite((entry as { progress?: unknown }).progress) &&
                ((entry as { progress?: unknown }).progress as number) >= 0 &&
                typeof (entry as { claimed?: unknown }).claimed === 'boolean',
            )
            .map((entry) => ({
              questId: entry.questId,
              progress: entry.progress,
              claimed: entry.claimed,
            }))
        : [],

      completedOnceIds: Array.isArray(state.completedOnceIds)
        ? state.completedOnceIds.filter((id) => typeof id === 'string')
        : [],

      lastDailyResetAtMs:
        Number.isFinite(state.lastDailyResetAtMs) && state.lastDailyResetAtMs >= 0
          ? state.lastDailyResetAtMs
          : 0,
    }
  }

  getState(): QuestManagerState {
    return this.state
  }
}
