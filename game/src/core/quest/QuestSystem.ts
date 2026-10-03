import type { Quest, QuestCondition, QuestItemReward } from './Quest'
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
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { MaterialBag } from '../material/MaterialBag'
import type { PillRegistry } from '../pill/PillRegistry'
import type { PillBag } from '../pill/PillBag'
import { isBetaQuestEnabled } from '../betaScope'
// 9.8 — CHỈ import TYPE (không runtime import core/game) tránh dependency
// cycle: NotificationQueue sống ở core/game nhưng event type thuần.
import type { NotificationEvent } from '../notification/NotificationEvent'
import type { Material } from '../material/Material'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface QuestBagDeps {
  materialRegistry: MaterialRegistry
  materialBag: MaterialBag
  pillRegistry: PillRegistry
  pillBag: PillBag

  // 9.8 (optional) — caller có notification sink thì push toast khi
  // reward material tràn túi; không có thì bỏ qua (test/mock path).
  notifications?: { push: (event: NotificationEvent) => void }

  // M-F-BODY-PERFECTION (optional) - the ONE material-landing funnel.
  // When supplied, claim() routes reward-material deliveries through it
  // instead of calling onMaterialCollected directly, so quest progress
  // AND canonical discovery share exactly-once semantics. Absent
  // (test/mock path) falls back to the legacy direct call.
  onMaterialGained?: (materialId: string, delivered: number) => void

  // (optional) - realm of the claiming player; domain-scoped reward
  // materials (doan_bao_thach) consult isDomainScopedAcquisitionEnabled
  // against it - same window+reach rule as grantResolvedDrops. Absent
  // fails closed for domain-scoped rows (release-safe default).
  playerRealmId?: string
}

function isUnlocked(quest: Quest, player: PlayerData): boolean {
  // BETA SCOPE LOCK v2 sec.15 - the beta admission predicate composes at
  // the single activation seam: daily cadence and off-roster kill quests
  // never activate, and the reconcile inverse pass deactivates stale
  // progress for them automatically.
  return (
    isBetaQuestEnabled(quest) &&
    (!quest.requiredRealmId ||
      getRealmIndex(player.realmId) >= getRealmIndex(quest.requiredRealmId)) &&
    !questIsTokenOnlySource(quest)
  )
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
  return Math.floor(ms / MS_PER_DAY)
}

/**
 * Quest KHÔNG giữ state nội bộ (giống BuildingSystem) — registry/
 * manager/bags truyền theo từng method.
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
      if (!isUnlocked(quest, player)) {
        continue
      }

      if (quest.cadence === 'once' && manager.isCompletedOnce(quest.id)) {
        continue
      }

      manager.ensureActive(quest)
    }

    // P7-M9 - the inverse pass: a quest whose gate is no longer
    // satisfied must not keep stale active progress (e.g. restored from
    // a save written before its realm gate existed). Dropping it here -
    // the same lifecycle seam that activates - keeps progress events and
    // claims ineligible without touching their player-free signatures.
    // Progress re-arms from zero if the quest ever becomes eligible
    // again; 'once' completions are tracked separately and unaffected.
    for (const progress of [...manager.getActive()]) {
      if (registry.has(progress.questId) && !isUnlocked(registry.get(progress.questId), player)) {
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
      if (!isBetaQuestEnabled(quest)) {
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
    if (!isBetaQuestEnabled(quest)) {
      return undefined
    }

    if (!progress || progress.claimed || progress.progress < quest.condition.amount) {
      return undefined
    }

    if (quest.condition.kind === 'collect' && !bags.materialBag.has(quest.condition.materialId, quest.condition.amount)) {
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
   * Turn-in: collect quest tiêu hao vật phẩm khỏi bag khi claim. Trả
   * false nếu canClaim() false (chống double-claim, idempotent).
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

    if (!quest) {
      return false
    }

    // Mission E Task 3 (audit T1-11) - grant before debit: a throwing
    // grant must not consume the turn-in cost. The debit cannot fail a
    // leg that succeeded earlier (resolveClaimable already proved the
    // bag holds the cost). Drops run last so the debit frees bag space
    // before reward items land.
    if (quest.reward.reward) {
      rewardSystem.give(receiver, quest.reward.reward)
    }

    if (quest.condition.kind === 'collect') {
      bags.materialBag.remove(quest.condition.materialId, quest.condition.amount)
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
        // 9.8 — tràn túi: quest chỉ tính delivered; push toast khi có sink.
        const template: Material = bags.materialRegistry.get(drop.itemId)

        const overflow = bags.materialBag.add(template, amount)

        const delivered = amount - overflow

        // Item turn-in of this quest also counts as collected material -
        // progress for other active collect-quests (same hook as every
        // material-into-bag path). M-F-BODY-PERFECTION: prefer the
        // caller's funnel so discovery counts the same landing once.
        if (bags.onMaterialGained) {
          bags.onMaterialGained(drop.itemId, delivered)
        } else {
          this.onMaterialCollected(registry, manager, drop.itemId, delivered)
        }

        if (overflow > 0 && bags.notifications) {
          // Event dựng inline (fallback message vi — convention core):
          // chỉ import TYPE NotificationEvent, không runtime import.
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

    manager.markClaimed(questId)

    if (quest.cadence === 'once') {
      manager.markCompletedOnce(questId)
    }

    return true
  }

  /**
   * So sánh day-bucket UTC hiện tại với lastDailyResetAtMs — qua ngày
   * mới thì xoá progress 'daily' chưa claim + reset mốc. Không random
   * chọn quest (v1): "daily board" = mọi quest cadence 'daily' đang mở
   * khoá theo cảnh giới người chơi.
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
      .filter((quest) => quest.cadence === 'daily' && isUnlocked(quest, player))
      .map((quest) => quest.id)

    manager.resetDaily(dailyQuestIds, now)

    return true
  }

  /**
   * Gọi từ BattleLootSystem.processDefeatedEnemies() mỗi lần quái chết
   * thật sự cấp thưởng (Kiếp không tính). Tăng progress mọi kill-quest
   * ĐANG active, chưa claim, có enemyId/zoneId khớp (hoặc bỏ trống).
   */
  onEnemyDefeated(
    registry: QuestRegistry,
    manager: QuestManager,
    enemyId: string,
    zoneId: string | undefined,
  ): void {
    for (const progress of manager.getActive()) {
      if (progress.claimed || !registry.has(progress.questId)) {
        continue
      }

      const condition: QuestCondition = registry.get(progress.questId).condition

      if (condition.kind !== 'kill') {
        continue
      }

      if (condition.enemyId && condition.enemyId !== enemyId) {
        continue
      }

      if (condition.zoneId && condition.zoneId !== zoneId) {
        continue
      }

      manager.incrementProgress(progress.questId, 1)
    }
  }

  /**
   * Gọi MỖI KHI material vào túi người chơi (production settle, loot quái,
   * claim toà nhà, Hóa Luyện, quest turn-in trả item...) — tăng progress
   * collect-quest ĐANG active, chưa claim, có materialId khớp.
   *
   * KHÔNG gọi khi restore từ save (double-count) — review 2026-08-28 bug #3:
   * trước đây collect-quest không có hook nào nên progress mãi 0/N,
   * reward không bao giờ claim được.
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

    for (const progress of manager.getActive()) {
      if (progress.claimed || !registry.has(progress.questId)) {
        continue
      }

      const condition: QuestCondition = registry.get(progress.questId).condition

      if (condition.kind !== 'collect') {
        continue
      }

      if (condition.materialId !== materialId) {
        continue
      }

      manager.incrementProgress(progress.questId, amount)
    }
  }
}
