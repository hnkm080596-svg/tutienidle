import type { MaterialReceipt } from '../material/MaterialReceipt'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import type { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'
import type { PlayerData } from '../player/Player'
import { createPlayerRewardReceiver } from '../player/Player'
import type { Reward } from '../reward/Reward'
import type { RewardReceiver, RewardSystem } from '../reward/RewardSystem'

/**
 * Reward-issuing operations: the shared player RewardReceiver and the
 * raw rewardSystem.give passthrough. Extracted from GameManager
 * (large-file split). P7-M3: the receiver's skill-insight channel feeds
 * player.skillInsight directly (technique mastery is a separate battle
 * channel settled by BattleLootSystem); spirit stones go to MaterialBag
 * at the CURRENT realm tier with delivered-vs-overflow accounting +
 * quest notification.
 */
export class GameManagerRewardOps {
  constructor(
    private readonly deps: {
      rewardSystem: RewardSystem
      materialRegistry: MaterialRegistry
      materialBag: MaterialBag
      notifications: NotificationQueue
      notifyMaterialGained: (materialId: string, amount: number, receipt: MaterialReceipt | null) => void
    },
  ) {}

  /**
   * Shared RewardReceiver for every direct-to-player reward (battle victory,
   * quest claim...): skill insight goes to player.skillInsight, spirit
   * stones go to MaterialBag (Plan Workstream F).
   */
  buildPlayerRewardReceiver(player: PlayerData): RewardReceiver {
    return createPlayerRewardReceiver(
      player,
      (amount) => {
        // Same accounting as the per-kill battle path in
        // BattleLootSystem.processDefeatedEnemies().
        player.skillInsight += amount
        player.totalSkillInsightGained += amount
      },
      (amount) => {
        // Flatten (2026-10-11): one spirit stone id, no realm tier.
        const spiritStoneId = SPIRIT_STONE_MATERIAL_ID

        if (amount > 0 && this.deps.materialRegistry.has(spiritStoneId)) {
          // 9.8 - bag overflow: quests count only delivered + toast.
          const { overflow, receipt } = this.deps.materialBag.credit(this.deps.materialRegistry.get(spiritStoneId), amount)

          this.deps.notifyMaterialGained(spiritStoneId, amount - overflow, receipt)

          if (overflow > 0) {
            this.deps.notifications.push(
              createBagOverflowEvent(this.deps.materialRegistry.get(spiritStoneId).name, overflow),
            )
          }
        }
      },
    )
  }
  giveReward(receiver: RewardReceiver, reward: Reward) {
    return this.deps.materialBag.withAcquisition<void>(() => {
    this.deps.rewardSystem.give(receiver, reward)

    })
  }
}
