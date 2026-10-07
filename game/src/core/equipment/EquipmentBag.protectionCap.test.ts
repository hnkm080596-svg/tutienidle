// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { EquipmentBag, EQUIPMENT_PROTECTION_CAP } from './EquipmentBag'
import type { EquipmentInstance } from './EquipmentInstance'
import { makeInstance as makeEquipmentInstance } from './EquipmentInstance.fixture'

// Ruling D-02 (owner): toi da 10 trang bi duoc bao ve (locked HOAC
// favorite). Khong co tran nay, nguoi choi that lock >1024 mon se tu day
// mang equipment trong save qua ID_COLLECTION_CAP -> save bi tu choi o
// cong ghi. setProtected() la writer duy nhat; save-side co pin
// EQUIPMENT_PROTECTION_CAP trong saveShapeValidation (crafted payload
// van bi chan o cong nap).

function makeInstance(id: string, opts: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return makeEquipmentInstance({
    instanceId: id,
    itemId: 'test_item',
    grade: 'bat_pham',
    quality: 'hoang',
    locked: false,
    favorite: false,
    forgeUsesRemaining: 0,
    mainStat: {
      id: `main_${id}`,
      sourceId: 'test_item',
      sourceType: 'equipment',
      stat: 'might',
      flat: 1,
    },
    ...opts,
  })
}

describe('EquipmentBag — protection cap (ruling D-02: toi da 10 mon lock/favorite)', () => {
  let bag: EquipmentBag

  beforeEach(() => {
    bag = new EquipmentBag()
    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP + 2; i += 1) {
      bag.add(makeInstance(`item_${i}`))
    }
  })

  it(`lock duoc ${EQUIPMENT_PROTECTION_CAP} mon; mon thu ${EQUIPMENT_PROTECTION_CAP + 1} bi tu choi 'protection_cap'`, () => {
    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP; i += 1) {
      expect(bag.setProtected(`item_${i}`, 'locked', true).ok).toBe(true)
    }

    const eleventh = bag.setProtected(`item_${EQUIPMENT_PROTECTION_CAP}`, 'locked', true)
    expect(eleventh.ok).toBe(false)
    expect(eleventh.reason).toBe('protection_cap')
    expect(bag.get(`item_${EQUIPMENT_PROTECTION_CAP}`)!.locked).not.toBe(true)
  })

  it('favorite tinh chung mot pool voi locked (union <= 10)', () => {
    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP - 1; i += 1) {
      bag.setProtected(`item_${i}`, 'locked', true)
    }
    bag.setProtected(`item_${EQUIPMENT_PROTECTION_CAP - 1}`, 'favorite', true)

    // Pool day: mon chua bao ve nao bi chan du la lock hay favorite.
    expect(bag.setProtected(`item_${EQUIPMENT_PROTECTION_CAP}`, 'favorite', true)).toEqual({
      ok: false,
      reason: 'protection_cap',
    })
    expect(bag.setProtected(`item_${EQUIPMENT_PROTECTION_CAP}`, 'locked', true)).toEqual({
      ok: false,
      reason: 'protection_cap',
    })
  })

  it('favorite them tren mon DA locked khong tang pool', () => {
    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP; i += 1) {
      bag.setProtected(`item_${i}`, 'locked', true)
    }
    // item_0 da locked -> favorite them van OK (union khong doi).
    expect(bag.setProtected('item_0', 'favorite', true).ok).toBe(true)
  })

  it('go bao ve giai phong slot ngay; idempotent theo tung flag', () => {
    for (let i = 0; i < EQUIPMENT_PROTECTION_CAP; i += 1) {
      bag.setProtected(`item_${i}`, 'locked', true)
    }
    expect(bag.setProtected(`item_${EQUIPMENT_PROTECTION_CAP}`, 'locked', true).ok).toBe(false)

    // Go 1 mon -> slot do duoc dung cho mon khac.
    expect(bag.setProtected('item_0', 'locked', false).ok).toBe(true)
    expect(bag.setProtected(`item_${EQUIPMENT_PROTECTION_CAP}`, 'locked', true).ok).toBe(true)

    // Idempotent: set lai flag dang bat la no-op, khong dem them.
    expect(bag.setProtected(`item_${EQUIPMENT_PROTECTION_CAP}`, 'locked', true).ok).toBe(true)
  })

  it('instanceId khong ton tai -> not_found', () => {
    expect(bag.setProtected('ghost', 'locked', true)).toEqual({ ok: false, reason: 'not_found' })
  })
})

