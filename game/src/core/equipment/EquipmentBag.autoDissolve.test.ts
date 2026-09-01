// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { EquipmentBag, EQUIPMENT_BAG_SOFT_CAP } from './EquipmentBag'
import type { EquipmentInstance } from './EquipmentInstance'

// Cap mềm + auto Hóa Luyện (audit 2026-08-31) — túi trang bị không giới
// hạn từng làm save phình dần vượt localStorage quota. Vượt cap → item
// "rác" nhất (không trang bị/lock/favorite, phẩm chất thấp nhất) bị tự
// Hóa Luyện, rewards Tinh Hoa trả về CHO CALLER cộng.

function makeInstance(id: string, opts: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    instanceId: id,
    itemId: 'test_item',
    slot: 'weapon',
    realmId: 'qi_refining',
    rarity: 'hoang',
    quality: 'pham_khi',
    equipped: false,
    locked: false,
    favorite: false,
    forgePoints: 0,
    forgePotential: 100,
    mainStat: {
      id: `main_${id}`,
      sourceId: 'test_item',
      sourceType: 'equipment',
      stat: 'attack',
      flat: 1,
    },
    affixes: [],
    ...opts,
  }
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

  it('vượt cap: item quality THẤP NHẤT (không protected) bị dissolve, item mới giữ lại, trả rewards', () => {
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP; i++) {
      bag.add(makeInstance(`fill_${i}`, { quality: 'pham_khi' }))
    }
    expect(bag.getAll()).toHaveLength(EQUIPMENT_BAG_SOFT_CAP)

    const rewards = bag.add(makeInstance('new_high', { quality: 'tien_bao' }))

    expect(bag.getAll()).toHaveLength(EQUIPMENT_BAG_SOFT_CAP)
    expect(bag.getAll().some((instance) => instance.instanceId === 'new_high')).toBe(true)
    expect(bag.getAll().some((instance) => instance.instanceId === 'fill_0')).toBe(false)
    expect(rewards.length).toBeGreaterThan(0)
    // Reward đúng material essence của realm item bị dissolve (qi_refining
    // → tinh_hoa_bao_khi theo RefinementBalance.ts), amount = range.min của
    // rarity 'hoang' (auto-dissolve deterministic, không roll random).
    expect(rewards[0]!.materialId).toBe('tinh_hoa_bao_khi')
    expect(rewards[0]!.amount).toBe(1)
  })

  it('KHÔNG dissolve item equipped dù quality thấp', () => {
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP; i++) {
      bag.add(makeInstance(`fill_${i}`, { quality: 'pham_khi' }))
    }

    // Vượt cap 1 — immediate auto-dissolve chạy NGAY trong add():
    // candidates là các fill_* quality thấp nhất, 'protected' đang
    // trang bị nên KHÔNG BAO GIỜ bị chọn.
    bag.add(makeInstance('protected', { quality: 'pham_khi', equipped: true }))

    // Giờ vượt cap 2 lần nữa
    const rewards = bag.add(makeInstance('extra', { quality: 'tien_bao' }))

    const after = bag.getAll()

    expect(after.length).toBeLessThanOrEqual(EQUIPMENT_BAG_SOFT_CAP)
    expect(after.some((instance) => instance.instanceId === 'protected')).toBe(true)
    expect(rewards.length).toBeGreaterThan(0)
  })

  it('KHÔNG dissolve item locked/favorite dù quality thấp nhất', () => {
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP - 1; i++) {
      bag.add(makeInstance(`fill_${i}`, { quality: 'pham_khi' }))
    }

    bag.add(makeInstance('locked_item', { quality: 'pham_khi', locked: true }))
    bag.add(makeInstance('fav_item', { quality: 'pham_khi', favorite: true }))

    const after = bag.getAll()

    expect(after.length).toBeLessThanOrEqual(EQUIPMENT_BAG_SOFT_CAP)
    expect(after.some((instance) => instance.instanceId === 'locked_item')).toBe(true)
    expect(after.some((instance) => instance.instanceId === 'fav_item')).toBe(true)
    expect(after.some((instance) => instance.instanceId === 'fill_0')).toBe(false)
  })

  it('KHÔNG dissolve mù khi item không có rule chuyển đổi (realm chưa map) — giữ item, trả []', () => {
    for (let i = 0; i < EQUIPMENT_BAG_SOFT_CAP; i++) {
      bag.add(makeInstance(`fill_${i}`, { realmId: 'realm_khong_ton_tai' }))
    }

    const rewards = bag.add(makeInstance('extra', { realmId: 'realm_khong_ton_tai' }))

    // Không có essence mapping → bỏ qua, giữ item (bag được vượt cap
    // trong case bệnh hoạn này thay vì dissolve mù mất đồ người chơi).
    expect(rewards).toEqual([])
    expect(bag.getAll()).toHaveLength(EQUIPMENT_BAG_SOFT_CAP + 1)
    expect(bag.getAll().some((instance) => instance.instanceId === 'extra')).toBe(true)
  })
})
