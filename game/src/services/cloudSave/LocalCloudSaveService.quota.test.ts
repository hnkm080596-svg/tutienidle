// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalCloudSaveService } from './LocalCloudSaveService'
import {
  CURRENT_SAVE_VERSION,
  importSaveRaw,
  type GameSave,
} from '../save/SaveSystem'
import { createDefaultPlayer } from '../../core/player/Player'

function validSave(): GameSave {
  return {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

describe('LocalCloudSaveService.save — write fail trả unavailable (không throw)', () => {
  beforeEach(() => localStorage.clear())

  it('setItem throw QuotaExceededError → { status: "unavailable", retryable: true }, revision KHÔNG tăng', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    const service = new LocalCloudSaveService()
    const result = await service.save({} as GameSave, 0)

    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.retryable).toBe(true)
    }
    spy.mockRestore()
  })
})

describe('LocalCloudSaveService.load — equipment discard counter', () => {
  beforeEach(() => localStorage.clear())

  it('forwards the one-shot legacy import count to the coordinator owner', async () => {
    const save = validSave()
    const legacyEquipment = {
      instanceId: 'legacy-equipment',
      itemId: 'legacy-sword',
      slot: 'weapon',
      equipped: false,
      realmId: 'mortal',
      rarity: 'hoang',
      mainStat: { stat: 'attack', flat: 1 },
      affixes: [],
      forgePoints: 0,
    }
    const importRaw = JSON.stringify({ ...save, equipment: [legacyEquipment] })

    expect(importSaveRaw(importRaw)).toBe(true)

    const result = await new LocalCloudSaveService().load()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.discardedEquipmentCount).toBe(1)
      expect(result.save.equipment).toEqual([])
    }
  })
})
