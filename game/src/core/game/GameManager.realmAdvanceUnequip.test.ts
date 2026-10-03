import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'
import { equipment } from '../../data/equipment/equipment'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { commitSpellInitiationForTest } from './__fixtures__/betaWaysUnlock'

// QA-2026-09-02-001 - RESOLVED 2026-09-02 qua redesign Task 9.1 (spec v6):
// chooseCultivationPath (Le Nhap Mon) la feature-unlock SAU dot pha
// mortal -> qi_refining, KHONG phai mot lan dot pha -> KHONG auto-unequip
// va KHONG gate theo trang bi dang mac. Auto-unequip thuoc ve
// triggerBreakthroughAction (useTribulation.ts) - duong kiep that, chay
// cho MOI lan dot pha. Reproduction cu (ky vong auto-unequip) nam trong
// git history (deecb9e, commit 3fa501f tren master). Test nay khoa hop dong moi.
function setup() {
  const manager = new GameManager()
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  manager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  manager.catalogOps.registerEquipment(equipment)
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

    commitSpellInitiationForTest(manager, player)
    expect(player.realmId).toBe('qi_refining')
    expect(weapon.equipped).toBe(true)
  })
})
