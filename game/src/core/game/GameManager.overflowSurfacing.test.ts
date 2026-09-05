// Task A6 (roadmap 9.8) — surface MaterialBag.add() overflow at reward
// call sites: collectBuilding phải (1) clamp bag tại stackLimit, (2) push
// notification 'bag.overflow' với lượng TRÀN bị mất, (3) quest hook chỉ
// tính lượng THỰC SỰ vào túi (delivered = claimed − overflow). Restore
// save quá cap phải gom đúng MỘT event mỗi loại material tràn.
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import { CURRENT_SAVE_VERSION } from '../../services/save/saveVersion'
import type { Material } from '../material/Material'
import type { Building } from '../building/Building'
import type { Quest } from '../quest/Quest'

const OVERFLOW_MATERIAL: Material = {
  id: 'mat_overflow_test',
  name: 'Vật Liệu Tràn Test',
  category: 'other',
  sourceType: 'monster',
  stackLimit: 100,
}

const OVERFLOW_BUILDING: Building = {
  id: 'overflow_test_spring',
  name: 'Linh Mạch Test',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 1,
  producesMaterialId: 'mat_overflow_test',
  baseProductionRate: 10,
  baseStorageCapacity: 500,
  upgradeCost: [[]],
}

const OVERFLOW_QUEST: Quest = {
  id: 'overflow_collect_test',
  name: 'Thu thập vật liệu tràn',
  description: 'Test collect quest',
  condition: { kind: 'collect', materialId: 'mat_overflow_test', amount: 5 },
  reward: {},
  cadence: 'once',
}

function makeManager(): GameManager {
  const manager = new GameManager()

  manager.registerMaterials([OVERFLOW_MATERIAL])
  manager.registerBuildings([OVERFLOW_BUILDING])
  manager.registerQuests([OVERFLOW_QUEST])

  return manager
}

describe('GameManager — bag overflow surfacing (9.8)', () => {
  it('collectBuilding tràn túi → bag clamp 100, toast bag.overflow 460, quest progress chỉ tính 40 delivered', () => {
    const manager = makeManager()
    const player: PlayerData = createDefaultPlayer()

    manager.setActivePlayer(player)
    manager.getActiveQuests() // activate collect quest progress

    manager.materialBag.add(manager.materialRegistry.get('mat_overflow_test'), 60)

    manager.buildingManager.add({
      instanceId: 'overflow_inst',
      buildingId: 'overflow_test_spring',
      level: 1,
      lastCollectedAt: 0,
    })

    const returned = manager.collectBuilding('overflow_inst', player, 1000)

    expect(returned).toBe(500)
    expect(manager.materialBag.getAmount('mat_overflow_test')).toBe(100)

    const events = manager.drainNotifications()
    const overflowEvent = events.find((event) => event.messageKey === 'bag.overflow')

    expect(overflowEvent).toBeDefined()
    expect(overflowEvent!.kind).toBe('warning')
    expect(overflowEvent!.message).toBe('Túi đầy — mất 460 Vật Liệu Tràn Test')
    expect(overflowEvent!.messageParams).toEqual({
      amount: '460',
      name: 'Vật Liệu Tràn Test',
    })

    const progress = manager.questManager.getProgress('overflow_collect_test')

    expect(progress?.progress).toBe(40)
  })

  it('restoreFromSave material 300 quá cap 100 → bag 100, đúng MỘT event bag.overflow amount 200', () => {
    const manager = makeManager()
    const player: PlayerData = createDefaultPlayer()

    manager.setActivePlayer(player)

    manager.restoreFromSave({
      version: CURRENT_SAVE_VERSION,
      player: { ...player },
      techniques: [],
      skills: [],
      materials: [{ materialId: 'mat_overflow_test', amount: 300 }],
      equipment: [],
      equipmentSlots: [],
      pills: [],
      talismans: [],
      formations: [],
      buildings: [],
      quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
      productionSites: [],
    })

    expect(manager.materialBag.getAmount('mat_overflow_test')).toBe(100)

    const overflowEvents = manager
      .drainNotifications()
      .filter((event) => event.messageKey === 'bag.overflow')

    expect(overflowEvents).toHaveLength(1)
    expect(overflowEvents[0]!.messageParams).toEqual({
      amount: '200',
      name: 'Vật Liệu Tràn Test',
    })
  })
})
