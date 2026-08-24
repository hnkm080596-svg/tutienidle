import type { Reward } from './Reward'

export interface RewardReceiver {
  addTechniqueInsight(amount: number): void

  addCultivation(amount: number): void

  addSpiritStone(amount: number): void
}

export class RewardSystem {
  give(
    receiver: RewardReceiver,
    reward: Reward,
  ) {
    if (reward.techniqueInsight !== undefined) {
      receiver.addTechniqueInsight(
        reward.techniqueInsight,
      )
    }

    if (reward.cultivation !== undefined) {
      receiver.addCultivation(
        reward.cultivation,
      )
    }

    if (reward.spiritStone !== undefined) {
      receiver.addSpiritStone(
        reward.spiritStone,
      )
    }
  }
}