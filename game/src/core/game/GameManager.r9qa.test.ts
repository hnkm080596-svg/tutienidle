// QA (R9) - adversarial checks for the wash ticket + vendor atomicity +
// receipt invariants. Written to PASS against correct behavior; failure
// = confirmed defect with intended-reason evidence.
import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'
import type { PlayerData } from '../player/Player'
import { buildGameSave } from '../../services/save/SaveSystem'

function makeManager(player?: PlayerData): { manager: GameManager; player: PlayerData } {
  const manager = new GameManager()
  manager.registerMaterials(materials)
  manager.registerEquipment(equipment)
  manager.registerAffixes(affixes)
  const resolved = player ?? createDefaultPlayer()
  manager.setActivePlayer(resolved)
  return { manager, player: resolved }
}

describe('QA R9 - wash ticket save boundary', () => {
  // Hypothesis: the pending ticket is session state, NOT save state.
  // Save + restore mid-preview must not resurrect a payable ticket AND
  // must not crash restore (the slice is intentionally not persisted).
  it('restore round-trip does not resurrect the pending wash ticket', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const { manager, player } = makeManager()

    const instance = makeInstance({
      instanceId: 'qa-wash-item',
      itemId: 'base_kiem',
      equipped: false,
      quality: 'dia',
      forgeUsesTotal: 20,
      forgeUsesRemaining: 20,
      mainStat: { id: 'm', sourceId: 'qa-wash-item', sourceType: 'equipment', stat: 'attack', flat: 12 },
      affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
    })
    manager.equipmentBag.add(instance)

    const essence = manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID)
    manager.materialBag.add(essence, 9)
    manager.materialBag.add(manager.materialRegistry.get(SPIRIT_STONE_MATERIAL_ID), 100)

    // Paid preview leaves a pending ticket in the session.
    const preview = manager.previewWashItem(instance.instanceId)
    expect(preview.ok).toBe(true)

    // Snapshot + restore into a FRESH manager (boot path).
    const save = buildGameSave(player, manager)

    const fresh = new GameManager()
    fresh.registerMaterials(materials)
    fresh.registerEquipment(equipment)
    fresh.registerAffixes(affixes)
    fresh.setActivePlayer(createDefaultPlayer())
    fresh.restoreFromSave(save)

    // The fresh session has NO pending ticket: commit by the old id
    // must fail instead of silently applying a roll the player paid for
    // in a different session (and whose display copy they cannot see).
    const commit = fresh.commitWashItem(instance.instanceId, preview.ticketId!)
    expect(commit.ok).toBe(false)
    expect(commit.reason).toBe('no_pending_wash')
    vi.restoreAllMocks()
  })
})
