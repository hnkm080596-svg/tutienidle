import { describe, expect, it } from 'vitest'
import { EquipmentBag } from './EquipmentBag'
import { makeInstance } from './EquipmentInstance.fixture'
import type { EquipmentInstance } from './EquipmentInstance'

// OPT-04 — slotIndex phải luôn khớp ground truth (filter trực tiếp
// mảng instances) sau mọi chu trình add/equip/swap/unequip/remove.

function groundTruthEquipped(bag: EquipmentBag): EquipmentInstance[] {
  return bag.getAll().filter((instance) => instance.equipped)
}

function assertIndexConsistent(bag: EquipmentBag) {
  const equipped = groundTruthEquipped(bag)

  expect(bag.getEquipped()).toHaveLength(equipped.length)

  for (const instance of equipped) {
    expect(bag.getEquippedInSlot(instance.slot)).toBe(instance)
  }

  for (const instance of bag.getAll()) {
    if (!instance.equipped) {
      const indexed = bag.getEquippedInSlot(instance.slot)

      expect(indexed?.instanceId ?? null).not.toBe(instance.instanceId)
    }
  }
}

describe('EquipmentBag — OPT-04 slot index consistency', () => {
  it('add equipped → getEquipped/getEquippedInSlot thấy ngay, không cần filter', () => {
    const bag = new EquipmentBag()
    const weapon = makeInstance({ instanceId: 'w1', slot: 'weapon', equipped: true })

    bag.add(weapon)

    expect(bag.getEquipped()).toEqual([weapon])
    expect(bag.getEquippedInSlot('weapon')).toBe(weapon)
    assertIndexConsistent(bag)
  })

  it('setEquippedInternal flip 2 chiều giữ index nhất quán', () => {
    const bag = new EquipmentBag()
    const weapon = makeInstance({ instanceId: 'w1', slot: 'weapon' })

    bag.add(weapon)
    expect(bag.getEquippedInSlot('weapon')).toBeUndefined()

    expect(bag.setEquippedInternal('w1', true)).toBe(true)
    expect(weapon.equipped).toBe(true)
    expect(bag.getEquippedInSlot('weapon')).toBe(weapon)

    expect(bag.setEquippedInternal('w1', false)).toBe(true)
    expect(weapon.equipped).toBe(false)
    expect(bag.getEquippedInSlot('weapon')).toBeUndefined()
    assertIndexConsistent(bag)
  })

  it('swap slot: index mới thắng, slot cũ tự gỡ', () => {
    const bag = new EquipmentBag()
    const a = makeInstance({ instanceId: 'a', slot: 'weapon', equipped: true })
    const b = makeInstance({ instanceId: 'b', slot: 'weapon' })

    bag.add(a)
    bag.add(b)

    bag.setEquippedInternal('b', true)

    expect(a.equipped).toBe(false)
    expect(bag.getEquippedInSlot('weapon')).toBe(b)
    expect(bag.getEquipped()).toEqual([b])
    assertIndexConsistent(bag)
  })

  it('remove instance equipped → slot trống', () => {
    const bag = new EquipmentBag()
    const weapon = makeInstance({ instanceId: 'w1', slot: 'weapon', equipped: true })

    bag.add(weapon)
    bag.remove('w1')

    expect(bag.getEquippedInSlot('weapon')).toBeUndefined()
    expect(bag.getEquipped()).toEqual([])
    assertIndexConsistent(bag)
  })

  it('chu trình add→equip→swap→unequip→remove giữ bất biến mọi bước', () => {
    const bag = new EquipmentBag()
    const w1 = makeInstance({ instanceId: 'w1', slot: 'weapon' })
    const w2 = makeInstance({ instanceId: 'w2', slot: 'weapon' })
    const h1 = makeInstance({ instanceId: 'h1', slot: 'helmet' })

    bag.add(w1)
    assertIndexConsistent(bag)

    bag.setEquippedInternal('w1', true)
    assertIndexConsistent(bag)

    bag.add(h1)
    bag.setEquippedInternal('h1', true)
    assertIndexConsistent(bag)

    bag.setEquippedInternal('w2', false)
    bag.add(w2)
    bag.setEquippedInternal('w2', true)
    assertIndexConsistent(bag)

    bag.setEquippedInternal('h1', false)
    assertIndexConsistent(bag)

    bag.remove('w2')
    assertIndexConsistent(bag)

    expect(bag.getEquippedInSlot('weapon')).toBeUndefined()
    expect(bag.getEquipped()).toEqual([])
  })

  it('setEquippedInternal id không tồn tại → false, không đổi state', () => {
    const bag = new EquipmentBag()
    const weapon = makeInstance({ instanceId: 'w1', slot: 'weapon' })

    bag.add(weapon)

    expect(bag.setEquippedInternal('khong-ton-tai', true)).toBe(false)
    expect(weapon.equipped).toBe(false)
    assertIndexConsistent(bag)
  })
})
