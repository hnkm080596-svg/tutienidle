import type { MaterialReceipt } from '../material/MaterialReceipt'
import type { Quest, QuestLeafCondition, QuestItemReward, QuestObjective } from './Quest'
import { isValidQuestCondition, questObjectives } from './Quest'
import type { QuestRegistry } from './QuestRegistry'
import type { QuestManager } from './QuestManager'
import type { QuestProgress } from './QuestProgress'
import type { PlayerData } from '../player/Player'
import { getRealmIndex } from '../realm/realmSystem'
import {
  isBreakthroughAcquisitionEnabled,
  isDomainScopedAcquisitionEnabled,
  isCompanionPullTokenSourceSuppressed,
} from '../realm/ReleasePolicy'
import type { RewardReceiver, RewardSystem } from '../reward/RewardSystem'
import type { Reward } from '../reward/Reward'
import { stoneCostRealmFactor } from '../economy/EconomyRealmPace'
import { utcDayBucket, utcWeekBucket } from '../idle/GameClock'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { MaterialBag } from '../material/MaterialBag'
import type { PillRegistry } from '../pill/PillRegistry'
import type { PillBag } from '../pill/PillBag'
import { isBetaQuestEnabled } from '../betaScope'
// 9.8 - CHI import TYPE (khong runtime import core/game) tranh dependency
// cycle: NotificationQueue song o core/game nhung event type thuan.
import type { NotificationEvent } from '../notification/NotificationEvent'
import type { Material } from '../material/Material'

// r10-AUT: the canonical UTC day-bucket convention lives in
// GameClock.utcDayBucket - every daily-reset surface (quest daily
// reset, idle insight ledger) must agree on the same boundary.

export interface QuestBagDeps {
  materialRegistry: MaterialRegistry
  materialBag: MaterialBag
  pillRegistry: PillRegistry
  pillBag: PillBag

  // 9.8 (optional) - caller co notification sink thi push toast khi
  // reward material tran tui; khong co thi bo qua (test/mock path).
  notifications?: { push: (event: NotificationEvent) => void }

  // M-F-BODY-PERFECTION (optional) - the ONE material-landing funnel.
  // When supplied, claim() routes reward-material deliveries through it
  // instead of calling onMaterialCollected directly, so quest progress
  // AND canonical discovery share exactly-once semantics. Absent
  // (test/mock path) falls back to the legacy direct call.
  onMaterialGained?: (materialId: string, delivered: number, receipt: MaterialReceipt | null) => void

  // (optional) - realm of the claiming player; domain-scoped reward
  // materials (doan_bao_thach) consult isDomainScopedAcquisitionEnabled
  // against it - same window+reach rule as grantResolvedDrops. Absent
  // fails closed for domain-scoped rows (release-safe default).
  playerRealmId?: string

  // The caller owns rollback of ALL authoritative state touched by this
  // synchronous claim, including the receiver and item delivery hooks.
  withAtomicClaim?: <T>(settle: () => T) => T
  onClaimed?: (quest: Quest) => void
}

function isUnlocked(quest: Quest, player: PlayerData, manager: QuestManager): boolean {
  // BETA SCOPE LOCK v2 sec.15 - the beta admission predicate composes at
  // the single activation seam: daily cadence and off-roster kill quests
  // never activate, and the reconcile inverse pass deactivates stale
  // progress for them automatically.
  //
  // Progression gates (requiredRealmId, unlocksAfterQuestId) gate NEW
  // ADMISSION only - an entry already in `active` is judged by
  // staysLive() instead. Chain clause (mainline): a quest gated by
  // unlocksAfterQuestId stays locked until its predecessor sits in
  // completedOnceIds - the durable witness written exactly once at claim.
  return (
    staysLive(quest) &&
    (!quest.requiredRealmId ||
      getRealmIndex(player.realmId) >= getRealmIndex(quest.requiredRealmId)) &&
    (quest.unlocksAfterQuestId === undefined ||
      manager.isCompletedOnce(quest.unlocksAfterQuestId))
  )
}

