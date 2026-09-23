import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import type { NotificationQueue } from './NotificationQueue'
import { createBagOverflowEvent } from '../notification/bagOverflow'
import type { PlayerData } from '../player/Player'
import { createPlayerRewardReceiver } from '../player/Player'
import { getRealmTier } from '../realm/RealmTierMap'
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
      notifyMaterialGained: (materialId: string, amount: number) => void
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
        // Award the spirit-stone tier matching the CURRENT realm (same tier
        // breakthrough/enhance/building costs demand at that realm) - never a
        // fixed low tier that would strand high-realm players.
        const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))

        if (amount > 0 && this.deps.materialRegistry.has(spiritStoneId)) {
          // 9.8 - bag overflow: quests count only delivered + toast.
          const overflow = this.deps.materialBag.add(this.deps.materialRegistry.get(spiritStoneId), amount)

          this.deps.notifyMaterialGained(spiritStoneId, amount - overflow)

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
    this.deps.rewardSystem.give(receiver, reward)
  }
}
