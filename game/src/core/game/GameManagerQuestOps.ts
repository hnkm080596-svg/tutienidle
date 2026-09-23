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
  // GameManager giu activePlayer nhu field mutable (setActivePlayer) - doc
  // LIVE qua closure thay vi snapshot tai constructor time, giong
  // GameManagerBuildingOps.
  getActivePlayer: () => PlayerData | undefined
  // RewardReceiver dung chung cho moi noi cap Reward truc tiep cho player
  // (battle victory, claim quest...) - logic that (insight/Linh Thach) nam
  // ngoai pham vi QUEST section nen GameManager cung cap qua closure thay
  // vi tach theo.
  buildPlayerRewardReceiver: (player: PlayerData) => RewardReceiver
}

/**
 * Tach khoi GameManager (2026-09-03, task 4 - GameManager split) - toan bo
 * thao tac Quest (collect-quest hook, query active/canClaim, claim). Cung
 * pattern DI voi GameManagerAlchemyOps/GameManagerBuildingOps: constructor
 * nhan dependency tuong minh qua object `deps`, KHONG tu import nguoc
 * GameManager.
 */
export class GameManagerQuestOps {
  constructor(private readonly deps: GameManagerQuestOpsDeps) {}

  /**
   * Material-landing funnel (ex notifyQuestMaterialGained) - call
   * EVERY time a material lands in the player bag. Subscriber:
   * collect-quest progress (questSystem.onMaterialCollected). A
   * zero/negative delivered amount is not a landing: no subscriber
   * fires at all. NEVER call during save restore (double-count).
   * BattleLootSystem and every GameManager material-granting path
   * (production settle, building claim, Hoa Luyen, Linh Thach reward,
   * refund, change credit...) route through this helper.
   *
   * 2026-09-23 hidden-perfection-lineage sec.19: the perfection-material
   * discovery subscriber retired with BodyPerfection - HIDDEN-B/C
   * mechanisms own their own discovery events.
   */
  notifyMaterialGained(materialId: string, amount: number): void {
    if (amount <= 0) {
      return
    }

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
        // 9.8 - quest reward material tran tui -> push toast qua sink.
        notifications: this.deps.notifications,
        // M-F-BODY-PERFECTION - reward materials granted inside claim()
        // route back through THIS funnel (quest + discovery), instead of
        // the legacy direct onMaterialCollected call.
        onMaterialGained: (materialId, delivered) =>
          this.notifyMaterialGained(materialId, delivered),
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
