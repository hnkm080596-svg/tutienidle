import { describe, expect, it } from 'vitest'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'
import { EQUIPMENT_BAG_SOFT_CAP } from '../equipment/EquipmentBag'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import type { Equipment } from '../equipment/Equipment'
import { createDefaultPlayer } from '../player/Player'
import { materials } from '../../data/materials/materials'
import { buildGameSave } from '../../services/save/SaveSystem'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { GameManager } from './GameManager'

const FORMER_ESSENCE_STACK_LIMIT = 9_999

const TEST_WEAPON: Equipment = {
  id: 'unified-essence-test-sword',
  name: 'Unified Essence Test Sword',
  slot: 'weapon',
  grade: 1,
  maxEnhanceLevel: 10,
  mainStats: [{ stat: 'attack', min: 1, max: 1 }],
}

function registeredManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.registerMaterials(materials)
  gameManager.registerEquipment([TEST_WEAPON])
  return gameManager
}

function seedFormerEssenceCapacity(gameManager: GameManager): void {
  gameManager.materialBag.add(
    gameManager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID),
    FORMER_ESSENCE_STACK_LIMIT,
  )
}

describe('GameManager — unified essence dissolve persistence', () => {
  it('applies a duplicate selection once and persists the resulting Luyện Khí Tinh Hoa stack', () => {
    const gameManager = new GameManager()
    gameManager.registerMaterials(materials)
    gameManager.equipmentBag.add(
      makeInstance({
        instanceId: 'dissolve-once',
        grade: 'luc_pham',
        quality: 'hoang',
      }),
    )

    const result = gameManager.dissolveItems([
      'dissolve-once',
      'dissolve-once',
      'dissolve-once',
    ])

    expect(result.ok).toBe(true)
    expect(result.rewards).toHaveLength(1)

    const reward = result.rewards![0]!
    expect(reward.materialId).toBe(LUYEN_KHI_TINH_HOA_ID)
    expect(reward.amount).toBeGreaterThanOrEqual(1)
    expect(reward.amount).toBeLessThanOrEqual(3)
    expect(gameManager.equipmentBag.get('dissolve-once')).toBeUndefined()
    expect(gameManager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(reward.amount)

    const roundTripped: unknown = JSON.parse(
      JSON.stringify(buildGameSave(createDefaultPlayer(), gameManager)),
    )

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
      discardedEquipmentCount: 0,
    })
    expect(
      (roundTripped as { materials: Array<{ materialId: string; amount: number }> }).materials,
    ).toContainEqual({ materialId: LUYEN_KHI_TINH_HOA_ID, amount: reward.amount })
  })

  it('manual dissolve credits essence after crossing the former 9,999 capacity', () => {
    const gameManager = registeredManager()
    seedFormerEssenceCapacity(gameManager)
    gameManager.equipmentBag.add(
      makeInstance({
        instanceId: 'manual-capacity-boundary',
        itemId: TEST_WEAPON.id,
        quality: 'hoang',
      }),
    )

    const result = gameManager.dissolveItems(['manual-capacity-boundary'])

    expect(result.ok).toBe(true)
    const reward = result.rewards![0]!
    expect(gameManager.equipmentBag.get('manual-capacity-boundary')).toBeUndefined()
    expect(gameManager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(
      FORMER_ESSENCE_STACK_LIMIT + reward.amount,
    )

    const roundTripped: unknown = JSON.parse(
      JSON.stringify(buildGameSave(createDefaultPlayer(), gameManager)),
    )

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
    })
    expect(
      (roundTripped as { materials: Array<{ materialId: string; amount: number }> }).materials,
    ).toContainEqual({
      materialId: LUYEN_KHI_TINH_HOA_ID,
      amount: FORMER_ESSENCE_STACK_LIMIT + reward.amount,
    })
  })

  it('auto-dissolve credits essence after crossing the former 9,999 capacity', () => {
    const gameManager = registeredManager()
    seedFormerEssenceCapacity(gameManager)

    for (let index = 0; index < EQUIPMENT_BAG_SOFT_CAP; index += 1) {
      gameManager.equipmentBag.add(
        makeInstance({
          instanceId: `auto-capacity-fill-${index}`,
          itemId: TEST_WEAPON.id,
          quality: 'hoang',
        }),
      )
    }

    expect(gameManager.obtainEquipment(TEST_WEAPON.id, createDefaultPlayer())).not.toBeNull()

    expect(gameManager.equipmentBag.getAll()).toHaveLength(EQUIPMENT_BAG_SOFT_CAP)
    expect(gameManager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(10_000)
  })

  it('restore auto-dissolve credits essence after crossing the former 9,999 capacity', () => {
    const savedManager = new GameManager()
    const save = {
      ...buildGameSave(createDefaultPlayer(), savedManager),
      materials: [
        { materialId: LUYEN_KHI_TINH_HOA_ID, amount: FORMER_ESSENCE_STACK_LIMIT },
      ],
      equipment: Array.from({ length: EQUIPMENT_BAG_SOFT_CAP + 1 }, (_, index) =>
        makeInstance({
          instanceId: `restore-capacity-fill-${index}`,
          itemId: TEST_WEAPON.id,
          quality: 'hoang',
        }),
      ),
    }
    const restoredManager = registeredManager()

    restoredManager.restoreFromSave(save)

    expect(restoredManager.equipmentBag.getAll()).toHaveLength(EQUIPMENT_BAG_SOFT_CAP)
    expect(restoredManager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(10_000)
  })
})
