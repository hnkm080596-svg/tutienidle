import type { Stage, StageEnemyEntry } from './Stage'
import { weightedRandom } from '../reward/DropRoll'

export class StageSystem {
  // Trả nguyên StageEnemyEntry (không chỉ enemyId) — GameManager cần
  // đọc `eliteChance` của entry vừa roll trúng để quyết có spawn bản
  // Elite hay không (xem GameManager.updateStageProgress()).
  pickNextEnemyEntry(stage: Stage): StageEnemyEntry {
    return weightedRandom(stage.enemyPool.map(entry => ({ value: entry, weight: entry.weight })))
  }
}
