import { QuestRegistry } from '../quest/QuestRegistry'
import { QuestManager } from '../quest/QuestManager'
import { QuestSystem } from '../quest/QuestSystem'
import type { Quest } from '../quest/Quest'
import type { QuestProgress } from '../quest/QuestProgress'
import { RewardSystem } from '../reward/RewardSystem'
import type { RewardReceiver } from '../reward/RewardSystem'
import { MaterialRegistry } from '../material/MaterialRegistry'
import { MaterialBag } from '../material/MaterialBag'
import { PillRegistry } from '../pill/PillRegistry'
import { PillBag } from '../pill/PillBag'
import { NotificationQueue } from './NotificationQueue'
import type { PlayerData } from '../player/Player'

export interface GameManagerQuestOpsDeps {
  questSystem: QuestSystem
  questRegistry: QuestRegistry
  questManager: QuestManager
  rewardSystem: RewardSystem
  materialRegistry: MaterialRegistry
  materialBag: MaterialBag
  pillRegistry: PillRegistry
  pillBag: PillBag
  notifications: NotificationQueue
  // GameManager giữ activePlayer như field mutable (setActivePlayer) — đọc
  // LIVE qua closure thay vì snapshot tại constructor time, giống
  // GameManagerBuildingOps.
  getActivePlayer: () => PlayerData | undefined
  // RewardReceiver dùng chung cho mọi nơi cấp Reward trực tiếp cho player
  // (battle victory, claim quest...) — logic thật (insight/Linh Thạch) nằm
  // ngoài phạm vi QUEST section nên GameManager cung cấp qua closure thay
  // vì tách theo.
  buildPlayerRewardReceiver: (player: PlayerData) => RewardReceiver
}

/**
 * Tách khỏi GameManager (2026-09-03, task 4 — GameManager split) — toàn bộ
 * thao tác Quest (collect-quest hook, query active/canClaim, claim). Cùng
 * pattern DI với GameManagerAlchemyOps/GameManagerBuildingOps: constructor
 * nhận dependency tường minh qua object `deps`, KHÔNG tự import ngược
 * GameManager.
 */
export class GameManagerQuestOps {
  constructor(private readonly deps: GameManagerQuestOpsDeps) {}

  /**
   * Collect-quest hook (review 2026-08-28 bug #3) — gọi MỖI KHI material
   * vào túi người chơi để tăng progress collect-quest đang active. KHÔNG
   * gọi khi restore từ save (double-count). BattleLootSystem tự gọi trực
   * tiếp (có deps quest); các đường cộng material còn lại của GameManager
   * (production settle, claim toà nhà, Hóa Luyện, Linh Thạch reward...)
   * đi qua helper này.
   */
  notifyQuestMaterialGained(materialId: string, amount: number): void {
    this.deps.questSystem.onMaterialCollected(
      this.deps.questRegistry,
      this.deps.questManager,
      materialId,
      amount,
    )
  }

  getActiveQuests(): { quest: Quest; progress: QuestProgress }[] {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return []
    }

    return this.deps.questSystem.getActiveQuests(this.deps.questRegistry, this.deps.questManager, player)
  }

  canClaimQuest(questId: string): boolean {
    return this.deps.questSystem.canClaim(
      this.deps.questRegistry,
      this.deps.questManager,
      {
        materialRegistry: this.deps.materialRegistry,
        materialBag: this.deps.materialBag,
        pillRegistry: this.deps.pillRegistry,
        pillBag: this.deps.pillBag,
      },
      questId,
    )
  }

  claimQuest(questId: string): boolean {
    const player = this.deps.getActivePlayer()

    if (!player) {
      return false
    }

    const receiver = this.deps.buildPlayerRewardReceiver(player)

    const claimed = this.deps.questSystem.claim(
      this.deps.questRegistry,
      this.deps.questManager,
      this.deps.rewardSystem,
      receiver,
      {
        materialRegistry: this.deps.materialRegistry,
        materialBag: this.deps.materialBag,
        pillRegistry: this.deps.pillRegistry,
        pillBag: this.deps.pillBag,
      },
      questId,
    )

    if (claimed) {
      const quest = this.deps.questRegistry.get(questId)
      this.deps.notifications.push({ kind: 'loot', message: `Hoàn thành: ${quest.name}` })
    }

    return claimed
  }
}
