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

describe('GameManager refine transaction', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preview + commit charges once, preserves identity/tier, and persists the increased value', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.registerMaterials(materials)
    manager.registerEquipment(equipment)
    manager.registerAffixes(affixes)

    const instance = makeInstance({
      instanceId: 'refine-transaction-item',
      itemId: 'base_kiem',
      equipped: false,
      quality: 'dia',
      forgeUsesTotal: 20,
      forgeUsesRemaining: 20,
      mainStat: {
        id: 'refine-main',
        sourceId: 'refine-transaction-item',
        sourceType: 'equipment',
        stat: 'attack',
        flat: 12,
      },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
    })
    manager.equipmentBag.add(instance)
    expect(manager.equipItem(instance.instanceId, player)).toBe(true)

    manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 5)
    manager.materialBag.add(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID), 50)
    const identityBefore = structuredClone(instance.affixes)
    const modifiersBefore = structuredClone(manager.getEquipmentModifiers())
    const accuracyBefore = modifiersBefore.find(
      (modifier) => modifier.id === `${instance.instanceId}:accuracyRating`,
    )
    expect(accuracyBefore).toBeDefined()

    const preview = manager.previewRefineItem(instance.instanceId, [])

    expect(preview.ok).toBe(true)
    expect(preview.values).toHaveLength(1)
    expect(preview.values![0]!.index).toBe(0)
    expect(preview.values![0]!.value).toBeCloseTo(3.15, 12)
    expect(instance.affixes).toEqual(identityBefore)
    expect(instance.forgeUsesRemaining).toBe(19)
    expect(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(manager.getEquipmentModifiers()).toEqual(modifiersBefore)

    expect(manager.commitRefineItem(instance.instanceId, preview.values ?? []).ok).toBe(true)
    expect(instance.affixes).toEqual([
      { affixId: 'suffix_accuracy', tier: 1, value: preview.values![0]!.value },
    ])
    expect(instance.forgeUsesRemaining).toBe(19)
    expect(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    const committedAccuracy = manager
      .getEquipmentModifiers()
      .find((modifier) => modifier.id === `${instance.instanceId}:accuracyRating`)
    expect(committedAccuracy).toBeDefined()
    expect(committedAccuracy!.flat).toBeGreaterThan(accuracyBefore!.flat ?? 0)

    const roundTripped: unknown = JSON.parse(JSON.stringify(buildGameSave(player, manager)))
    const validated = validateGameSaveShape(roundTripped)

    expect(validated).toMatchObject({ ok: true, issues: [], discardedEquipmentCount: 0 })
    if (!validated.ok) {
      throw new Error(`Expected valid Refine save: ${JSON.stringify(validated.issues)}`)
    }

    const restoredManager = new GameManager()
    restoredManager.registerMaterials(materials)
    restoredManager.registerEquipment(equipment)
    restoredManager.registerAffixes(affixes)
    restoredManager.restoreFromSave(validated.normalizedSave as ReturnType<typeof buildGameSave>)

    expect(restoredManager.equipmentBag.get(instance.instanceId)).toMatchObject({
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: preview.values![0]!.value }],
      equipped: true,
      forgeUsesRemaining: 19,
    })
    expect(restoredManager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
    expect(restoredManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(
      restoredManager
        .getEquipmentModifiers()
        .find((modifier) => modifier.id === `${instance.instanceId}:accuracyRating`),
    ).toEqual(committedAccuracy)
  })

  it.each([
    [
      'template',
      (save: ReturnType<typeof buildGameSave>) => {
        save.equipment[1]!.itemId = 'removed_equipment_template'
      },
      'Unknown equipment template in save: removed_equipment_template',
    ],
    [
      'affix',
      (save: ReturnType<typeof buildGameSave>) => {
        save.equipment[1]!.affixes[0]!.affixId = 'removed_affix_id'
      },
      'Unknown equipment affix in save: removed_affix_id',
    ],
  ] as const)(
    'restore hard-fail controlled khi current equipment tham chiếu %s lạ trước mọi owner mutation',
    (_case, corruptReference, expectedError) => {
    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.registerMaterials(materials)
    manager.registerEquipment(equipment)
    manager.registerAffixes(affixes)
    manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 3)
    const firstValid = makeInstance({
      instanceId: 'valid-before-unknown-reference',
      itemId: 'base_kiem',
      equipped: true,
      mainStat: {
        id: 'valid-before-unknown-reference-main',
        sourceId: 'valid-before-unknown-reference',
        sourceType: 'equipment',
        stat: 'attack',
        flat: 12,
      },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
    })
    const invalidLater = makeInstance({
      instanceId: 'unknown-reference-save-item',
      itemId: 'base_kiem',
      equipped: false,
      mainStat: {
        id: 'unknown-reference-main',
        sourceId: 'unknown-reference-save-item',
        sourceType: 'equipment',
        stat: 'attack',
        flat: 12,
      },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
    })
    manager.equipmentBag.add(firstValid)
    manager.equipmentBag.add(invalidLater)
    const save = buildGameSave(player, manager)
    corruptReference(save)

    const restored = new GameManager()
    restored.registerMaterials(materials)
    restored.registerEquipment(equipment)
    restored.registerAffixes(affixes)
    restored.materialBag.add(restored.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 11)

    expect(() => restored.restoreFromSave(save)).toThrow(expectedError)
    expect(restored.equipmentBag.getAll()).toEqual([])
    expect(restored.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(11)
    expect(restored.getEquipmentModifiers()).toEqual([])
    },
  )
})
