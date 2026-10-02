/**
 * Blind adversarial audit - SCOPE AUTHORITY seam (pinned commit 77aecae0
 * on devin/qa-fixpoint). Persisted claims no authored writer can produce
 * must be refused at the acceptance layer; an accepted claim must not
 * mint a live effect. A FAILING test here is deterministic defect
 * evidence; passing demonstrations document the defended boundary.
 *
 * Probed:
 *   F-SCOPE-ENH-STREAK - equipmentSlots[].enhanceFailStreak is only
 *     non-negative checked, but the writer (EquipmentSystem.enhance) can
 *     only ever persist a streak in [0, ENHANCE_PITY_THRESHOLD]: the
 *     attempt that runs at streak >= threshold is a guaranteed success
 *     which resets the counter to 0, and failures only increment by 1.
 *     A persisted streak of THRESHOLD+1 is therefore an impossible
 *     claim. It is accepted today and mints one guaranteed enhance
 *     success at the next enhance() call (the same mint the reachable
 *     streak = THRESHOLD already grants -> severity Low).
 *   OBS-SCOPE-ALCH-REALM - alchemyJobs[] entries are bound by recipe/
 *     pill/herb/span/room/slot coherence, but NOT by recipe.realmId vs
 *     player.realmId: a coherent forged job on a higher-realm recipe is
 *     accepted. Settle delivers the authored pill, which stays inert at
 *     usePill ('wrong_realm') - informational, no live mint.
 */
import { describe, expect, it } from 'vitest'

import { lockBetaWaysForTests } from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '../../src/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaTalentsForTests } from '../../src/core/game/__fixtures__/betaTalentsUnlock'

lockBetaWaysForTests()
lockBetaFeaturesForTests()
lockBetaTalentsForTests()

import { createDefaultPlayer, type PlayerData } from '../../src/core/player/Player'
import { AlchemySystem, alchemySecondsFor } from '../../src/core/alchemy/AlchemySystem'
import { PillBag } from '../../src/core/pill/PillBag'
import { MaterialBag } from '../../src/core/material/MaterialBag'
import { EquipmentSystem } from '../../src/core/equipment/EquipmentSystem'
import { EquipmentBag } from '../../src/core/equipment/EquipmentBag'
import { EquipmentRegistry } from '../../src/core/equipment/EquipmentRegistry'
import { EquipmentSlotManager } from '../../src/core/equipment/EquipmentSlotManager'
import { AffixRegistry } from '../../src/core/equipment/AffixRegistry'
import { ENHANCE_PITY_THRESHOLD } from '../../src/core/equipment/EnhanceCurve'
import { alchemyRecipes } from '../../src/data/alchemy/alchemyRecipes'
import { materials } from '../../src/data/materials/materials'
import { pills } from '../../src/data/pill/pills'
import { equipment } from '../../src/data/equipment/equipment'
import { affixes } from '../../src/data/equipment/affixes'
import { SPIRIT_STONE_MATERIAL_ID } from '../../src/core/material/SpiritStoneMaterial'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import type { GameSave } from '../../src/services/save/saveTypes'
import { withCommittedSwordPath } from '../../src/services/save/GameSave.fixture'

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

