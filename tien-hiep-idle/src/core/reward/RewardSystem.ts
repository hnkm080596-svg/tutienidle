import type { Reward } from './Reward'

export interface RewardReceiver {
  addExperience(amount: number): void

  addCultivation(amount: number): void

  addSpiritStone(amount: number): void
}

export class RewardSystem {
  give(
    receiver: RewardReceiver,
    reward: Reward,
  ) {
    if (reward.experience !== undefined) {
      receiver.addExperience(
        reward.experience,
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