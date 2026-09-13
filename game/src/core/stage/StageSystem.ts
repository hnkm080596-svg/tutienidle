import type { Stage, StageEnemyEntry } from './Stage'
import { weightedRandom } from '../reward/DropRoll'

export class StageSystem {
  // Returns the whole StageEnemyEntry (not just enemyId) - the spawn
  // pick reads `eliteChance` of the rolled entry to decide whether to
  // attach the tinh_anh tag (see StageWaveSystem.pickEnemyForSpawn).
  pickNextEnemyEntry(stage: Stage): StageEnemyEntry {
    return weightedRandom(stage.enemyPool.map(entry => ({ value: entry, weight: entry.weight })))
  }
}
