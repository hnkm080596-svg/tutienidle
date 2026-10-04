// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { EquipmentBag, EQUIPMENT_BAG_SOFT_CAP } from './EquipmentBag'
import type { EquipmentInstance } from './EquipmentInstance'
import { makeInstance as makeEquipmentInstance } from './EquipmentInstance.fixture'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'

// Cap mem + auto Hoa Luyen (audit 2026-08-31) - tui trang bi khong gioi
// han tung lam save phinh dan vuot localStorage quota. Vuot cap -> item
// "rac" nhat (khong trang bi/lock/favorite, pham chat thap nhat) bi tu
// Hoa Luyen, rewards Tinh Hoa tra ve CHO CALLER cong.

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

describe('EquipmentBag — soft cap + auto-dissolve', () => {
  let bag: EquipmentBag

  beforeEach(() => {
    bag = new EquipmentBag()
  })

  it('dưới cap: add trả [] và giữ nguyên item', () => {
    const rewards = bag.add(makeInstance('a'))

    expect(rewards).toEqual([])
    expect(bag.getAll()).toHaveLength(1)
  })

  it('membership generation đổi khi cùng object bị remove rồi add lại', () => {
    const instance = makeInstance('lifecycle')

    bag.add(instance)
    const firstMembership = bag.getMembershipGeneration(instance)

    expect(firstMembership).toBeTypeOf('number')

    bag.remove(instance.instanceId)
    expect(bag.getMembershipGeneration(instance)).toBeUndefined()

    bag.add(instance)
    expect(bag.getMembershipGeneration(instance)).toBeTypeOf('number')
    expect(bag.getMembershipGeneration(instance)).not.toBe(firstMembership)
  })

  it('vượt cap: item quality THẤP NHẤT (không protected) bị dissolve, item mới giữ lại, trả rewards', () => {
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP; i++) {
      bag.add(makeInstance(`fill_${i}`, { quality: 'hoang' }))
    }
    expect(bag.getAll()).toHaveLength(EQUIPMENT_BAG_SOFT_CAP)

    const rewards = bag.add(makeInstance('new_high', { quality: 'tien' }))

    expect(bag.getAll()).toHaveLength(EQUIPMENT_BAG_SOFT_CAP)
    expect(bag.getAll().some((instance) => instance.instanceId === 'new_high')).toBe(true)
    expect(bag.getAll().some((instance) => instance.instanceId === 'fill_0')).toBe(false)
    expect(rewards.length).toBeGreaterThan(0)
    // Moi Pham cung tra Luyen Khi Tinh Hoa; amount = range.min cua Chat
    // 'hoang' (auto-dissolve deterministic, khong roll random).
    expect(rewards[0]!.materialId).toBe(LUYEN_KHI_TINH_HOA_ID)
    expect(rewards[0]!.amount).toBe(1)
  })

  it('auto-dissolve kết thúc membership của exact object đã loại', () => {
    const candidate = makeInstance('candidate', { quality: 'hoang' })
    bag.add(candidate)

    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP; i++) {
      bag.add(makeInstance(`protected_${i}`, { quality: 'tien', locked: true }))
    }

    expect(bag.has(candidate.instanceId)).toBe(false)
    expect(bag.getMembershipGeneration(candidate)).toBeUndefined()
  })

  it('KHÔNG dissolve item equipped dù quality thấp', () => {
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP; i++) {
      bag.add(makeInstance(`fill_${i}`, { quality: 'hoang' }))
    }

    // Vuot cap 1 - immediate auto-dissolve chay NGAY trong add():
    // candidates la cac fill_* quality thap nhat, 'protected' dang
    // trang bi nen KHONG BAO GIO bi chon.
    bag.add(makeInstance('protected', { quality: 'hoang', equipped: true }))

    // Gio vuot cap 2 lan nua
    const rewards = bag.add(makeInstance('extra', { quality: 'tien' }))

    const after = bag.getAll()

    expect(after.length).toBeLessThanOrEqual(EQUIPMENT_BAG_SOFT_CAP)
    expect(after.some((instance) => instance.instanceId === 'protected')).toBe(true)
    expect(rewards.length).toBeGreaterThan(0)
  })

  it('KHÔNG dissolve item locked/favorite dù quality thấp nhất', () => {
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP - 1; i++) {
      bag.add(makeInstance(`fill_${i}`, { quality: 'hoang' }))
    }

    bag.add(makeInstance('locked_item', { quality: 'hoang', locked: true }))
    bag.add(makeInstance('fav_item', { quality: 'hoang', favorite: true }))

    const after = bag.getAll()

    expect(after.length).toBeLessThanOrEqual(EQUIPMENT_BAG_SOFT_CAP)
    expect(after.some((instance) => instance.instanceId === 'locked_item')).toBe(true)
    expect(after.some((instance) => instance.instanceId === 'fav_item')).toBe(true)
    expect(after.some((instance) => instance.instanceId === 'fill_0')).toBe(false)
  })

})
