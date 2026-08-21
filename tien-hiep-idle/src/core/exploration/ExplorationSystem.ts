import type { Exploration } from './Exploration'
import type { ExplorationMaterialReward } from './ExplorationReward'
import type { ExplorationResult } from './ExplorationResult'
import { ExplorationManager } from './ExplorationManager'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import { randomInt, rollChance } from '../reward/DropRoll'

export class ExplorationSystem {
  constructor(
    private readonly manager: ExplorationManager,

    private readonly inventory: MaterialBag,

    private readonly materialRegistry: MaterialRegistry,
  ) {}

  start(exploration: Exploration, currentTime: number): boolean {
    return this.manager.start(exploration, currentTime)
  }

  collect(
    exploration: Exploration,

    rewards: ExplorationMaterialReward[],

    currentTime: number,
  ): ExplorationResult {
    const active = this.manager.get(exploration.id)

    if (!active) {
      return {
        explorationId: exploration.id,

        elapsedSeconds: 0,

        completedRuns: 0,

        materials: [],
      }
    }

    const elapsedSeconds = Math.max(
      0,

      currentTime - active.startedAt,
    )

    const totalRuns = Math.min(
      Math.floor(elapsedSeconds / exploration.duration),

      exploration.maxRuns,
    )

    const completedRuns = Math.max(
      0,

      totalRuns - active.claimedRuns,
    )

    if (completedRuns <= 0) {
      return {
        explorationId: exploration.id,

        elapsedSeconds,

        completedRuns: 0,

        materials: [],
      }
    }

    const materials = this.generateRewards(
      rewards,

      completedRuns,
    )

    for (const reward of materials) {
      const material = this.materialRegistry.get(reward.materialId)

      this.inventory.add(material, reward.amount)
    }

    active.claimedRuns = totalRuns

    return {
      explorationId: exploration.id,

      elapsedSeconds,

      completedRuns,

      materials,
    }
  }

  private generateRewards(
    rewards: ExplorationMaterialReward[],

    runs: number,
  ) {
    const result: {
      materialId: string
      amount: number
    }[] = []

    for (const reward of rewards) {
      let amount = 0

      for (let i = 0; i < runs; i++) {
        if (!rollChance(reward.chance)) {
          continue
        }

        amount += randomInt(reward.minAmount, reward.maxAmount)
      }

      if (amount > 0) {
        result.push({
          materialId: reward.materialId,

          amount,
        })
      }
    }

    return result
  }
}
