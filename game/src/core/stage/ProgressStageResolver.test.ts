import { describe, expect, it } from 'vitest'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { Stage } from './Stage'
import { resolveNextProgressStage } from './ProgressStageResolver'
import type { Zone } from './Zone'

const stages: Stage[] = [5, 6, 10].map(floor => ({
  id: `stage_${floor}`,
  name: `Stage ${floor}`,
  description: '',
  floor,
  requiredRealmId: 'pham_nhan',
  requiredRealmLevel: floor,
  enemyPool: [],
  totalEnemyCount: 1,
  spawnIntervalSeconds: 0,
}))

const zone: Zone = {
  id: 'test_zone',
  name: 'Test Zone',
  stageIds: stages.map(stage => stage.id),
}

function setup() {
  const gameManager = new GameManager()
  gameManager.registerStages(stages)
  gameManager.zoneRegistry.register(zone)
  return gameManager
}

describe('resolveNextProgressStage', () => {
  it('không coi tầng 5 là cuối zone và trả tầng 6 khi đã mở', () => {
    const player = createDefaultPlayer()
    player.realmLevel = 6
    player.completedStageIds.push('stage_5')

    expect(resolveNextProgressStage(setup(), player, zone.id, 'stage_5')).toEqual({
      status: 'ready',
      stage: stages[1],
    })
  })

  it('trả locked thay vì complete khi tầng 6 chưa đủ tu vi', () => {
    const player = createDefaultPlayer()
    player.realmLevel = 5
    player.completedStageIds.push('stage_5')

    expect(resolveNextProgressStage(setup(), player, zone.id, 'stage_5')).toEqual({
      status: 'locked',
      stage: stages[1],
    })
  })

  it('chỉ complete ở stage cuối danh sách zone', () => {
    expect(resolveNextProgressStage(setup(), createDefaultPlayer(), zone.id, 'stage_10')).toEqual({
      status: 'complete',
    })
  })
})
