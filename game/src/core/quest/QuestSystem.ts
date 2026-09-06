import type { Quest, QuestCondition } from './Quest'
import type { QuestRegistry } from './QuestRegistry'
import type { QuestManager } from './QuestManager'
import type { QuestProgress } from './QuestProgress'
import type { PlayerData } from '../player/Player'
import { getRealmIndex } from '../realm/realmSystem'
import type { RewardReceiver, RewardSystem } from '../reward/RewardSystem'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { MaterialBag } from '../material/MaterialBag'
import type { PillRegistry } from '../pill/PillRegistry'
import type { PillBag } from '../pill/PillBag'
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
}

function isUnlocked(quest: Quest, player: PlayerData): boolean {
  return !quest.requiredRealmId || getRealmIndex(player.realmId) >= getRealmIndex(quest.requiredRealmId)
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
   * Lazily activate mọi quest 'once' chưa hoàn thành + mọi quest
   * 'daily' đang trong rotation hôm nay (đã checkAndResetDaily trước
   * đó), tạo QuestProgress qua manager.ensureActive() khi cần.
   */
  getActiveQuests(
    registry: QuestRegistry,
    manager: QuestManager,
    player: PlayerData,
  ): { quest: Quest; progress: QuestProgress }[] {
    const result: { quest: Quest; progress: QuestProgress }[] = []

    for (const quest of registry.getAll()) {
      if (!isUnlocked(quest, player)) {
        continue
      }

      if (quest.cadence === 'once' && manager.isCompletedOnce(quest.id)) {
        continue
      }

      result.push({ quest, progress: manager.ensureActive(quest) })
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

    if (quest.condition.kind === 'collect') {
      bags.materialBag.remove(quest.condition.materialId, quest.condition.amount)
    }

    if (quest.reward.reward) {
      rewardSystem.give(receiver, quest.reward.reward)
    }

    for (const drop of quest.reward.itemDrops ?? []) {
      const amount = drop.amount ?? 1

      if (drop.kind === 'material' && bags.materialRegistry.has(drop.itemId)) {
        // 9.8 — tràn túi: quest chỉ tính delivered; push toast khi có sink.
        const template: Material = bags.materialRegistry.get(drop.itemId)
        const overflow = bags.materialBag.add(template, amount)

        const delivered = amount - overflow

        // Item turn-in của quest này cũng là material thu thập — tính
        // progress cho collect-quest khác đang active (cùng hook với
        // mọi đường material vào túi).
        this.onMaterialCollected(registry, manager, drop.itemId, delivered)

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
        bags.pillBag.add(bags.pillRegistry.get(drop.itemId), amount)
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
