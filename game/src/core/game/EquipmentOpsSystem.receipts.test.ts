import { describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { equipment } from '../../data/equipment/equipment'
import { materials } from '../../data/materials/materials'
import { SKILLS } from '../../data/skill/Skills'
import { primeMortalCreationPick } from '../../services/save/GameSave.fixture'
import { buildGameSave } from '../../services/save/SaveSystem'
import { validateGameSaveShape } from '../../services/save/saveShapeValidation'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { MAX_STACK_AMOUNT } from '../inventory/StackLimits'
import type { Quest } from '../quest/Quest'
import type { GameSave } from '../../services/save/saveTypes'

const quest: Quest = { id: 'dissolve_receipts', name: 'Dissolve', description: '', cadence: 'once',
  condition: { kind: 'collect', materialId: LUYEN_KHI_TINH_HOA_ID, amount: 100_000 }, reward: {} }
function setup(count = 0) {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerQuests([quest])
  const player = createDefaultPlayer()
  primeMortalCreationPick(player, manager.skillManager)
  manager.setActivePlayer(player)
  manager.questManager.ensureActive(quest)
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const item = manager.equipmentSystem.createInstance(equipment[0]!, player, manager.affixRegistry)
    item.quality = 'hoang'
    manager.equipmentBag.add(item)
    ids.push(item.instanceId)
  }
  return { manager, player, ids }
}

describe('equipment dissolution durable material delivery', () => {
  it.each([64, 65, 500])('delivers every reward for %i selected items in one bounded receipt', (count) => {
    const { manager, player, ids } = setup(count)
    const credit = vi.spyOn(manager.materialBag, 'credit')
    const result = manager.equipmentOps.dissolveItems(ids)
    expect(result.ok).toBe(true)
    expect(result.rewards).toHaveLength(count)
    const total = result.rewards!.reduce((sum, reward) => sum + reward.amount, 0)
    expect(manager.equipmentBag.getAll()).toHaveLength(0)
    expect(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(total)
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(total)
    expect(manager.materialBag.receiptSnapshot()).toMatchObject({ sequence: 1, acknowledgedThrough: 1, pending: [] })
    const grant = credit.mock.results[0]!.value as ReturnType<GameManager['materialBag']['credit']>
    const save = JSON.parse(JSON.stringify(buildGameSave(player, manager))) as GameSave
    expect(validateGameSaveShape(save).ok).toBe(true)
    const reopened = setup()
    reopened.manager.saveOps.restoreFromSave(save)
    reopened.manager.questOps.notifyMaterialGained(grant.materialId, total, grant.receipt)
    expect(reopened.manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(total)
    expect(reopened.manager.questManager.getProgress(quest.id)?.progress).toBe(total)
    expect(reopened.manager.equipmentOps.dissolveItems(ids).ok).toBe(false)
    expect(reopened.manager.materialBag.receiptSnapshot().sequence).toBe(1)
  })

  it.each([0, 1])('counts only %i delivered essence on overflow while retaining per-item rewards', (room) => {
    const { manager, ids } = setup(65)
    const material = manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID)
    const limit = material.stackLimit ?? MAX_STACK_AMOUNT
    manager.materialBag.add(material, limit - room)
    const result = manager.equipmentOps.dissolveItems(ids)
    expect(result.ok).toBe(true)
    expect(result.rewards).toHaveLength(65)
    expect(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(limit)
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(room)
    expect(manager.equipmentBag.getAll()).toHaveLength(0)
  })

  it('retries a failed consumer before removing any newly selected item', () => {
    const { manager, ids } = setup(66)
    const failure = vi.spyOn(manager.questManager, 'consumeMaterialGrant').mockImplementation(() => { throw new Error('consumer unavailable') })
    expect(manager.equipmentOps.dissolveItems(ids.slice(0, 65)).ok).toBe(true)
    const committed = manager.materialBag.getAll()
    expect(manager.materialBag.receiptSnapshot().pending).toHaveLength(1)
    expect(() => manager.equipmentOps.dissolveItems(ids.slice(65))).toThrow('consumer unavailable')
    expect(manager.equipmentBag.has(ids[65]!)).toBe(true)
    expect(manager.materialBag.getAll()).toEqual(committed)
    failure.mockRestore()
    expect(manager.equipmentOps.dissolveItems(ids.slice(65)).ok).toBe(true)
    expect(manager.equipmentBag.getAll()).toHaveLength(0)
    expect(manager.questManager.getProgress(quest.id)?.progress).toBe(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID))
  })
})
