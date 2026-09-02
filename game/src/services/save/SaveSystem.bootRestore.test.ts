import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { affixes } from '../../data/equipment/affixes'
import { equipment } from '../../data/equipment/equipment'
import { materials } from '../../data/materials/materials'
import { GameManager } from '../../core/game/GameManager'
import { makeInstance } from '../../core/equipment/EquipmentInstance.fixture'
import { LUYEN_KHI_TINH_HOA_ID } from '../../core/equipment/TinhHoaMaterial'
import { createDefaultPlayer } from '../../core/player/Player'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { usePlayerStore } from '../../stores/player'
import { buildGameSave, restoreGameSession, type GameSave } from './SaveSystem'

function createRegisteredManager(): GameManager {
  const manager = new GameManager()

  manager.registerMaterials(materials)
  manager.registerEquipment(equipment)
  manager.registerAffixes(affixes)

  return manager
}

function createIncomingSave(): GameSave {
  const manager = createRegisteredManager()
  const player = createDefaultPlayer()
  const instance = makeInstance({
    instanceId: 'boot-restore-incoming-item',
    itemId: 'base_kiem',
    equipped: true,
    realmLevel: 3,
    zoneId: 'thanh_van_dong',
    icon: '/equipment/boot-restore.png',
    mainStat: {
      id: 'boot-restore-incoming-main',
      sourceId: 'boot-restore-incoming-item',
      sourceType: 'equipment',
      stat: 'attack',
      flat: 12,
    },
    affixes: [{ affixId: 'suffix_accuracy', tier: 1, value: 3 }],
  })

  player.name = 'incoming-player'
  player.cultivation = 321
  manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 4)
  manager.equipmentBag.add(instance)

  return buildGameSave(player, manager)
}

function managerState(manager: GameManager): {
  save: GameSave
  equipmentModifiers: StatModifier[]
} {
  return {
    save: structuredClone(buildGameSave(createDefaultPlayer(), manager)),
    equipmentModifiers: structuredClone(manager.getEquipmentModifiers()),
  }
}

describe('App save restore coordinator', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(1_725_160_000_000)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    [
      'unknown equipment template',
      (save: GameSave) => { save.equipment[0]!.itemId = 'removed-boot-template' },
      'Unknown equipment template in save: removed-boot-template',
    ],
    [
      'unknown equipment affix',
      (save: GameSave) => { save.equipment[0]!.affixes[0]!.affixId = 'removed-boot-affix' },
      'Unknown equipment affix in save: removed-boot-affix',
    ],
  ] as const)(
    'rejects %s before Pinia or any manager owner mutates and returns a handled result',
    (_case, corrupt, expectedMessage) => {
      const player = usePlayerStore()
      const manager = createRegisteredManager()
      const save = createIncomingSave()

      player.name = 'existing-player'
      player.cultivation = 17
      manager.materialBag.add(manager.materialRegistry.get(LUYEN_KHI_TINH_HOA_ID), 11)
      corrupt(save)

      const playerRestore = vi.spyOn(player, 'restoreFromSave')
      const setActivePlayer = vi.spyOn(manager, 'setActivePlayer')
      const managerRestore = vi.spyOn(manager, 'restoreFromSave')
      const playerBefore = JSON.stringify(player.$state)
      const managersBefore = managerState(manager)
      let result: ReturnType<typeof restoreGameSession> | undefined

      expect(() => {
        result = restoreGameSession(player, manager, save)
      }).not.toThrow()
      expect(result).toEqual({ status: 'rejected', message: expectedMessage })
      expect(playerRestore).not.toHaveBeenCalled()
      expect(setActivePlayer).not.toHaveBeenCalled()
      expect(managerRestore).not.toHaveBeenCalled()
      expect(JSON.stringify(player.$state)).toBe(playerBefore)
      expect(managerState(manager)).toEqual(managersBefore)
    },
  )

  it('restores a valid save through the same Pinia/manager ordering', () => {
    const player = usePlayerStore()
    const manager = createRegisteredManager()
    const save = createIncomingSave()

    const result = restoreGameSession(player, manager, save)

    expect(result.status).toBe('ok')
    expect(player.name).toBe('incoming-player')
    expect(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(4)
    expect(manager.equipmentBag.get('boot-restore-incoming-item')).toMatchObject({
      equipped: true,
      realmLevel: 3,
      zoneId: 'thanh_van_dong',
      icon: '/equipment/boot-restore.png',
    })
    expect(manager.getEquipmentModifiers().length).toBeGreaterThan(0)
    expect(player.modifiers).toEqual(manager.getEquipmentModifiers())
  })
})