function validSave(playerOverrides: Partial<PlayerData> = {}, overrides: Partial<GameSave> = {}) {
  const p = player(playerOverrides)
  p.mortalBasicSkillId = 'linh_bao'
  p.nodeLevels = { ...p.nodeLevels, core_linh_bao: 1 }
  p.purchasedNodeIds = [...p.purchasedNodeIds, 'core_linh_bao']

  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: { ...p, lastSavedAt: Date.now() },
    techniques: [],
    skills: [
      {
        id: 'linh_bao',
        name: 'Linh Bao',
        description: 'creation pick',
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
    quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    productionSites: [],
    alchemyJobs: [],
    decompose: {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    },
    ...overrides,
  }

  return { save, player: p }
}

describe('F-SCOPE-ENH-STREAK: persisted pity streak above the writer bound', () => {
  it('streak == ENHANCE_PITY_THRESHOLD is producible (boundary sanity)', () => {
    const { save } = validSave({}, {
      equipmentSlots: [
        { slot: 'weapon', enhanceLevel: 0, enhanceFailStreak: ENHANCE_PITY_THRESHOLD },
      ],
    })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true)
  })

  it('rejects enhanceFailStreak > ENHANCE_PITY_THRESHOLD (writer only persists <= threshold)', () => {
    const { save } = validSave({}, {
      equipmentSlots: [
        { slot: 'weapon', enhanceLevel: 0, enhanceFailStreak: ENHANCE_PITY_THRESHOLD + 1 },
      ],
    })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    // DEFECT: the impossible streak is accepted - the entry has no upper
    // bound check, only requireNonNegativeNumber.
    expect(shape.ok).toBe(false)
  })

  it('the accepted impossible streak mints a guaranteed enhance success', () => {
    const system = new EquipmentSystem()
    const inventory = new EquipmentBag()
    const registry = new EquipmentRegistry()
    registry.registerAll?.(equipment)
    const affixRegistry = new AffixRegistry()
    affixRegistry.registerAll?.(affixes)
    const materialBag = new MaterialBag()
    const slotManager = new EquipmentSlotManager()

    // Stock the bag generously so cost checks cannot mask the result:
    // every authored material id, far above any level-1 enhance cost.
    for (const entry of materials) {
      materialBag.add(entry, 100000)
    }

    // Persisted-as-loaded state: the forged streak lands verbatim.
    slotManager.restore([
      { slot: 'weapon', enhanceLevel: 0, enhanceFailStreak: ENHANCE_PITY_THRESHOLD + 1 },
    ])

    // Control: a producible streak (0) with the same always-fail roll
    // must NOT succeed - proves the win below comes from the forged
    // pity claim and nothing else.
    const control = system.enhance(
      'helmet',
      'qi_refining',
      inventory,
      registry,
      materialBag,
      slotManager,
      affixRegistry,
      () => 1,
    )
    expect(control.ok).toBe(false)
    expect(control.reason).toBe('enhance_failed')

    // Mint: random() => 1 can never roll success, yet the forged streak
    // forces pityGuaranteed -> enhanceLevel +1.
    const forged = system.enhance(
      'weapon',
      'qi_refining',
      inventory,
      registry,
      materialBag,
      slotManager,
      affixRegistry,
      () => 1,
    )
    expect(forged.ok).toBe(true)
    expect(slotManager.get('weapon').enhanceLevel).toBe(1)

    // The mint is single-shot: the success reset the streak to 0, and a
    // follow-up attempt fails on the same roll.
    const followup = system.enhance(
      'weapon',
      'qi_refining',
      inventory,
      registry,
      materialBag,
      slotManager,
      affixRegistry,
      () => 1,
    )
    expect(followup.ok).toBe(false)
  })
})

describe('OBS-SCOPE-ALCH-REALM: forged higher-realm recipe job (informational)', () => {
  it('accepts a coherent job on a recipe realm above the player, settle delivers a realm-inert pill', () => {
    const { save } = validSave()
    // Committed save -> realm qi_refining (index 1); the sword fixture
    // keeps technique/core coherence so the only gap exercised is the
    // alchemy-job realm bind.
    withCommittedSwordPath(save)
    // Every other bound on this save stays coherent so the ONLY gap
    // exercised is the alchemy-job realm bind: a post-initiation
    // breakthroughGrade above max(1, completedTiers) is a separate
    // forged claim the validator does catch, so pin it to the floor.
    save.player.breakthroughGrade = 1

    const recipe = alchemyRecipes.find((entry) => entry.id === 'alchemy_tu_linh_dan_foundation_establishment')!
    expect(recipe).toBeDefined()
    expect(recipe.realmId).toBe('foundation_establishment')

    save.buildings.push({
      instanceId: 'b1',
      buildingId: 'pill_room',
      level: 1,
      lastCollectedAt: 0,
      accrualRealmId: 'qi_refining',
    })

    const startedAtMs = 1000
    save.alchemyJobs = [
      {
        jobId: 'j1',
        recipeId: recipe.id,
        pillId: recipe.pillId,
        herbMaterialId: recipe.herbVariants[0]!.materialId,
        startedAtMs,
        completesAtMs: startedAtMs + alchemySecondsFor(recipe, 1) * 1000,
        roomLevelAtStart: 1,
      },
    ]

    // The forged job is shape-coherent on every bound the validator
    // owns (recipe/pill/herb/span/room/slot) - recipe.realmId vs
    // player.realmId is not among them.
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true)

    // Mint path: settle re-derives the deliverable from the recipe and
    // lands the foundation-tier pill into the bag.
    const alchemy = new AlchemySystem()
    alchemy.setRecipeLookup((id) => alchemyRecipes.find((entry) => entry.id === id))
    alchemy.restoreJobs(save.alchemyJobs!)
    const pillBag = new PillBag()
    alchemy.tick(
      startedAtMs + alchemySecondsFor(recipe, 1) * 1000 + 1,
      pillBag,
      (pillId) => pills.find((pill) => pill.id === pillId),
      () => 0,
    )
    expect(pillBag.getAmount('tu_linh_dan_foundation_establishment')).toBeGreaterThan(0)

    // ...and the minted record is realm-inert: the exact-realm gate at
    // usePill refuses it for this player ('wrong_realm'), so the gap
    // costs an acceptance slot but cannot reach live play.
    const pill = pills.find((entry) => entry.id === 'tu_linh_dan_foundation_establishment')!
    expect(pill.realmId).toBe('foundation_establishment')
    expect(pill.realmId !== save.player.realmId).toBe(true)
  })
})