// Retention predicate for the reconcile inverse pass. An in-flight,
// progress-bearing row is never evicted by a progression gate: the chain
// gate guards admission only (a pre-fold carried save keeps its partial
// collect progress until the chain reaches it), and a realm gate added
// after a save was written must not wipe that save's in-flight work
// either - the row stays and completes at the gated realm. Only
// product-level retirement still evicts: scope-hidden quests (BETA
// SCOPE LOCK v2 sec.15) and suppressed token-faucet quests have no live
// counter left at all.
function staysLive(quest: Quest): boolean {
  return isValidQuestCondition(quest.condition) &&
    questObjectives(quest.condition).every((condition) =>
      isBetaQuestEnabled({ cadence: quest.cadence, condition })) &&
    !questIsTokenOnlySource(quest)
}

export function questObjectiveProgress(
  quest: Quest, progress: QuestProgress, objective: QuestObjective,
): number {
  let count = progress.progress
  if (quest.condition.kind === 'allOf') {
    count = 0
    if (progress.objectiveVersion === 1 && progress.objectives &&
        Object.hasOwn(progress.objectives, objective.id)) {
      count = progress.objectives[objective.id] ?? 0
    }
  }
  return typeof count === 'number' && Number.isFinite(count) && count >= 0 ? count : 0
}

export function questTurnInCosts(quest: Quest): ReadonlyMap<string, number> {
  const costs = new Map<string, number>()
  for (const leaf of questObjectives(quest.condition)) {
    if (leaf.kind === 'collect') {
      costs.set(leaf.materialId, (costs.get(leaf.materialId) ?? 0) + leaf.amount)
    }
  }
  return costs
}

export type QuestClaimDisabledReason =
  | 'already-claimed' | 'incomplete' | 'missing-turnin-items' | 'claim-in-progress'

// Shared owner rule for commit and the pure read model.
export function questClaimDisabledReason(
  quest: Quest, progress: QuestProgress, bag: MaterialBag,
): QuestClaimDisabledReason | null {
  if (progress.claimed) return 'already-claimed'
  if (progress.claimInProgress) return 'claim-in-progress'
  if (!isValidQuestCondition(quest.condition) || questObjectives(quest.condition).some(
    (leaf) => questObjectiveProgress(quest, progress, leaf) < leaf.amount,
  )) return 'incomplete'
  for (const [materialId, amount] of questTurnInCosts(quest)) {
    if (!Number.isSafeInteger(amount) || !bag.has(materialId, amount)) return 'missing-turnin-items'
  }
  return null
}

/**
 * BETA FE-CONTRACT (work-order sec.4B) - the ONE ReleasePolicy
 * admission predicate for a quest item-drop reward line. claim()
 * applies it before delivering a drop; the quest read-model emits only
 * admitted lines as the reward preview. A line this rejects is never
 * previewed and never delivered - the frontend never reconstructs
 * admission itself (A9: same predicates, never a second copy).
 * Unknown item ids fail closed.
 */
export function isQuestRewardDropAdmitted(
  drop: QuestItemReward,
  registries: Pick<QuestBagDeps, 'materialRegistry' | 'pillRegistry'>,
  playerRealmId: string | undefined,
): boolean {
  if (drop.kind === 'material') {
    if (!registries.materialRegistry.has(drop.itemId)) {
      return false
    }

    const template = registries.materialRegistry.get(drop.itemId)

    // M-F-CEILING - breakthrough-scoped reward stays dormant while
    // release policy closes the transition into its tagged realm.
    if (!isBreakthroughAcquisitionEnabled(template.breakthroughRealmId)) {
      return false
    }

    // M-F-COMPANION-GIFT - censused pull-token reward lines stay dormant
    // while the pull pool is closed; sibling lines still land.
    if (isCompanionPullTokenSourceSuppressed(drop.itemId)) {
      return false
    }

    // M-F-ARTIFACT-DEFER - domain-scoped reward materials
    // (doan_bao_thach) compose the window+reach rule against the
    // claiming player's realm - same gate as grantResolvedDrops.
    if (!isDomainScopedAcquisitionEnabled(template.domainUnlockRealmId, playerRealmId)) {
      return false
    }

    return true
  }

  if (drop.kind === 'pill') {
    if (!registries.pillRegistry.has(drop.itemId)) {
      return false
    }

    // M-F-CEILING - same release-policy suppression as the material
    // branch above.
    return isBreakthroughAcquisitionEnabled(
      registries.pillRegistry.get(drop.itemId).breakthroughRealmId,
    )
  }

  return false
}

