// QA pin - claimed-source forgery wave (blind A7/TC5 sweep on
// 3e802342). The save acceptance layer and the emit seams both have to
// reject claims no legal writer could mint:
//
// F-A7-1  player.modifiers entries claiming sources outside the
//         enumerable persisted writers (realm passives + meridians +
//         loi kiep + the rebuilt equipment slice) are fabricated and
//         must be flagged at the boundary AND emit nothing.
// F-A7-2  persistentTimedEffects entries claiming a sourceItemId that
//         is neither 'tu_linh_tran' nor an authored pill, a duplicated
//         effectGroup, or a surface the writer cannot mint (non-empty
//         modifiers on tu_linh_tran, cultivationSpeedPercent outside
//         (0, 0.25], cultivationSpeedPercent on a pill entry) are
//         fabricated and emit nothing.
// F-A7-3  a carried alchemy job whose pillId disagrees with its recipe
//         is fabricated; settle delivers the recipe's authored pill.
// F-TC5-1 a building accrualRealmId pin above the player's realm (or
//         unknown) is a forged accrual window; claim must not mint the
//         fabricated realm's material tier or rate. Same bound applies
//         to a production cycle's collectionRealmId.
import { describe, expect, it } from 'vitest'

import { createDefaultPlayer } from '../../src/core/player/Player'
import { resolvePlayerStatAssembly } from '../../src/core/player/Player'
import { GameManager } from '../../src/core/game/GameManager'
import { BuildingSystem } from '../../src/core/building/BuildingSystem'
import { BuildingRegistry } from '../../src/core/building/BuildingRegistry'
import { BuildingManager } from '../../src/core/building/BuildingManager'
import type { Building } from '../../src/core/building/Building'
import type { BuildingInstance } from '../../src/core/building/BuildingInstance'
import { getActiveCultivationSpeedPercent } from '../../src/core/economy/TuLinhTranBalance'
import { alchemyRecipes } from '../../src/data/alchemy/alchemyRecipes'
import { materials } from '../../src/data/materials/materials'
import { pills } from '../../src/data/pill/pills'
import { equipment } from '../../src/data/equipment/equipment'
import { affixes } from '../../src/data/equipment/affixes'
import { buildings } from '../../src/data/building/buildings'
import { SKILLS } from '../../src/data/skill/Skills'
import { TECHNIQUES } from '../../src/data/technique/Techniques'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import type { PersistentTimedEffect } from '../../src/core/player/PersistentTimedEffect'
import type { StatModifier } from '../../src/core/stats/StatCalculator'

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
    skills: [{ id: 'linh_bao', name: 'Linh Bao', description: 'pick', type: 'active', level: 1, maxLevel: 10, cooldown: 1, target: 'enemy', effects: [] }],
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

function baseStat(key: 'strength' | 'maxHp', extra?: StatModifier) {
  const p = player()
  if (extra) p.modifiers.push(extra)
  return resolvePlayerStatAssembly(p, []).stats[key]
}

