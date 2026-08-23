import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import type { Zone } from '../stage/Zone'
import { createDefaultPlayer } from '../player/Player'

const ZONES: Zone[] = [
  { id: 'zone_a', name: 'Zone A', stageIds: ['stage_1', 'stage_2', 'stage_3'] },
  { id: 'zone_b', name: 'Zone B', stageIds: ['stage_x'] },
]

function setup() {
  const gameManager = new GameManager()

  gameManager.registerZones(ZONES)

  return gameManager
}

describe('GameManager.getNextStageInZone (Thám Hiểm rework — Tự Động Thám Hiểm)', () => {
  it('trả về Màn kế tiếp trong cùng Địa Giới', () => {
    const gameManager = setup()

    expect(gameManager.getNextStageInZone('zone_a', 'stage_1')).toBe('stage_2')
    expect(gameManager.getNextStageInZone('zone_a', 'stage_2')).toBe('stage_3')
  })

  it('trả về null khi đã ở Màn cuối của Địa Giới', () => {
    const gameManager = setup()

    expect(gameManager.getNextStageInZone('zone_a', 'stage_3')).toBeNull()
    expect(gameManager.getNextStageInZone('zone_b', 'stage_x')).toBeNull()
  })

  it('trả về null khi stageId không thuộc Địa Giới đó', () => {
    const gameManager = setup()

    expect(gameManager.getNextStageInZone('zone_a', 'stage_x')).toBeNull()
  })

  it('trả về null khi zoneId không tồn tại', () => {
    const gameManager = setup()

    expect(gameManager.getNextStageInZone('zone_unknown', 'stage_1')).toBeNull()
  })
})

describe('GameManager.isStageUnlocked — mở tuần tự theo hoàn thành', () => {
  it('khóa màn kế và địa giới kế cho tới khi hoàn thành màn trước', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()

    expect(gameManager.isStageUnlocked('stage_1', player)).toBe(true)
    expect(gameManager.isStageUnlocked('stage_2', player)).toBe(false)
    expect(gameManager.isStageUnlocked('stage_x', player)).toBe(false)

    player.completedStageIds.push('stage_1', 'stage_2', 'stage_3')
    expect(gameManager.isStageUnlocked('stage_2', player)).toBe(true)
    expect(gameManager.isStageUnlocked('stage_x', player)).toBe(true)
  })
})

describe('GameManager.registerEquipment — startup validation', () => {
  it('từ chối main stat không đúng slot ngay khi đăng ký', () => {
    const gameManager = new GameManager()
    expect(() => gameManager.registerEquipment([{
      id: 'bad_boots', name: 'Sai', slot: 'boots', grade: 1, maxEnhanceLevel: 1,
      mainStats: [{ stat: 'attack', min: 1, max: 2 }],
    }])).toThrow(/Invalid main stat/)
  })
})