// Minh ruling 2026-10-05 (reward-channels worker, "thuong quest nang
// theo canh gioi"): flat quest currency was decorative against era
// income. spiritStone and cultivation scale by the QUEST's realm band
// via stoneCostRealmFactor - the single economy authority already
// used for per-era cost/reward jumps (x1 mortal / x8 Luyen Khi /
// x50 Truc Co).
//
// Band derivation follows the codebase's OWN progression convention:
// quest.requiredRealmId gates which era a quest belongs to. A quest
// with no realm gate still belongs to an era through its unlock chain
// (unlocksAfterQuestId - e.g. main_08 can only unlock after main_07's
// qi_refining gate, so it IS a qi-era quest): walk the chain to the
// nearest gated ancestor. An ungated, unchained quest (or an
// unresolvable chain on a partial registry) is mortal-era.
// Cycle-safe: chain cycles or registry misses stop the walk.
export function questRewardBandRealmId(
  quest: Quest,
  registry?: Pick<QuestRegistry, 'has' | 'get'>,
): string {
  let cursor: Quest | undefined = quest
  const seen = new Set<string>()

  while (cursor !== undefined && !seen.has(cursor.id)) {
    if (cursor.requiredRealmId !== undefined) {
      return cursor.requiredRealmId
    }

    seen.add(cursor.id)
    const nextId: string | undefined = cursor.unlocksAfterQuestId
    cursor =
      nextId !== undefined && registry !== undefined && registry.has(nextId)
        ? registry.get(nextId)
        : undefined
  }

  return 'mortal'
}

// skillInsight is NOT scaled here: data/quest/quests.ts already
// re-anchored those values per era (QI 400-800, TC 6k-40k - the same
// ~x50 band jump), so multiplying again would double-count.
// itemDrops (material/pill counts) stay authored counts.
export function scaleQuestRewardByRealm(
  reward: Reward,
  questRealmId: string | undefined,
): Reward {
  const factor = stoneCostRealmFactor(questRealmId ?? 'mortal')

  if (factor === 1) {
    return reward
  }

  return {
    spiritStone:
      reward.spiritStone !== undefined ? Math.floor(reward.spiritStone * factor) : undefined,
    cultivation:
      reward.cultivation !== undefined ? Math.floor(reward.cultivation * factor) : undefined,
    skillInsight: reward.skillInsight,
  }
}

// M-F-COMPANION-GIFT - a quest whose ENTIRE reward set is censused
// pull-token material lines is a pure token faucet; while the pull pool
// is closed it never activates (the recurring source is suppressed at
// origination). Mixed-reward quests stay unlocked - only their token
// lines are filtered at claim below.
function questIsTokenOnlySource(quest: Quest): boolean {
  const itemDrops = quest.reward.itemDrops ?? []
  return (
    itemDrops.length > 0 &&
    quest.reward.reward === undefined &&
    itemDrops.every(
      (drop) =>
        drop.kind === 'material' && isCompanionPullTokenSourceSuppressed(drop.itemId),
    )
  )
}

function dayBucket(ms: number): number {
  return utcDayBucket(ms)
}

function weekBucket(ms: number): number {
  return ms <= 0 ? -2 : utcWeekBucket(ms)
}

/**
 * Quest KHONG giu state noi bo (giong BuildingSystem) - registry/
 * manager/bags truyen theo tung method.
 */
