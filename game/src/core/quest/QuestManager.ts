import type { QuestProgress } from './QuestProgress'
import type { Quest } from './Quest'

export interface QuestManagerState {
  active: QuestProgress[]

  completedOnceIds: string[]

  lastDailyResetAtMs: number

  // Feature-witness flags fired via QuestSystem.onFlag (dedup'd flag
  // ids). Optional - saves written before flag quests lack the slice.
  questFlags?: string[]
}

function createDefaultState(): QuestManagerState {
  return {
    active: [],

    completedOnceIds: [],

    lastDailyResetAtMs: 0,

    questFlags: [],
  }
}

function incrementBoundedCounter(current: number, amount: number, maximum: number): number {
  if (!Number.isFinite(current) || current < 0 ||
      !Number.isFinite(amount) || amount <= 0 ||
      !Number.isSafeInteger(maximum) || maximum <= 0) return current
  return Math.min(maximum, current + amount)
}

/**
 * Quests keep NO state in PlayerData (same as productionSites/
 * alchemyJobs) - they save as a separate slice in GameSave (see
 * SaveSystem.ts). QuestManager only CRUDs runtime state; all logic
 * (activate/claim/reset) lives in QuestSystem (stateless, like
 * BuildingSystem).
 */
export class QuestManager {
  private state: QuestManagerState = createDefaultState()
  // One manager serializes all quest grants, including callback reentry
  // into a different quest that may share the same turn-in materials.
  private claimingQuestId: string | undefined

  isClaiming(): boolean {
    return this.claimingQuestId !== undefined
  }

  beginClaim(questId: string): boolean {
    if (this.isClaiming()) return false
    this.claimingQuestId = questId
    return true
  }

  endClaim(questId: string): void {
    if (this.claimingQuestId === questId) this.claimingQuestId = undefined
  }

  private withRuntimeClaimContext(progress: QuestProgress): QuestProgress {
    // Derived runtime view only: no second mutable flag and no lock in saves.
    Object.defineProperty(progress, 'claimInProgress', {
      enumerable: false,
      get: () => this.isClaiming(),
    })
    return progress
  }

  getActive(): QuestProgress[] {
    return this.state.active
  }

  getProgress(questId: string): QuestProgress | undefined {
    return this.state.active.find((progress) => progress.questId === questId)
  }

  ensureActive(quest: Quest): QuestProgress {
    const existing = this.getProgress(quest.id)

    if (existing) {
      if (quest.condition.kind === 'allOf') {
        const previous = existing.objectiveVersion === 1 ? existing.objectives : undefined
        existing.objectiveVersion = 1
        existing.objectives = Object.fromEntries(quest.condition.objectives.map((leaf) => {
          const count = previous && Object.hasOwn(previous, leaf.id) ? previous[leaf.id] : 0
          return [leaf.id, Number.isFinite(count) && (count ?? -1) >= 0
            ? Math.min(leaf.amount, count ?? 0) : 0]
        }))
      }
      return existing
    }

    const progress: QuestProgress = {
      questId: quest.id,

      progress: 0,

      claimed: false,
      ...(quest.condition.kind === 'allOf' ? {
        objectiveVersion: 1 as const,
        objectives: Object.fromEntries(quest.condition.objectives.map((leaf) => [leaf.id, 0])),
      } : {}),
    }

    this.state.active.push(this.withRuntimeClaimContext(progress))

    return progress
  }

  /**
   * Remove an active progress entry entirely (P7-M9). Used by
   * QuestSystem.reconcileActiveQuests to drop quests whose realm gate is
   * no longer satisfied - stale progress restored from a save must not
   * keep counting or pay out. 'once' completions live in
   * completedOnceIds and are unaffected.
   */
  deactivate(questId: string): void {
    this.state.active = this.state.active.filter((progress) => progress.questId !== questId)
  }

  incrementProgress(questId: string, amount: number, maximum?: number): void {
    const progress = this.getProgress(questId)

    if (!progress || progress.claimed) {
      return
    }

    progress.progress = maximum === undefined
      ? progress.progress + amount
      : incrementBoundedCounter(progress.progress, amount, maximum)
  }

  markClaimed(questId: string): void {
    const progress = this.getProgress(questId)

    if (progress) {
      progress.claimed = true
    }
  }

