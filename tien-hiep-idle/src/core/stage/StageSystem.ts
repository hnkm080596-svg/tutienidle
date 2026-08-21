import type { Stage, StageEnemyEntry } from './Stage'
import type { PlayerData } from '../player/Player'
import { getRealmIndex } from '../realm/realmSystem'
import { weightedRandom } from '../reward/DropRoll'

export class StageSystem {
  canStart(stage: Stage, player: PlayerData): boolean {
    if (stage.requiredRealmId && getRealmIndex(player.realmId) < getRealmIndex(stage.requiredRealmId)) {
      return false
    }

    return true
  }

  // Trả nguyên StageEnemyEntry (không chỉ enemyId) — GameManager cần
  // đọc `eliteChance` của entry vừa roll trúng để quyết có spawn bản
  // Elite hay không (xem GameManager.updateStageProgress()).
  pickNextEnemyEntry(stage: Stage): StageEnemyEntry {
    return weightedRandom(stage.enemyPool.map(entry => ({ value: entry, weight: entry.weight })))
  }
}
