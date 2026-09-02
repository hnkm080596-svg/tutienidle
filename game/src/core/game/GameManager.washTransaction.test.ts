import { afterEach, describe, expect, it, vi } from 'vitest'
import { affixes } from '../../data/equipment/affixes'
import { equipment } from '../../data/equipment/equipment'
import { materials } from '../../data/materials/materials'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import { createDefaultPlayer } from '../player/Player'
import { buildGameSave } from '../../services/save/SaveSystem'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { GameManager } from './GameManager'

describe('GameManager wash transaction', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preview + commit consumes no ore, persists one forge use and both material costs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.registerMaterials(materials)
    manager.registerEquipment(equipment)
    manager.registerAffixes(affixes)

    const instance = makeInstance({
      instanceId: 'wash-transaction-item',
      itemId: 'base_kiem',
      equipped: false,
      quality: 'dia',
      forgeUsesTotal: 20,
      forgeUsesRemaining: 20,
      mainStat: {
        id: 'wash-main',
        sourceId: 'wash-transaction-item',
        sourceType: 'equipment',
        stat: 'attack',
        flat: 12,
      },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
    })
    manager.equipmentBag.add(instance)
    expect(manager.equipItem(instance.instanceId, player)).toEqual({ ok: true })

    const essence = manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID)
    const spiritStone = manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID)
    const oreId = 'qi_refining_ore_huyen'
    const ore = manager.materialRegistry.get(oreId)
    manager.materialBag.add(essence, 9)
    manager.materialBag.add(spiritStone, 100)
    manager.materialBag.add(ore, 7)

    const modifierIdsBefore = manager
      .getEquipmentModifiers()
      .filter((modifier) => modifier.sourceId === instance.instanceId)
      .map((modifier) => modifier.id)
      .sort()
    expect(modifierIdsBefore).toEqual([
      `${instance.instanceId}:accuracyRating`,
      `${instance.instanceId}:attack`,
    ])
    const mainStatBefore = structuredClone(instance.mainStat)

    const preview = manager.previewWashItem(instance.instanceId)

    expect(preview.ok).toBe(true)
    expect(preview.affixes).toHaveLength(3)
    expect(instance.affixes).toEqual([{ affixId: 'suffix_accuracy', tier: 1, value: 3 }])
    expect(instance.forgeUsesRemaining).toBe(19)
    expect(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(manager.materialBag.getAmount(oreId)).toBe(7)
    expect(manager.getEquipmentModifiers().map((modifier) => modifier.id).sort()).toEqual(modifierIdsBefore)

    expect(manager.commitWashItem(instance.instanceId, preview.affixes ?? []).ok).toBe(true)
    expect(instance.mainStat).toEqual(mainStatBefore)
    expect(instance.forgeUsesRemaining).toBe(19)
    const committedAffixes = structuredClone(instance.affixes)
    const committedModifierIds = [
      `${instance.instanceId}:attack`,
      ...committedAffixes.map(
        (rolled) => `${instance.instanceId}:${manager.affixRegistry.get(rolled.affixId).stat}`,
      ),
    ].sort()
    expect(
      manager
        .getEquipmentModifiers()
        .filter((modifier) => modifier.sourceId === instance.instanceId)
        .map((modifier) => modifier.id)
        .sort(),
    ).toEqual(committedModifierIds)

    const roundTripped: unknown = JSON.parse(JSON.stringify(buildGameSave(player, manager)))
    const validated = validateGameSaveShape(roundTripped)

    expect(validated).toMatchObject({ ok: true, issues: [], discardedEquipmentCount: 0 })
    if (!validated.ok) {
      throw new Error(`Expected valid Wash save: ${JSON.stringify(validated.issues)}`)
    }

    const restoredManager = new GameManager()
    restoredManager.registerMaterials(materials)
    restoredManager.registerEquipment(equipment)
    restoredManager.registerAffixes(affixes)
    restoredManager.restoreFromSave(validated.normalizedSave as ReturnType<typeof buildGameSave>)

    const restoredInstance = restoredManager.equipmentBag.get(instance.instanceId)
    expect(restoredInstance).toMatchObject({
      affixes: committedAffixes,
      equipped: true,
      forgeUsesRemaining: 19,
    })
    expect(restoredManager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
    expect(restoredManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(restoredManager.materialBag.getAmount(oreId)).toBe(7)
    expect(
      restoredManager
        .getEquipmentModifiers()
        .filter((modifier) => modifier.sourceId === instance.instanceId)
        .map((modifier) => modifier.id)
        .sort(),
    ).toEqual(committedModifierIds)
  })
})
