// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { EQUIPMENT_PROTECTION_CAP } from '../../core/equipment/EquipmentBag'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import type { GameSave } from './saveTypes'
import { primeMortalCreationPick } from './GameSave.fixture'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildings } from '../../data/building/buildings'
import { pills } from '../../data/pill/pills'
import { alchemyRecipes } from '../../data/alchemy/alchemyRecipes'

// Save-side pin cho ruling D-02: crafted save co the dat
// locked/favorite truc tiep tren entry (bo qua setProtected), nen cong
// nap phai tu choi payload co qua EQUIPMENT_PROTECTION_CAP mon duoc
// bao ve - unproducible giong kenh unprotected/soft-cap.

function validWireSave(): GameSave {
  const writer = new GameManager()
  writer.catalogOps.registerEquipment(equipment)
  writer.catalogOps.registerAffixes(affixes)
  writer.catalogOps.registerBuildings(buildings)
  writer.catalogOps.registerPills(pills)
  writer.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  const player = createDefaultPlayer()
  writer.setActivePlayer(player)
  primeMortalCreationPick(player, writer.skillManager)
  return JSON.parse(JSON.stringify(buildGameSave(player, writer))) as GameSave
}

describe('save gate — protected equipment cap pin (ruling D-02)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it(`${EQUIPMENT_PROTECTION_CAP + 1} protected entries -> save bi tu choi`, () => {
    const save = validWireSave()
    save.equipment = Array.from({ length: EQUIPMENT_PROTECTION_CAP + 1 }, (_v, i) => ({
      instanceId: `prot_${i}`,
      itemId: 'test_item',
      locked: true,
    })) as never

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(
      result.issues.some(
        (issue) => issue.path === 'equipment' && issue.message.includes('EQUIPMENT_PROTECTION_CAP'),
      ),
    ).toBe(true)
  })

  it(`${EQUIPMENT_PROTECTION_CAP} protected entries khong bi keo theo cap (khong giet save honest)`, () => {
    const save = validWireSave()
    save.equipment = Array.from({ length: EQUIPMENT_PROTECTION_CAP }, (_v, i) => ({
      instanceId: `prot_${i}`,
      itemId: 'test_item',
      favorite: true,
    })) as never

    const result = validateGameSaveShape(save)
    expect(
      result.issues.some((issue) => issue.message.includes('EQUIPMENT_PROTECTION_CAP')),
    ).toBe(false)
  })
})
