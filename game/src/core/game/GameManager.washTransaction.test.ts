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
import { ITEM_QUALITY_SUBSTATS_RANGE } from '../equipment/ItemQualityBalance'

describe('GameManager wash transaction', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preview + commit consumes no ore, persists one forge use and both material costs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const manager = new GameManager()
    const player = createDefaultPlayer()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerEquipment(equipment)
    manager.catalogOps.registerAffixes(affixes)

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
        stat: 'might',
        flat: 12,
      },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
    })
    manager.equipmentBag.add(instance)
    expect(manager.equipmentOps.equipItem(instance.instanceId, player)).toEqual({ ok: true })

    const essence = manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID)
    const spiritStone = manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID)
    const oreId = 'qi_refining_ore_century'
    const ore = manager.materialRegistry.get(oreId)
    manager.materialBag.add(essence, 9)
    manager.materialBag.add(spiritStone, 100)
    manager.materialBag.add(ore, 7)

    const modifierIdsBefore = manager
      .equipmentOps.getEquipmentModifiers()
      .filter((modifier) => modifier.sourceId === instance.instanceId)
      .map((modifier) => modifier.id)
      .sort()
    expect(modifierIdsBefore).toEqual([
      `${instance.instanceId}:accuracyRating`,
      `${instance.instanceId}:might`,
    ])
    const mainStatBefore = structuredClone(instance.mainStat)

    const preview = manager.equipmentOps.previewWashItem(instance.instanceId)

    expect(preview.ok).toBe(true)
    // R9 (AR-21): display copy read through the ticket read model.
    const previewAffixes = manager.equipmentOps.getWashPreviewAffixes(preview.ticketId!)!.affixes
    expect(previewAffixes).toHaveLength(3)
    expect(instance.affixes).toEqual([{ affixId: 'suffix_accuracy', tier: 1, value: 3 }])
    expect(instance.forgeUsesRemaining).toBe(19)
    expect(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
    expect(manager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(manager.materialBag.getAmount(oreId)).toBe(7)
    expect(manager.equipmentOps.getEquipmentModifiers().map((modifier) => modifier.id).sort()).toEqual(modifierIdsBefore)

    expect(manager.equipmentOps.commitWashItem(instance.instanceId, preview.ticketId!).ok).toBe(true)
    expect(instance.mainStat).toEqual(mainStatBefore)
    expect(instance.forgeUsesRemaining).toBe(19)
    const committedAffixes = structuredClone(instance.affixes)
    const committedModifierIds = [
      `${instance.instanceId}:might`,
      ...committedAffixes.map(
        (rolled) => `${instance.instanceId}:${manager.affixRegistry.get(rolled.affixId).stat}`,
      ),
    ].sort()
    expect(
      manager
        .equipmentOps.getEquipmentModifiers()
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
    restoredManager.catalogOps.registerMaterials(materials)
    restoredManager.catalogOps.registerEquipment(equipment)
    restoredManager.catalogOps.registerAffixes(affixes)
    restoredManager.saveOps.restoreFromSave(validated.normalizedSave as ReturnType<typeof buildGameSave>)

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
        .equipmentOps.getEquipmentModifiers()
        .filter((modifier) => modifier.sourceId === instance.instanceId)
        .map((modifier) => modifier.id)
        .sort(),
    ).toEqual(committedModifierIds)
  })

  // R9 (AR-21) regression - the audit's executed counterexample: the
  // public GameManager.commitWashItem must NOT accept caller-fabricated
  // affixes. Without a domain-issued ticket every commit fails and the
  // instance is untouched.
  it('commit without a domain ticket rejects fabricated affixes at the public API', () => {
    const manager = new GameManager()
    const _player = createDefaultPlayer()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerEquipment(equipment)
    manager.catalogOps.registerAffixes(affixes)

    const instance = makeInstance({
      instanceId: 'wash-fabricated-item',
      itemId: 'base_kiem',
      equipped: false,
      quality: 'dia',
      forgeUsesTotal: 20,
      forgeUsesRemaining: 20,
      mainStat: {
        id: 'wash-main',
        sourceId: 'wash-fabricated-item',
        sourceType: 'equipment',
        stat: 'might',
        flat: 12,
      },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
    })
    manager.equipmentBag.add(instance)

    const before = structuredClone(instance.affixes)
    const forgeBefore = instance.forgeUsesRemaining

    const result = manager.equipmentOps.commitWashItem(instance.instanceId, 'fabricated-ticket-id')

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_pending_wash')
    expect(instance.affixes).toEqual(before)
    expect(instance.forgeUsesRemaining).toBe(forgeBefore)
  })

  // T4-33 — the roll must honor BOTH ends of ITEM_QUALITY_SUBSTATS_RANGE:
  // lineCount = min + floor(random * (max - min + 1)). Every quality has
  // min 0 today, so pin the contract by mutating the range for this test —
  // random -> 0 must yield min lines, not 0.
  it('wash line count honors the range minimum (contract pin)', () => {
    const original = ITEM_QUALITY_SUBSTATS_RANGE.dia
    ITEM_QUALITY_SUBSTATS_RANGE.dia = { min: 2, max: 3 }

    try {
      vi.spyOn(Math, 'random').mockReturnValue(0) // floor of the range

      const manager = new GameManager()
      manager.catalogOps.registerMaterials(materials)
      manager.catalogOps.registerEquipment(equipment)
      manager.catalogOps.registerAffixes(affixes)

      const instance = makeInstance({
        instanceId: 'wash-min-item',
        itemId: 'base_kiem',
        equipped: false,
        quality: 'dia',
        forgeUsesTotal: 20,
        forgeUsesRemaining: 20,
        mainStat: {
          id: 'wash-min-main',
          sourceId: 'wash-min-item',
          sourceType: 'equipment',
          stat: 'might',
          flat: 12,
        },
      })
      manager.equipmentBag.add(instance)

      const essence = manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID)
      const spiritStone = manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID)
      manager.materialBag.add(essence, 100)
      manager.materialBag.add(spiritStone, 1000)

      const preview = manager.equipmentOps.previewWashItem(instance.instanceId)

      expect(preview.ok).toBe(true)
      expect(
        manager.equipmentOps.getWashPreviewAffixes(preview.ticketId!)!.affixes,
      ).toHaveLength(2)
    } finally {
      ITEM_QUALITY_SUBSTATS_RANGE.dia = original
    }
  })
})
