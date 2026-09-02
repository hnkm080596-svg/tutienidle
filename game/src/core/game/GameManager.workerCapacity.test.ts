// T3 (chi-hien-quan, 2026-09-02) — nguồn nhân công DUY NHẤT là CHQ:
// - build/upgrade chi_hien_quan → autoWorkerCapacity = 1 + level×2
// - gathering_outpost KHÔNG còn cấp capacity (nguồn cũ gỡ)
// - restore save có CHQ instance → capacity khôi phục đúng
import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { buildings } from '../../data/building/buildings'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'

function makeManager(): GameManager {
  const manager = new GameManager()

  manager.registerBuildings(buildings)

  return manager
}

function buildInstance(instanceId: string, buildingId: string, level: number) {
  return { instanceId, buildingId, level, lastCollectedAt: 0 }
}

describe('GameManager — worker capacity nguồn CHQ duy nhất', () => {
  it('build CHQ cấp 1 → capacity 3; upgrade cấp 2 → 5; cấp 9 → 19', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    manager.setActivePlayer(player)

    // Xây CHQ level 1 (canBuild qua buildingSystem — chi phí [] band đầu).
    expect(manager.buildBuilding('chi_hien_quan', player)).not.toBe(false)

    const instance = manager.buildingManager.getByBuildingId('chi_hien_quan')!

    expect(player.autoWorkerCapacity).toBe(3)

    instance.level = 2
    manager.refreshAutoWorkerCapacity(player, instance)
    expect(player.autoWorkerCapacity).toBe(5)

    instance.level = 9
    manager.refreshAutoWorkerCapacity(player, instance)
    expect(player.autoWorkerCapacity).toBe(19)
  })

  it('chưa xây CHQ → capacity 0 (công thức, không fallback outpost)', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    manager.setActivePlayer(player)

    expect(player.autoWorkerCapacity).toBe(0)
  })

  it('upgrade gathering_outpost KHÔNG đổi capacity (nguồn cũ gỡ)', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    manager.setActivePlayer(player)

    // Outpost ở bất kỳ level nào — capacity vẫn 0 (chưa có CHQ).
    const outpost = buildInstance('outpost_inst', 'gathering_outpost', 9)

    manager.buildingManager.add(outpost)
    manager.refreshAutoWorkerCapacity(player, outpost)

    expect(player.autoWorkerCapacity).toBe(0)
  })

  it('restoreFromSave có CHQ instance → capacity khôi phục đúng công thức', () => {
    const manager = makeManager()
    const player = createDefaultPlayer()

    manager.setActivePlayer(player)

    // save.buildings chứa CHQ level 2 — restore phải re-apply capacity 5.
    manager.restoreFromSave({
      version: 55,
      player: { ...player, autoWorkerCapacity: 0 },
      techniques: [],
      skills: [],
      materials: [],
      equipment: [],
      equipmentSlots: [],
      pills: [],
      talismans: [],
      formations: [],
      buildings: [buildInstance('chq_inst', 'chi_hien_quan', 2)],
      quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
      productionSites: [],
    })

    expect(player.autoWorkerCapacity).toBe(5)
  })
})
