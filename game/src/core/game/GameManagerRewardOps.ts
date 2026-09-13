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
import type { TechniqueManager } from '../technique/TechniqueManager'
import { getTechniqueInsightTotalRequired } from '../technique/TechniqueTier'

/**
 * Reward-issuing operations: the shared player RewardReceiver, equipped
 * technique insight, and the raw rewardSystem.give passthrough.
 * Extracted from GameManager (large-file split). The receiver contract
 * (insight into the equipped technique, spirit stones into MaterialBag at
 * the CURRENT realm tier with delivered-vs-overflow accounting + quest
 * notification) is unchanged - moved verbatim.
 */
export class GameManagerRewardOps {
  constructor(
    private readonly deps: {
      rewardSystem: RewardSystem
      techniqueManager: TechniqueManager
      materialRegistry: MaterialRegistry
      materialBag: MaterialBag
      notifications: NotificationQueue
      notifyQuestMaterialGained: (materialId: string, amount: number) => void
    },
  ) {}

  /**
   * Shared RewardReceiver for every direct-to-player reward (battle victory,
   * quest claim...): insight goes to the equipped technique, spirit stones go
   * to MaterialBag (Plan Workstream F).
   */
  buildPlayerRewardReceiver(player: PlayerData): RewardReceiver {
    return createPlayerRewardReceiver(
      player,
      (amount) => this.gainEquippedTechniqueInsight(amount),
      (amount) => {
        // Award the spirit-stone tier matching the CURRENT realm (same tier
        // breakthrough/enhance/building costs demand at that realm) - never a
        // fixed low tier that would strand high-realm players.
        const spiritStoneId = getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId))

        if (amount > 0 && this.deps.materialRegistry.has(spiritStoneId)) {
          // 9.8 - bag overflow: quests count only delivered + toast.
          const overflow = this.deps.materialBag.add(this.deps.materialRegistry.get(spiritStoneId), amount)

          this.deps.notifyQuestMaterialGained(spiritStoneId, amount - overflow)

          if (overflow > 0) {
            this.deps.notifications.push(
              createBagOverflowEvent(this.deps.materialRegistry.get(spiritStoneId).name, overflow),
            )
          }
        }
      },
    )
  }

  /**
   * Advances the equipped Phap Tu technique's insight (battle victory +
   * quest claim rewards alike, via buildPlayerRewardReceiver()).
   */
  gainEquippedTechniqueInsight(amount: number): number {
    const technique = this.deps.techniqueManager.getEquipped()

    if (!technique || amount <= 0) {
      return 0
    }

    const before = technique.insight ?? 0
    const cap = getTechniqueInsightTotalRequired(technique)
    technique.insight = Math.min(cap, before + amount)

    return technique.insight - before
  }

  giveReward(receiver: RewardReceiver, reward: Reward) {
    this.deps.rewardSystem.give(receiver, reward)
  }
}