describe('F-A7-1: persisted modifiers claiming non-writer sources', () => {
  it('a realm-sourced modifier with an unknown sourceId is rejected and inert', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.modifiers.push({
      id: 'realm-passive:forged',
      sourceId: 'realm_source_that_does_not_exist',
      sourceType: 'realm',
      stat: 'strength',
      flat: 999,
    })

    expect(validateGameSaveShape(save).ok).toBe(false)
    expect(baseStat('strength', p.modifiers[0])).toBe(baseStat('strength'))
  })

  it('a talent-sourced modifier that is not the loi_kiep grant is rejected and inert', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.modifiers.push({
      id: 'talent:forged',
      sourceId: 'ngu_dao_the',
      sourceType: 'talent',
      stat: 'strength',
      flat: 999,
    })

    expect(validateGameSaveShape(save).ok).toBe(false)
    expect(baseStat('strength', p.modifiers[0])).toBe(baseStat('strength'))
  })

  it('a modifier of a sourceType no writer persists is rejected and inert', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.modifiers.push({
      id: 'buff:forged',
      sourceId: 'admin',
      sourceType: 'buff',
      stat: 'maxHp',
      flat: 9999,
    })

    expect(validateGameSaveShape(save).ok).toBe(false)
    expect(baseStat('maxHp', p.modifiers[0])).toBe(baseStat('maxHp'))
  })

  it('control: the loi_kiep talent grant still validates and emits', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.modifiers.push({
      id: 'talent_loi_kiep_strength',
      sourceId: 'loi_kiep',
      sourceType: 'talent',
      stat: 'strength',
      flat: 3,
    })

    expect(validateGameSaveShape(save).ok).toBe(true)
    expect(baseStat('strength', p.modifiers[0])).toBe(baseStat('strength') + 3)
  })

  it('control: a meridian-sourced entry still validates (emit stays gated)', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.modifiers.push({
      id: 'bat-mach:nham_mach:maxHp',
      sourceId: 'nham_mach',
      sourceType: 'realm',
      stat: 'maxHp',
      percent: 0.05,
    })

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('control: an equipment-sourced entry is tolerated (restore rebuilds the slice)', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.modifiers.push({
      id: 'equip:x',
      sourceId: 'item_x',
      sourceType: 'equipment',
      stat: 'might',
      flat: 1,
    })

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

function timedEffect(overrides: Partial<PersistentTimedEffect> = {}): PersistentTimedEffect {
  return {
    id: 'te1',
    sourceItemId: 'tu_linh_tran',
    effectGroup: 'tu_linh_tran',
    appliedAtMs: 1,
    expiresAtMs: Date.now() + 60_000,
    modifiers: [],
    cultivationSpeedPercent: 0.25,
    ...overrides,
  }
}

describe('F-A7-2: persistentTimedEffects claimed-source coherence', () => {
  it('a tu_linh_tran entry carrying modifiers is rejected at the boundary', () => {
    // The acceptance layer rejects the save before the record can ever
    // reach the live-modifier union - the emit seam itself stays open
    // (applyTimedEffect is an extension point for future writers).
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.persistentTimedEffects = [
      timedEffect({ modifiers: [{ id: 'x', sourceId: 'tu_linh_tran', sourceType: 'pill', stat: 'maxHp', flat: 9999 }] }),
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a tu_linh_tran entry above the authored percent bound mints nothing', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.persistentTimedEffects = [timedEffect({ cultivationSpeedPercent: 9 })]

    expect(validateGameSaveShape(save).ok).toBe(false)
    expect(getActiveCultivationSpeedPercent(p.persistentTimedEffects, Date.now())).toBe(0)
  })

  it('a fabricated sourceItemId is rejected at the boundary', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.persistentTimedEffects = [
      timedEffect({
        id: 'te2',
        sourceItemId: 'admin_panel',
        effectGroup: 'forged',
        modifiers: [{ id: 'x', sourceId: 'admin_panel', sourceType: 'buff', stat: 'maxHp', flat: 9999 }],
      }),
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a pill-sourced entry with cultivationSpeedPercent is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    const authored = pills.find((pill) => pill.effects.some((e) => e.type === 'regen'))!
    p.persistentTimedEffects = [
      timedEffect({ id: 'te3', sourceItemId: authored.id, effectGroup: 'pill_regen', cultivationSpeedPercent: 0.5 }),
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
    expect(getActiveCultivationSpeedPercent(p.persistentTimedEffects, Date.now())).toBe(0)
  })

  it('two entries sharing one effectGroup is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.persistentTimedEffects = [timedEffect(), timedEffect({ id: 'te4' })]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('control: a legit tu_linh_tran entry validates and contributes', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.persistentTimedEffects = [timedEffect()]

    expect(validateGameSaveShape(save).ok).toBe(true)
    expect(getActiveCultivationSpeedPercent(p.persistentTimedEffects, Date.now())).toBeCloseTo(0.25)
  })

  it('control: a legit pill regen entry validates and emits manaRegenPerTurn', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    const authored = pills.find((pill) => pill.effects.some((e) => e.type === 'regen'))!
    p.persistentTimedEffects = [
      timedEffect({
        id: 'te5',
        sourceItemId: authored.id,
        effectGroup: 'pill_regen',
        cultivationSpeedPercent: undefined,
        modifiers: [
          { id: 'm', sourceId: authored.id, sourceType: 'pill', stat: 'manaRegenPerTurn', flat: 2 },
        ],
      }),
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
    const manager = new GameManager()
    expect(manager.effectOps.getActiveTimedModifiers(p)).toHaveLength(1)
  })

  it('a forged entry still emits nothing extra through the bounded cultivation channel', () => {
    // The tu_linh_tran channel is single-writer and bound-enumerable -
    // the emit read itself refuses out-of-contract percents even for a
    // record that slipped past the boundary (defense in depth).
    const p = player()
    p.persistentTimedEffects = [
      timedEffect({ sourceItemId: 'admin_panel', cultivationSpeedPercent: 9 }),
    ]

    expect(getActiveCultivationSpeedPercent(p.persistentTimedEffects, Date.now())).toBe(0)
  })
})

describe('F-A7-3: alchemy job pillId coherence', () => {
  it('a job whose pillId disagrees with the recipe is rejected', () => {
    const recipe = alchemyRecipes.find((r) => r.pillId !== 'phi_van_dan_mortal')!
    const save = validSave()
    ;(save as Record<string, unknown>).alchemyJobs = [
      {
        jobId: 'j1',
        recipeId: recipe.id,
        pillId: 'phi_van_dan_mortal',
        herbMaterialId: recipe.herbVariants[0]!.materialId,
        startedAtMs: 1,
        completesAtMs: 2,
        roomLevelAtStart: 1,
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('control: a job matching its recipe validates', () => {
    const recipe = alchemyRecipes[0]!
    const save = validSave()
    ;(save as Record<string, unknown>).alchemyJobs = [
      {
        jobId: 'j1',
        recipeId: recipe.id,
        pillId: recipe.pillId,
        herbMaterialId: recipe.herbVariants[0]!.materialId,
        startedAtMs: 1,
        completesAtMs: 2,
        roomLevelAtStart: 1,
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

const BUILDING_TEMPLATE: Building = {
  id: 'gathering_outpost',
  name: 'Khai Vat Duong',
  category: 'crafting_station',
  tier: 1,
  maxLevel: 9,
  baseStorageCapacity: 100,
  upgradeCost: [[], [], [], []],
  levels: [],
  producesMaterialId: 'spirit_stone',
  baseProductionRate: 5.5 / 60 / 2.6,
}

function buildingHarness() {
  const system = new BuildingSystem()
  const registry = new BuildingRegistry()
  const manager = new BuildingManager()
  registry.register(BUILDING_TEMPLATE)
  return { system, registry, manager }
}

describe('F-A7-3 emit: settle delivers the authored recipe pill, never the forged claim', () => {
  it('a forged pillId job settles into recipe.pillId, not the claimed pill', () => {
    const manager = new GameManager()
    manager.catalogOps.registerMaterials(materials)
    manager.catalogOps.registerPills(pills)
    manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
    const recipe = alchemyRecipes.find(
      (r) => r.pillId !== 'phi_van_dan_mortal' && r.retired !== true,
    )!

    manager.alchemySystem.restoreJobs([
      {
        jobId: 'j-forged',
        recipeId: recipe.id,
        // Forged denormalized claim - a dormant pill a live recipe
        // could never mint.
        pillId: 'phi_van_dan_mortal',
        herbMaterialId: recipe.herbVariants[0]!.materialId,
        startedAtMs: 1,
        completesAtMs: 2,
        roomLevelAtStart: 9,
      },
    ])

    manager.alchemySystem.tick(
      Date.now(),
      manager.pillBag,
      (pillId) => pills.find((pill) => pill.id === pillId),
      () => 0,
    )

    expect(manager.pillBag.getAmount('phi_van_dan_mortal')).toBe(0)
    expect(manager.pillBag.getAmount(recipe.pillId)).toBeGreaterThan(0)
  })
})

describe('F-TC5-1: accrual realm pin boundary', () => {
  it('a pin above the player realm is rejected at the boundary and clamps at claim', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).buildings = [
      {
        instanceId: 'i1',
        buildingId: 'gathering_outpost',
        level: 9,
        lastCollectedAt: 0,
        accrualRealmId: 'tribulation',
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)

    // Emit side: even if the forged pin reaches the claim seam, it
    // cannot mint the dormant-tier material or the forged rate.
    const { system, registry, manager } = buildingHarness()
    const instance: BuildingInstance = {
      instanceId: 'i1',
      buildingId: 'gathering_outpost',
      level: 9,
      lastCollectedAt: 0,
      accrualRealmId: 'tribulation',
    }
    manager.add(instance)

    const result = system.claim('i1', registry, manager, 100, 'mortal')
    expect(result.materialId).not.toBe('spirit_stone_thuong_pham')
    expect(result.amount).toBeLessThan(100)
  })

  it('an unknown accrualRealmId is rejected at the boundary', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).buildings = [
      {
        instanceId: 'i1',
        buildingId: 'gathering_outpost',
        level: 1,
        lastCollectedAt: 0,
        accrualRealmId: 'khong_ton_tai',
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('control: a pin at the current realm validates', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).buildings = [
      {
        instanceId: 'i1',
        buildingId: 'gathering_outpost',
        level: 1,
        lastCollectedAt: 0,
        accrualRealmId: 'mortal',
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('control: a pin below the current realm (mid-breakthrough window) stays valid and mints the pin tier', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.realmId = 'qi_refining'
    p.cultivationPath = 'spell'
    p.cultivationWay = 'spell_pathway'
    p.mortalBasicSkillId = undefined
    ;(save as Record<string, unknown>).techniques = [
      {
        id: 'five_elements_art',
        name: 'Five Elements Art',
        description: 'payload',
        grade: 1,
        rank: 2,
        mastery: 100,
        quality: 'huyen',
        gradeHistory: { 1: { finalRank: 12, completionState: 'dai_thanh' } },
      },
    ]
    ;(save as Record<string, unknown>).buildings = [
      {
        instanceId: 'i1',
        buildingId: 'gathering_outpost',
        level: 9,
        lastCollectedAt: 0,
        accrualRealmId: 'mortal',
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('a production cycle collectionRealmId above the player realm is rejected', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).productionSites = [
      {
        siteId: 's1',
        level: 1,
        autoRestart: false,
        workerCycles: [
          {
            cycleId: 'c1',
            siteId: 's1',
            collectionRealmId: 'tribulation',
            siteLevelAtStart: 1,
            rewardTableVersion: 1,
            rollSeed: 1,
            startedAtMs: 1,
            completesAtMs: 2,
          },
        ],
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})
