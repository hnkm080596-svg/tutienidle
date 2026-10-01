// QA falsification probes - blind TERMINAL_CHECK sweep at 77aecae0.
//
// Contract under test: a defect = a persisted claim NO authored writer
// could produce being accepted AND minting live effects, or dormant
// scope leaking into visible play.
//
// Two writer-inventory gaps found that minted at restore; both are now
// bound at validateGameSaveShape (fix on the T24 wave):
//
// F-EQ-COUNT-1  save.equipment carries no array-length bound. The only
//               writer, EquipmentBag.add(), dissolves overflow at
//               pickup time, so a legit save can never exceed
//               EQUIPMENT_BAG_SOFT_CAP (500). A payload past the cap is
//               unproducible by construction - yet restore feeds every
//               entry through add() again and the resulting
//               autoDissolveOverflow rewards are paid into materialBag
//               as luyen_khi_tinh_hoa (GameManagerSaveRestore.ts:281-301).
//               Mint: forged-item-count x ITEM_QUALITY_ESSENCE_RANGE.min
//               essence per crafted save, re-payable on every injection.
//
// F-BLD-DUP-1   save.buildings entries are validated per-entry (shape,
//               level <= maxLevel, level <= realm tier, accrual pin <=
//               player realm) but never deduplicated on buildingId or
//               instanceId. Every building template is category
//               'crafting_station', and canBuildDetailed returns
//               'already_built' for that category - a second instance of
//               the same buildingId is unproducible by the sole writer.
//               BuildingManager.restore maps entries verbatim
//               (BuildingManager.ts:39-41), and claim(instanceId) pays
//               each instance's independent accrual window
//               (BuildingSystem.claim -> collectBuilding -> materialBag).
//               Mint: N forged duplicates = N x authored accrual.
import { describe, expect, it } from 'vitest'

import { createDefaultPlayer } from '../../src/core/player/Player'
import { GameManager } from '../../src/core/game/GameManager'
import { EQUIPMENT_BAG_SOFT_CAP } from '../../src/core/equipment/EquipmentBag'
import { ITEM_QUALITY_ESSENCE_RANGE } from '../../src/core/equipment/ItemQualityBalance'
import { LUYEN_KHI_TINH_HOA_ID } from '../../src/core/equipment/TinhHoaMaterial'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { buildings } from '../../src/data/building/buildings'
import { equipment } from '../../src/data/equipment/equipment'
import { affixes } from '../../src/data/equipment/affixes'
import { materials } from '../../src/data/materials/materials'
import { lockBetaFeaturesForTests } from '../../src/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../src/core/game/__fixtures__/betaTalentsUnlock'
import type { GameSave } from '../../src/services/save/SaveSystem'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player() {
  const p = createDefaultPlayer()
  p.mortalBasicSkillId = 'linh_bao'
  return p
}

function validSave() {
  const p = player()
  p.nodeLevels = { ...p.nodeLevels, core_linh_bao: 1 }
  p.purchasedNodeIds = [...p.purchasedNodeIds, 'core_linh_bao']

  return {
    version: CURRENT_SAVE_VERSION,
    player: p,
    techniques: [],
    skills: [
      {
        id: 'linh_bao',
        name: 'Linh Bao',
        description: 'pick',
        type: 'active',
        level: 1,
        maxLevel: 10,
        cooldown: 1,
        target: 'enemy',
        effects: [],
      },
    ],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    productionSites: [],
    alchemyJobs: [],
  } as Record<string, unknown>
}

// A maximally valid forged instance: registered template, authored slot,
// unequipped (the equipped-grade realm bound only fires on equipped
// claims), highest essence-paying quality, flat main stat inside the
// authored roll bound, empty affixes, zero forge uses, unprotected.
function forgedItem(index: number, quality: 'hoang' | 'tien' = 'tien') {
  return {
    instanceId: `eq-forged-${index}`,
    itemId: 'base_quyen',
    slot: 'weapon',
    equipped: false,
    grade: 'cuu_pham',
    quality,
    mainStat: {
      id: `m-${index}`,
      sourceId: 'base_quyen',
      sourceType: 'equipment',
      stat: 'might',
      flat: 12,
    },
    affixes: [],
    forgeUsesTotal: 0,
    forgeUsesRemaining: 0,
  }
}

function forgedEquipmentBag(count: number) {
  return Array.from({ length: count }, (_, i) => forgedItem(i))
}

