import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'
import { equipment } from '../../data/equipment/equipment'

// Task 16 (rework P5) — equip() gate ngang phẩm: instance.grade phải khớp
// ĐÚNG phẩm nghề theo cảnh giới hiện tại của người chơi (canUseItemGrade),
// không phải "đủ hoặc cao hơn" — lệch bậc nào cũng bị chặn.
describe('GameManager — equipItem() grade gate (rework P5, Task 16)', () => {
  function setup() {
    const manager = new GameManager()
    manager.registerEquipment(equipment)
    const player = createDefaultPlayer()
    return { manager, player }
  }

  it('item cùng phẩm với cảnh giới người chơi → equip thành công', () => {
    const { manager, player } = setup()
    player.realmId = 'mortal'

    const instance = makeInstance({
      instanceId: 'gate-same-grade',
      itemId: 'base_kiem',
      grade: 'cuu_pham',
    })
    manager.equipmentBag.add(instance)

    expect(manager.equipItem(instance.instanceId, player)).toEqual({ ok: true })
    expect(instance.equipped).toBe(true)
  })

  it('item phẩm cao hơn cảnh giới người chơi 1 bậc → grade_mismatch', () => {
    const { manager, player } = setup()
    player.realmId = 'mortal'

    const instance = makeInstance({
      instanceId: 'gate-higher-grade',
      itemId: 'base_kiem',
      grade: 'bat_pham',
    })
    manager.equipmentBag.add(instance)

    expect(manager.equipItem(instance.instanceId, player)).toEqual({
      ok: false,
      reason: 'grade_mismatch',
    })
    expect(instance.equipped).toBe(false)
  })

  it('item phẩm thấp hơn cảnh giới người chơi 1 bậc → grade_mismatch', () => {
    const { manager, player } = setup()
    player.realmId = 'qi_refining'

    const instance = makeInstance({
      instanceId: 'gate-lower-grade',
      itemId: 'base_kiem',
      grade: 'cuu_pham',
    })
    manager.equipmentBag.add(instance)

    expect(manager.equipItem(instance.instanceId, player)).toEqual({
      ok: false,
      reason: 'grade_mismatch',
    })
    expect(instance.equipped).toBe(false)
  })

  it('item đang mặc rồi → idempotent ok:true dù cảnh giới người chơi đã đổi khác phẩm item', () => {
    const { manager, player } = setup()
    player.realmId = 'mortal'

    const instance = makeInstance({
      instanceId: 'gate-idempotent',
      itemId: 'base_kiem',
      grade: 'bat_pham',
      equipped: true,
    })
    manager.equipmentBag.add(instance)

    expect(manager.equipItem(instance.instanceId, player)).toEqual({ ok: true })
  })

  it('instanceId không tồn tại → not_found', () => {
    const { manager, player } = setup()

    expect(manager.equipItem('does-not-exist', player)).toEqual({
      ok: false,
      reason: 'not_found',
    })
  })
})