  incrementObjective(questId: string, objectiveId: string, amount: number, target: number): void {
    const progress = this.getProgress(questId)
    if (!progress || progress.claimed || progress.objectiveVersion !== 1 ||
        !progress.objectives || !Object.hasOwn(progress.objectives, objectiveId)) return
    progress.objectives[objectiveId] = incrementBoundedCounter(
      progress.objectives[objectiveId] ?? 0, amount, target)
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
   * Feature-witness flag (kind:'flag' quest conditions). Dedup'd - the
   * record is "the flag fired at least once"; progress counting lives
   * on the active quest entries via onFlag, same activation-counts
   * rule as kills/collects.
   */
  markQuestFlag(flagId: string): void {
    const flags = this.state.questFlags ?? (this.state.questFlags = [])

    if (!flags.includes(flagId)) {
      flags.push(flagId)
    }
  }

  hasQuestFlag(flagId: string): boolean {
    return (this.state.questFlags ?? []).includes(flagId)
  }

  /**
   * Removes progress for UNCLAIMED 'daily' quests, keeping
   * completedOnceIds ('once' quests are unrelated to daily reset).
   * newActiveDailyQuestIds is the full set of 'daily' quest ids unlocked
   * today - QuestSystem computes it upfront and passes it in so
   * QuestManager never needs QuestRegistry.
   */
  resetDaily(newActiveDailyQuestIds: string[], now: number): void {
    this.state.active = this.state.active.filter(
      (progress) => !newActiveDailyQuestIds.includes(progress.questId),
    )

    this.state.lastDailyResetAtMs = now
  }

  /**
   * M1 (ARCH-001) - restore replaces the whole state with a DETACHED
   * copy: the payload is a value, so mutating it afterwards must not
   * leak into live state (A3).
   */
  restore(state: QuestManagerState, nowMs: number = Date.now()): void {
    // Mission A3 defense-in-depth: normalize instead of trusting the
    // declared shape - a payload that bypassed the validator (active as
    // a string, non-finite reset marker) must not crash consumers.
    // r11-AUT: a crafted FUTURE reset stamp freezes the daily reset
    // forever (dayBucket(now) <= dayBucket(future) always). Clamp to
    // now - the honest direction ("just reset") denies the exploit,
    // unlike 0 which would grant a free reset. r16-INT-04: the clamp
    // reads the FIELD's own epoch - callers pass Date.now() (the stamp
    // lives in the payload clock; a server anchor would drag an honest
    // same-day marker a full skew back and refire the daily reset).
    // r29-COR-F1: only clamp under a sane clock - a non-finite nowMs
    // collapses min() to NaN and poisons the marker into a write-gate
    // wedge (-Infinity would drag it deep-past and refire the reset).
    // Bad clock -> verbatim stamp: a crafted-future marker stays frozen
    // (deny). r30-AUT-3: same [0, 2^52) domain as the sibling restore
    // clocks - a negative or out-of-domain restoreNowMs keeps verbatim.
    let lastDailyResetAtMs = 0
    if (Number.isFinite(state.lastDailyResetAtMs) && state.lastDailyResetAtMs >= 0) {
      lastDailyResetAtMs =
        Number.isFinite(nowMs) && nowMs >= 0 && nowMs < 2 ** 52
          ? Math.min(state.lastDailyResetAtMs, nowMs)
          : state.lastDailyResetAtMs
    }
    this.state = {
      // Canonicalize to the declared element shape - a bypassed payload
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
            .map((entry) => this.withRuntimeClaimContext({
              questId: entry.questId,
              progress: entry.progress,
              claimed: entry.claimed,
              ...(entry.objectiveVersion === 1 && typeof entry.objectives === 'object' &&
                entry.objectives !== null && !Array.isArray(entry.objectives) ? {
                  objectiveVersion: 1 as const,
                  objectives: Object.fromEntries(Object.entries(entry.objectives).filter(
                    ([, count]) => Number.isFinite(count) && count >= 0,
                  )),
                } : {}),
            }))
        : [],

      // Same normalize contract as questFlags below - type-filter plus
      // dedup (markCompletedOnce dedups at the seam, so a bypassed
      // payload's duplicated id is unproducible and must not
      // self-replicate into future saves).
      completedOnceIds: Array.isArray(state.completedOnceIds)
        ? [...new Set(state.completedOnceIds.filter((id) => typeof id === 'string'))]
        : [],

      lastDailyResetAtMs,

      // Same normalize contract as completedOnceIds - type-filter plus
      // dedup so a bypassed payload cannot self-replicate flag rows.
      questFlags: Array.isArray(state.questFlags)
        ? [...new Set(state.questFlags.filter((id) => typeof id === 'string'))]
        : [],
    }
  }

  getState(): QuestManagerState {
    return this.state
  }
}