export class QuestSystem {
  /**
   * R8.1 (AR-09) - lifecycle command: activate every eligible quest
   * exactly once. Triggers: boot/restore, daily rollover, realm unlock
   * transition. Idempotent. NOT a query - reads never call this.
   *
   * Preserved semantics: counting starts from activation; no
   * retroactive credit for kills/collects before activation; 'once'
   * quests never reappear after completion.
   */
  reconcileActiveQuests(
    registry: QuestRegistry,
    manager: QuestManager,
    player: PlayerData,
  ): void {
    for (const quest of registry.getAll()) {
      if (!isUnlocked(quest, player, manager)) {
        continue
      }

      if (quest.cadence === 'once' && manager.isCompletedOnce(quest.id)) {
        continue
      }

      manager.ensureActive(quest)
    }

    // Durable state witnesses may predate admission. Event leaves never
    // infer credit from possession or from opening a projection.
    for (const progress of manager.getActive()) {
      if (progress.claimed || !registry.has(progress.questId)) continue
      const quest = registry.get(progress.questId)
      if (!staysLive(quest)) continue
      for (const leaf of questObjectives(quest.condition)) {
        const attained = leaf.kind === 'realm_reached'
          ? getRealmIndex(leaf.realmId) >= 0 && getRealmIndex(player.realmId) >= getRealmIndex(leaf.realmId)
          : leaf.kind === 'stage_clear' && player.completedStageIds?.includes(leaf.stageId)
        if (!attained) continue
        if (quest.condition.kind === 'allOf') {
          manager.incrementObjective(quest.id, leaf.id, 1, 1)
        } else if (progress.progress < 1) {
          manager.incrementProgress(quest.id, 1)
        }
      }
    }

    // P7-M9 - the inverse pass, narrowed to product retirement
    // (QA-2026-10-03-1): only a quest the product itself no longer
    // offers (scope-hidden or suppressed token faucet) loses its
    // active row here. Progression gates no longer evict - an
    // in-flight row stays live until claimed (e.g. a carried save's
    // fold-in collect quest keeps its progress until the chain
    // reaches it). 'once' completions are tracked separately in
    // completedOnceIds and are unaffected.
    for (const progress of [...manager.getActive()]) {
      if (registry.has(progress.questId) && !staysLive(registry.get(progress.questId))) {
        manager.deactivate(progress.questId)
      }
    }
  }

  /**
   * R8.1 (AR-09) - read-only projection: NO side effects. Activation
   * belongs to reconcileActiveQuests; a query must never mutate quest
   * state (AGENTS.md A3/A7 query purity). Returns quests that ALREADY
   * have active progress only.
   */
  getActiveQuests(
    registry: QuestRegistry,
    manager: QuestManager,
    // Kept in the signature to mirror reconcileActiveQuests (same query
    // shape for callers); the pure read does not consume player state.
    _player: PlayerData,
  ): { quest: Quest; progress: QuestProgress }[] {
    const result: { quest: Quest; progress: QuestProgress }[] = []

    for (const quest of registry.getAll()) {
      const progress = manager.getProgress(quest.id)

      if (!progress) {
        continue
      }

      // BETA SCOPE LOCK v2 sec.15 - scope-hidden quests never render in
      // the active projection even if stale progress exists between
      // reconcile runs (still read-only: no state is touched here).
      if (!staysLive(quest)) {
        continue
      }

      result.push({ quest, progress })
    }

    return result
  }

  getProgress(manager: QuestManager, questId: string): QuestProgress | undefined {
    return manager.getProgress(questId)
  }

  private resolveClaimable(
    registry: QuestRegistry,
    manager: QuestManager,
    bags: QuestBagDeps,
    questId: string,
  ): Quest | undefined {
    if (!registry.has(questId)) {
      return undefined
    }

    const quest = registry.get(questId)
    const progress = manager.getProgress(questId)

    // BETA SCOPE LOCK v2 sec.15 - claim fails closed on a scope-hidden
    // quest even if stale progress sits claimable (pre-flag saves).
    if (!staysLive(quest) || (quest.cadence === 'once' && manager.isCompletedOnce(questId))) {
      return undefined
    }

    if (!progress || manager.isClaiming() ||
        questClaimDisabledReason(quest, progress, bags.materialBag) !== null) {
      return undefined
    }

    return quest
  }

  canClaim(
    registry: QuestRegistry,
    manager: QuestManager,
    bags: QuestBagDeps,
    questId: string,
  ): boolean {
    return this.resolveClaimable(registry, manager, bags, questId) !== undefined
  }

