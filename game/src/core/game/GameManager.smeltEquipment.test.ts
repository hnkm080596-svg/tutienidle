import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import type { Equipment } from '../equipment/Equipment'
import { materials } from '../../data/materials/materials'

const TEST_EQUIPMENT: Equipment = {
  id: 'smelt_test_sword',
  name: 'Kiếm',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'attack', min: 10, max: 20 }],
}

describe('GameManager.smeltEquipment — phân giải instance', () => {
  it('xóa trang bị chưa mặc và trả 2 Bụi Cốt', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const buiCot = materials.find(material => material.id === 'bui_cot')!
    gameManager.registerMaterials([buiCot])
    gameManager.registerEquipment([TEST_EQUIPMENT])
    const instance = gameManager.obtainEquipment(TEST_EQUIPMENT.id, player)!

    expect(gameManager.smeltEquipment(instance.instanceId)).toBe(true)
    expect(gameManager.equipmentBag.has(instance.instanceId)).toBe(false)
    expect(gameManager.materialBag.getAmount('bui_cot')).toBe(2)
  })

  it('không phân giải trang bị đang mặc', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    const buiCot = materials.find(material => material.id === 'bui_cot')!
    gameManager.registerMaterials([buiCot])
    gameManager.registerEquipment([TEST_EQUIPMENT])
    const instance = gameManager.obtainEquipment(TEST_EQUIPMENT.id, player)!
    expect(gameManager.equipItem(instance.instanceId, player)).toBe(true)

    expect(gameManager.smeltEquipment(instance.instanceId)).toBe(false)
    expect(gameManager.equipmentBag.has(instance.instanceId)).toBe(true)
    expect(gameManager.materialBag.getAmount('bui_cot')).toBe(0)
  })
})