describe('F-EQ-COUNT-1: equipment array writer-producible count bound', () => {
  it('a save carrying 500 + 5 unprotected items is rejected at the shape gate', () => {
    const save = validSave()
    save.equipment = forgedEquipmentBag(EQUIPMENT_BAG_SOFT_CAP + 5)

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('control: a cap of unprotected plus extra protected (locked) entries is accepted', () => {
    const save = validSave()
    const locked = forgedEquipmentBag(10).map((entry, i) => ({
      ...entry,
      instanceId: `eq-locked-${i}`,
      locked: true,
    }))
    save.equipment = [...forgedEquipmentBag(EQUIPMENT_BAG_SOFT_CAP), ...locked]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('restore auto-dissolves the forged overflow and mints luyen_khi_tinh_hoa', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerEquipment(equipment)
    manager.catalogOps.registerAffixes(affixes)
    const p = player()
    manager.setActivePlayer(p)

    const save = validSave()
    save.equipment = forgedEquipmentBag(EQUIPMENT_BAG_SOFT_CAP + 5)

    manager.saveOps.restoreFromSave(save as unknown as GameSave)

    // 5 forged overflow items x ITEM_QUALITY_ESSENCE_RANGE.tien.min (5).
    expect(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(
      5 * ITEM_QUALITY_ESSENCE_RANGE.tien.min,
    )
    expect(manager.equipmentBag.getAll().length).toBe(EQUIPMENT_BAG_SOFT_CAP)
  })

  it('control: a legit at-cap bag mints nothing', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerEquipment(equipment)
    manager.catalogOps.registerAffixes(affixes)
    manager.setActivePlayer(player())

    const save = validSave()
    save.equipment = forgedEquipmentBag(EQUIPMENT_BAG_SOFT_CAP)

    manager.saveOps.restoreFromSave(save as unknown as GameSave)

    expect(manager.materialBag.getAmount(LUYEN_KHI_TINH_HOA_ID)).toBe(0)
  })
})

describe('F-BLD-DUP-1: duplicate buildingId/instanceId instances are rejected', () => {
  const dupBuildings = [
    { instanceId: 'b-1', buildingId: 'gathering_outpost', level: 1, lastCollectedAt: 0 },
    { instanceId: 'b-2', buildingId: 'gathering_outpost', level: 1, lastCollectedAt: 0 },
  ]

  it('two instances of a single-instance-gated building are rejected at the shape gate', () => {
    const save = validSave()
    save.buildings = structuredClone(dupBuildings)

    // The sole writer (build()) can never place a second crafting_station
    // of the same buildingId - 'already_built' rejects it - so this
    // payload is unproducible by construction.
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('duplicate instanceId is rejected even across distinct buildings', () => {
    const save = validSave()
    save.buildings = [
      { instanceId: 'b-1', buildingId: 'gathering_outpost', level: 1, lastCollectedAt: 0 },
      { instanceId: 'b-1', buildingId: 'pill_room', level: 1, lastCollectedAt: 0 },
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('restore keeps both instances and each claims its own accrual', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerBuildings(buildings)
    manager.catalogOps.registerEquipment(equipment)
    manager.catalogOps.registerAffixes(affixes)
    const p = player()
    manager.setActivePlayer(p)

    const save = validSave()
    save.buildings = structuredClone(dupBuildings)

    manager.saveOps.restoreFromSave(save as unknown as GameSave)

    expect(manager.buildingManager.getAll().length).toBe(2)

    const claimA = manager.buildingOps.collectBuilding('b-1', p, 100_000)
    const claimB = manager.buildingOps.collectBuilding('b-2', p, 100_000)

    // N forged instances => N x the authored accrual window.
    expect(claimA).toBeGreaterThan(0)
    expect(claimB).toBe(claimA)
  })

  it('control: one instance pays its window once then stops', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerBuildings(buildings)
    manager.catalogOps.registerEquipment(equipment)
    manager.catalogOps.registerAffixes(affixes)
    const p = player()
    manager.setActivePlayer(p)

    const save = validSave()
    save.buildings = [structuredClone(dupBuildings[0])]

    manager.saveOps.restoreFromSave(save as unknown as GameSave)

    const first = manager.buildingOps.collectBuilding('b-1', p, 100_000)
    const second = manager.buildingOps.collectBuilding('b-1', p, 100_000)

    expect(first).toBeGreaterThan(0)
    expect(second).toBe(0)
  })
})
