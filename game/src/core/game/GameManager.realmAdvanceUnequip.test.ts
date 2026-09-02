import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'
import { equipment } from '../../data/equipment/equipment'
import { SKILLS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'

// QA-2026-09-02-001 — thiết kế chốt (spec v6): chooseCultivationPath
// (Lễ Nhập Môn) là feature-unlock SAU đột phá mortal → qi_refining,
// KHÔNG phải một lần đột phá → KHÔNG auto-unequip và KHÔNG gate theo
// trang bị đang mặc. Auto-unequip thuộc về triggerBreakthroughAction
// (useTribulation.ts) — đường kiếp thật. Test này khóa hợp đồng đó.
function setup() {
  const manager = new GameManager()
  manager.registerSkillTemplates(SKILLS)
  manager.registerProgressionNodes(PHAP_TU_NODES)
  manager.registerEquipment(equipment)
  return manager
}

describe('GameManager — chooseCultivationPath realm advance và trang bị đang mặc (QA-2026-09-02-001)', () => {
  it('chooseCultivationPath KHÔNG auto-unequip — weapon vẫn equipped sau realm đổi', () => {
    const manager = setup()
    const player = createDefaultPlayer()
    player.realmLevel = 12

    const weapon = makeInstance({
      instanceId: 'realm-advance-weapon',
      itemId: 'base_kiem',
      grade: 'cuu_pham',
      equipped: true,
    })
    manager.equipmentBag.add(weapon)

    expect(manager.chooseCultivationPath('phap_tu', player)).toBe(true)
    expect(player.realmId).toBe('qi_refining')
    expect(weapon.equipped).toBe(true)
  })
})
