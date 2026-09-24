// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalCloudSaveService } from './LocalCloudSaveService'
import {
  CURRENT_SAVE_VERSION,
  importSaveRaw,

  type GameSave,
} from '../save/SaveSystem'
import { resolveRevisionKey, resolveSaveKey } from '../save/saveKeys'
import { createDefaultPlayer } from '../../core/player/Player'

// Guest-slot keys (no account bound in this file).
const SAVE_KEY = resolveSaveKey()
const SAVE_REVISION_KEY = resolveRevisionKey()

// Mock Storage.prototype.setItem có chọn lọc: chỉ throw khi key khớp,
// các key khác vẫn ghi bình thường qua impl gốc.
function throwOnKey(keyToThrow: string): void {
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
    function (this: Storage, key: string, value: string) {
      if (key === keyToThrow) {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      }
      original.call(this, key, value)
    },
  )
}

function validSave(): GameSave {
  const player = createDefaultPlayer()

  // v82 contract (F-INT-03 import gate): the fixture must be a legal
  // save - pick + learned entry + core grant.
  player.mortalBasicSkillId = 'tram'
  player.nodeLevels = { ...player.nodeLevels, core_tram: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_tram']

  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [],
    skills: [
      {
        id: 'tram',
        name: 'Trảm',
        description: 'creation pick',
        type: 'active',
        level: 1,
        maxLevel: 10,
        cooldown: 0,
        target: 'enemy',
        effects: [],
      },
    ],
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

// 9.11 — thứ tự ghi phải là revision-first: SAVE_REVISION_KEY trước, SAVE_KEY
// sau; save write fail → rollback revision + trả failure (không fabricate
// success). Crash giữa 2 key giờ để lại revision mới + save cũ → CAS mismatch
// → coordinator resync, an toàn hơn stale-revision.
describe('LocalCloudSaveService.save — revision-first ordering + rollback (9.11)', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('SAVE_KEY write throw → unavailable + revision ROLLBACK về giá trị cũ, save cũ giữ nguyên', async () => {
    const save = validSave()
    localStorage.setItem(SAVE_KEY, 'OLD-SAVE')
    localStorage.setItem(SAVE_REVISION_KEY, '7')
    throwOnKey(SAVE_KEY)

    const result = await new LocalCloudSaveService().save(save, 7)

    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.retryable).toBe(true)
    }
    expect(localStorage.getItem(SAVE_REVISION_KEY)).toBe('7')
    expect(localStorage.getItem(SAVE_KEY)).toBe('OLD-SAVE')
  })

  it('revision write throw → unavailable + SAVE_KEY KHÔNG bị ghi (revision-first)', async () => {
    const save = validSave()
    localStorage.setItem(SAVE_KEY, 'OLD-SAVE')
    localStorage.setItem(SAVE_REVISION_KEY, '7')
    throwOnKey(SAVE_REVISION_KEY)

    const result = await new LocalCloudSaveService().save(save, 7)

    expect(result.status).toBe('unavailable')
    if (result.status === 'unavailable') {
      expect(result.retryable).toBe(true)
    }
    expect(localStorage.getItem(SAVE_KEY)).toBe('OLD-SAVE')
    expect(localStorage.getItem(SAVE_REVISION_KEY)).toBe('7')
  })

  it('cả hai write OK → revision mới ghi TRƯỚC save mới trong cùng một lần save()', async () => {
    const save = validSave()
    localStorage.setItem(SAVE_KEY, 'OLD-SAVE')
    localStorage.setItem(SAVE_REVISION_KEY, '7')
    const original = Storage.prototype.setItem
    const order: string[] = []
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      function (this: Storage, key: string, value: string) {
        if (key === SAVE_KEY || key === SAVE_REVISION_KEY) order.push(key)
        original.call(this, key, value)
      },
    )

    const result = await new LocalCloudSaveService().save(save, 7)

    expect(result).toEqual({ status: 'ok', revision: 8 })
    expect(order).toEqual([SAVE_REVISION_KEY, SAVE_KEY])
    expect(localStorage.getItem(SAVE_REVISION_KEY)).toBe('8')
    expect(localStorage.getItem(SAVE_KEY)).toBe(JSON.stringify(save))
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
      mainStat: { stat: 'might', flat: 1 },
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
