import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'
import { equipment } from '../../data/equipment/equipment'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// QA-2026-09-02-001 — chooseCultivationPath (Lễ Nhập Môn) đổi realmId
// mortal → qi_refining KHÔNG gọi unequipAllEquipment(), trong khi đường
// tribulation (useTribulation.ts:164) thì có. Nếu người chơi tự tháo đồ
// sau đó, gate phẩm (Task 16) chặn re-equip đồ phẩm cũ → kẹt.
//
// Test 1 (reproduction) đã bị COMMENT theo quyết định user 2026-09-02 —
// giữ lại làm EVIDENCE của defect CONFIRMED (xem
// game/docs/qa/2026-09-02-combat-tribulation-deep.md + learned-defects.md
// QA-2026-09-02-001). RE-ENABLE khi production fix
// (chooseCultivationPath gọi unequipAllEquipment khi đổi realm) vào hạn.
// Test 2 giữ nguyên — khóa contract gate phẩm chặn re-equip (đang PASS).
function setup() {
  const manager = new GameManager()
  manager.registerSkillTemplates(SKILLS)
  manager.registerProgressionNodes(PHAP_TU_NODES)
  manager.registerEquipment(equipment)
  return manager
}

describe('GameManager — chooseCultivationPath realm advance và trang bị đang mặc (QA-2026-09-02-001)', () => {
  // COMMENTED (evidence, user 2026-09-02) — reproduction của defect
  // CONFIRMED QA-2026-09-02-001; đang FAIL vì production chưa fix.
  // Re-enable khi fix vào hạn — body gốc nằm trong git history commit
  // deecb9e và block comment dưới đây.
  // it('chooseCultivationPath("phap_tu") giữ trang bị equipped sau khi realm đổi mortal → qi_refining', () => {
  //   const manager = setup()
  //   const player = createDefaultPlayer()
  //   player.realmLevel = 12
  //
  //   const weapon = makeInstance({
  //     instanceId: 'realm-advance-weapon',
  //     itemId: 'base_kiem',
  //     grade: 'cuu_pham',
  //     equipped: false,
  //   })
  //   manager.equipmentBag.add(weapon)
  //   expect(manager.equipItem(weapon.instanceId, player)).toEqual({ ok: true })
  //   expect(weapon.equipped).toBe(true)
  //
  //   expect(manager.chooseCultivationPath('phap_tu', player)).toBe(true)
  //   expect(player.realmId).toBe('qi_refining')
  //
  //   // Contract tương đương tribulation path (useTribulation.ts:164): mọi
  //   // trang bị phải bị tháo NGAY khi realm đổi để tránh kẹt gate phẩm.
  //   // Hiện tại instance vẫn equipped — reproduction của QA-2026-09-02-001.
  //   expect(weapon.equipped).toBe(false)
  //   expect(manager.equipmentBag.getEquipped()).toHaveLength(0)
  // })

  it('after chooseCultivationPath, trang bị phẩm cũ bị gate chặn re-equip (kẹt lặng lẽ)', () => {
    const manager = setup()
    const player = createDefaultPlayer()
    player.realmLevel = 12

    const weapon = makeInstance({
      instanceId: 'realm-advance-stuck-weapon',
      itemId: 'base_kiem',
      grade: 'cuu_pham',
      equipped: false,
    })
    manager.equipmentBag.add(weapon)
    manager.equipItem(weapon.instanceId, player)
    manager.chooseCultivationPath('phap_tu', player)

    // Sau realm advance, weapon vẫn equipped:false (nếu bug còn) và player
    // ở qi_refining nên cuu_pham bị chặn — người chơi không thể mặc lại.
    manager.unequipItem(weapon.instanceId)

    expect(manager.equipItem(weapon.instanceId, player)).toEqual({
      ok: false,
      reason: 'grade_mismatch',
    })
  })
})