  /**
   * Turn-in: collect quest tieu hao vat pham khoi bag khi claim. Tra
   * false neu canClaim() false (chong double-claim, idempotent).
   */
  claim(
    registry: QuestRegistry,
    manager: QuestManager,
    rewardSystem: RewardSystem,
    receiver: RewardReceiver,
    bags: QuestBagDeps,
    questId: string,
  ): boolean {
    const quest = this.resolveClaimable(registry, manager, bags, questId)

    if (!quest || !manager.beginClaim(questId)) {
      return false
    }

    try {
      if (!bags.withAtomicClaim) {
        throw new Error('Quest claim requires an atomic settlement boundary')
      }
      const settle = (): boolean => {
      // Grant before debit; the claim checkpoint reverses either operation
      // if a later step fails. Recheck each turn-in debit despite the
      // earlier eligibility check, since receiver callbacks can mutate bags.
      // Drops run last so turn-in costs free bag space first.
      if (quest.reward.reward) {
        // 2026-10-05 realm-band scaling - same helper+resolver the beta
        // surface read-model previews, so previewed amounts equal paid.
        rewardSystem.give(
          receiver,
          scaleQuestRewardByRealm(quest.reward.reward, questRewardBandRealmId(quest, registry)),
        )
      }

      for (const [materialId, amount] of questTurnInCosts(quest)) {
        if (!bags.materialBag.remove(materialId, amount)) {
          throw new Error(`Quest turn-in debit failed: ${materialId}`)
        }
      }

      for (const drop of quest.reward.itemDrops ?? []) {
        const amount = drop.amount ?? 1

        // sec.4B - ONE admission predicate shared with the quest surface
        // read-model (release windows, pull-token suppression, domain
        // scoping, unknown ids) - this loop never re-derives policy.
        if (!isQuestRewardDropAdmitted(drop, bags, bags.playerRealmId)) {
          continue
        }

        if (drop.kind === 'material' && bags.materialRegistry.has(drop.itemId)) {
          // 9.8 - tran tui: quest chi tinh delivered; push toast khi co sink.
          const template: Material = bags.materialRegistry.get(drop.itemId)

          const { overflow, receipt } = bags.materialBag.credit(template, amount)

          const delivered = amount - overflow

          // Item turn-in of this quest also counts as collected material -
          // progress for other active collect-quests (same hook as every
          // material-into-bag path). M-F-BODY-PERFECTION: prefer the
          // caller's funnel so discovery counts the same landing once.
          if (bags.onMaterialGained) {
            bags.onMaterialGained(drop.itemId, delivered, receipt)
          } else {
            manager.consumeMaterialGrant({ sequence: receipt?.sequence ?? bags.materialBag.receiptSnapshot().sequence,
              playerId: bags.materialBag.receiptSnapshot().playerId, runId: bags.materialBag.receiptSnapshot().runId,
              sourceId: receipt?.sourceId ?? 'overflow', materialId: drop.itemId, requested: amount, overflow, receipt }, () =>
              this.onMaterialCollected(registry, manager, drop.itemId, delivered))
          }

          if (overflow > 0 && bags.notifications) {
            // Event dung inline (fallback message vi - convention core):
            // chi import TYPE NotificationEvent, khong runtime import.
            const overflowEvent: NotificationEvent = {
              kind: 'warning',

              message: `Túi đầy — mất ${overflow} ${template.name}`,

              messageKey: 'bag.overflow',

              messageParams: { amount: String(overflow), name: template.name },
            }

            bags.notifications.push(overflowEvent)
          }
        }

        if (drop.kind === 'pill' && bags.pillRegistry.has(drop.itemId)) {
          // R9 (AR-34) - pill drops surface the delivery receipt too: quest
          // rewards must not silently lose pills to a full bag.
          const pillTemplate = bags.pillRegistry.get(drop.itemId)

          const pillOverflow = bags.pillBag.add(pillTemplate, amount)

          if (pillOverflow > 0 && bags.notifications) {
            const pillOverflowEvent: NotificationEvent = {
              kind: 'warning',

              message: `Túi đan đầy - mất ${pillOverflow} ${pillTemplate.name}`,

              messageKey: 'bag.overflow',

              messageParams: { amount: String(pillOverflow), name: pillTemplate.name },
            }

            bags.notifications.push(pillOverflowEvent)
          }
        }
      }

      // Reward arrivals belong to the carried active set. Consume before
      // onClaimed admits successors; a failed consumer cancels this claim.
      bags.materialBag.flushDeliveries()
      manager.markClaimed(questId)

      if (quest.cadence === 'once') {
        manager.markCompletedOnce(questId)
      }

      // Post-claim observers also belong to the reversible settlement.
      bags.onClaimed?.(quest)
      return true
      }

      return bags.withAtomicClaim(() => bags.materialBag.withAcquisition(settle))
    } finally {
      manager.endClaim(questId)
    }
  }

  /**
   * So sanh day-bucket UTC hien tai voi lastDailyResetAtMs - qua ngay
   * moi thi xoa progress 'daily' chua claim + reset moc. Khong random
   * chon quest (v1): "daily board" = moi quest cadence 'daily' dang mo
   * khoa theo canh gioi nguoi choi.
   */
  checkAndResetDaily(
    registry: QuestRegistry,
    manager: QuestManager,
    player: PlayerData,
    now: number = Date.now(),
  ): boolean {
    if (dayBucket(now) <= dayBucket(manager.getLastDailyResetAtMs())) {
      return false
    }

    const dailyQuestIds = registry
      .getAll()
      .filter((quest) => quest.cadence === 'daily' && isUnlocked(quest, player, manager))
      .map((quest) => quest.id)

    manager.resetDaily(dailyQuestIds, now)

    return true
  }

  /**
   * Compare current UTC week-bucket against lastWeeklyResetAtMs - on a
   * new week, clear active 'weekly' entries and advance the reset stamp.
   */
  checkAndResetWeekly(
    registry: QuestRegistry,
    manager: QuestManager,
    player: PlayerData,
    now: number = Date.now(),
  ): boolean {
    if (weekBucket(now) <= weekBucket(manager.getLastWeeklyResetAtMs())) {
      return false
    }

    const weeklyQuestIds = registry
      .getAll()
      .filter((quest) => quest.cadence === 'weekly' && isUnlocked(quest, player, manager))
      .map((quest) => quest.id)

    manager.resetWeekly(weeklyQuestIds, now)

    return true
  }

  /**
   * Goi tu BattleLootSystem.processDefeatedEnemies() moi lan quai chet
   * that su cap thuong (Kiep khong tinh). Tang progress moi kill-quest
   * DANG active, chua claim, co enemyId/zoneId khop (hoac bo trong).
   */
  onEnemyDefeated(
    registry: QuestRegistry,
    manager: QuestManager,
    enemyId: string,
    zoneId: string | undefined,
  ): void {
    this.incrementMatching(registry, manager, 1, (condition) =>
      condition.kind === 'kill' &&
      (!condition.enemyId || condition.enemyId === enemyId) &&
      (!condition.zoneId || condition.zoneId === zoneId))
  }

  /**
   * Goi MOI KHI material vao tui nguoi choi (production settle, loot quai,
   * claim toa nha, Hoa Luyen, quest turn-in tra item...) - tang progress
   * collect-quest DANG active, chua claim, co materialId khop.
   *
   * KHONG goi khi restore tu save (double-count) - review 2026-08-28 bug #3:
   * truoc day collect-quest khong co hook nao nen progress mai 0/N,
   * reward khong bao gio claim duoc.
   */
  onMaterialCollected(
    registry: QuestRegistry,
    manager: QuestManager,
    materialId: string,
    amount: number,
  ): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      return
    }

    this.incrementMatching(registry, manager, amount, (condition) =>
      (condition.kind === 'collect' || condition.kind === 'acquire') &&
      condition.materialId === materialId)
  }

  /**
   * Goi tu domain seam khi mot feature-witness xay ra (alchemy settle
   * thanh cong -> QUEST_FLAG_ALCHEMY_CRAFTED). Records the durable
   * witness (questFlags) and increments every ACTIVE, unclaimed
   * flag-quest whose flagId matches - same activation-counts rule as
   * onEnemyDefeated/onMaterialCollected: a flag landing before the
   * quest activates earns no retroactive credit.
   */
  onFlag(
    registry: QuestRegistry,
    manager: QuestManager,
    flagId: string,
  ): void {
    manager.markQuestFlag(flagId)

    this.incrementMatching(registry, manager, 1, (condition) =>
      condition.kind === 'flag' && condition.flagId === flagId)
  }

  private incrementMatching(
    registry: QuestRegistry,
    manager: QuestManager,
    amount: number,
    matches: (condition: QuestLeafCondition) => boolean,
  ): void {
    for (const progress of manager.getActive()) {
      if (progress.claimed || !registry.has(progress.questId)) continue
      const quest = registry.get(progress.questId)
      if (!staysLive(quest) || (quest.cadence === 'once' && manager.isCompletedOnce(quest.id))) continue
      for (const leaf of questObjectives(quest.condition)) {
        if (!matches(leaf)) continue
        if (quest.condition.kind === 'allOf') {
          manager.incrementObjective(quest.id, leaf.id, amount, leaf.amount)
        } else {
          manager.incrementProgress(quest.id, amount,
            leaf.kind === 'acquire' ? leaf.amount : undefined)
        }
      }
    }
  }

}
