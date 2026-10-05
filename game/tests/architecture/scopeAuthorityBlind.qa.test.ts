// Scope-authority blind audit probes (independent adversarial pass,
// pin 120cba78). Every test asserts the SECURE expectation: a persisted
// claim no authored writer could produce must be rejected by
// validateGameSaveShape / restore, and anything admitted must not mint
// a live effect. A FAILING test is the finding; passing mint-asserts
// inside it are the deterministic evidence.
// ASCII comments only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { affixes } from '@/data/equipment/affixes'
import { equipment } from '@/data/equipment/equipment'
import { materials } from '@/data/materials/materials'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { SKILLS } from '@/data/skill/Skills'
import { ALL_PROGRESSION_NODES } from '@/data/progression/ProgressionNodeCatalog'
import { ENEMIES } from '@/data/enemy/Enemies'
import { STAGES } from '@/data/stage/Stages'
import { zones } from '@/data/stage/Zones'
import { pills } from '@/data/pill/pills'
import { buffs } from '@/data/buff/buffs'
import { talismans } from '@/data/talisman/talismans'
import { formations } from '@/data/formation/formations'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { buildings } from '@/data/building/buildings'
import { QUESTS } from '@/data/quest/quests'
import { GameManager } from '@/core/game/GameManager'
import { createDefaultPlayer } from '@/core/player/Player'
import { usePlayerStore } from '@/stores/player'
import { withMortalCreationPick } from '@/services/save/GameSave.fixture'
import { restoreGameSession } from '@/services/save/SaveSystem'
import { validateGameSaveShape } from '@/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '@/services/save/SaveSystem'
import type { GameSave } from '@/services/save/saveTypes'
import {
  getSpiritStoneMaterialIdForEnhanceLevel,
} from '@/core/material/SpiritStoneMaterial'
import {
  CYCLE_BASE_SECONDS_BY_REALM,
  computeCycleSeconds,
} from '@/core/production/ProductionBalance'
import type { PlayerData } from '@/core/player/Player'

const T0 = 1_725_160_000_000
const FOREST = 'thanh_van_lam'

function createRegisteredManager(): GameManager {
  const manager = new GameManager()
  const catalog = manager.catalogOps
  catalog.registerMaterials(materials)
  catalog.registerSkillTemplates(SKILLS)
  catalog.registerTechniqueTemplates(TECHNIQUES)
  catalog.registerEnemyTemplates(ENEMIES)
  catalog.registerStages(STAGES)
  catalog.registerZones(zones)
  catalog.registerEquipment(equipment)
  catalog.registerAffixes(affixes)
  catalog.registerPills(pills)
  catalog.registerBuffs(buffs)
  catalog.registerTalismans(talismans)
  catalog.registerFormations(formations)
  catalog.registerAlchemyRecipes(alchemyRecipes)
  catalog.registerBuildings(buildings)
  catalog.registerProgressionNodes(ALL_PROGRESSION_NODES)
  catalog.registerQuests(QUESTS)
  return manager
}

function mortalSave(): GameSave {
  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
  return withMortalCreationPick(save)
}

// Coherent beyond-ceiling claim: every realm-coherence invariant the
// validator replays is satisfied, only the realm itself is impossible
// (isRealmTransitionEnabled closes foundation_establishment ->
// golden_core, so no writer can produce this realmId in beta).
function beyondCeilingSave(realmId: string): GameSave {
  const save = mortalSave()
  save.player = {
    ...createDefaultPlayer(),
    realmId,
    realmLevel: 1,
    cultivationPath: 'spell',
    cultivationWay: 'spell_pathway',
    // A real spell_pathway save carries its committed element -
    // null/out-of-beta commits reject at the boundary (F-SCOPE-1).
    spellPath: { element: 'fire' },
    breakthroughGrade: 1,
    mortalBasicSkillId: undefined,
    highestFoundationAchieved: 'human',
  }
  const technique = structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
  // Canonicality (v75): a lagging live grade at the forged realm index
  // must carry a sealed gradeHistory record - forge the minimal
  // canonical witness so ONLY the realm claim itself is impossible.
  technique.grade = 1
  technique.rank = 0
  technique.mastery = 0
  technique.gradeHistory = { '1': { finalRank: 18, completionState: 'vien_man' } } as never
  save.techniques = [technique]
  save.skills = []
  save.player.nodeLevels = {}
  save.player.purchasedNodeIds = []
  return save
}

function restoreSave(save: GameSave) {
  const player = usePlayerStore()
  const manager = createRegisteredManager()
  const result = restoreGameSession(player, manager, save)
  return { player, manager, result }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(Date, 'now').mockReturnValue(T0)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ------------------------------------------------------------------
// F-A: forged trung/thuong spirit-stone stacks. Every stone writer is
// realm-tier-keyed (production rollRewards, vendor quoteStoneGrant,
// reward receiver all route through
// getSpiritStoneMaterialIdForRealmTier(player realm tier)); beta realms
// are tiers 1-3 so only spirit_stone_ha_pham is earnable. The validator
// checks registry membership + amount >= 0 only, and the stack limit is
// MAX_SAFE_INTEGER, so a forged high-tier stack restores verbatim and
// pays an enhance cost tier no beta session could ever unlock.
// ------------------------------------------------------------------
describe('F-A: forged high-tier spirit stones mint impossible enhance costs', () => {
  it('rejects a trung_pham stack no beta writer can produce', () => {
    const save = mortalSave()
    save.materials = [{ materialId: 'spirit_stone_trung_pham', amount: 5000 } as never]
    // slot already at 30 - the first enhance attempt from here pays
    // trung_pham (getSpiritStoneMaterialIdForEnhanceLevel(30)).
    save.equipmentSlots = [{ slot: 'weapon', enhanceLevel: 30, enhanceFailStreak: 0 } as never]

    // mint evidence: the forged tier lands in the live bag and pays a
    // level-30 enhance - a cost tier unreachable in beta.
    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    const stack = manager.materialBag
      .getAll()
      .find((s) => s.material.id === 'spirit_stone_trung_pham')
    expect(stack?.amount).toBe(5000)
    expect(getSpiritStoneMaterialIdForEnhanceLevel(30)).toBe('spirit_stone_trung_pham')
    expect(manager.equipmentSlotManager.get('weapon')?.enhanceLevel).toBe(30)

    // stock the mundane material side of the cost (legal earnables) so
    // the ONLY impossible input is the trung_pham tier itself.
    for (const entry of manager.equipmentSystem.getEnhanceCost(
      'weapon',
      'mortal',
      manager.equipmentBag,
      manager.equipmentRegistry,
      manager.equipmentSlotManager,
    )) {
      manager.materialBag.add(manager.materialRegistry.get(entry.materialId), entry.amount)
    }
    const enhanceResult = manager.equipmentSystem.enhance(
      'weapon',
      'mortal',
      manager.equipmentBag,
      manager.equipmentRegistry,
      manager.materialBag,
      manager.equipmentSlotManager,
      manager.affixRegistry,
      () => 0,
    )
    // the impossible-cost spend committed (success or fail, the forged
    // tier was consumed):
    expect(enhanceResult.reason).not.toBe('missing_spirit_stone')
    expect(
      manager.materialBag.getAll().find((s) => s.material.id === 'spirit_stone_trung_pham')
        ?.amount ?? 0,
    ).toBeLessThan(5000)

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('rejects a thuong_pham stack (tier >= 7 writer, beta ceiling 3)', () => {
    const save = mortalSave()
    save.materials = [{ materialId: 'spirit_stone_thuong_pham', amount: 100 } as never]
    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

// ------------------------------------------------------------------
// F-B: forged equipmentSlots[].enhanceLevel. Reaching level 31 requires
// paying a trung_pham cost at enhanceLevel 30, and trung stones have no
// beta writer (F-A), so any persisted enhanceLevel >= 31 is impossible.
// The validator bounds only MAX_SLOT_ENHANCE_LEVEL (100). The level
// feeds calculateEquipmentScale = 1 + level * 0.06 directly on every
// equipped item in that slot.
// ------------------------------------------------------------------
describe('F-B: forged slot enhanceLevel mints equipment stat scale', () => {
  it('rejects enhanceLevel 60 on a mortal save', () => {
    const save = mortalSave()
    save.equipmentSlots = [{ slot: 'weapon', enhanceLevel: 60, enhanceFailStreak: 0 } as never]

    // mint evidence: restore admits the forged level verbatim.
    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    expect(manager.equipmentSlotManager.get('weapon')?.enhanceLevel).toBe(60)
    // 1 + 60*0.06 = 4.6x vs the max beta-producible 1 + 30*0.06 = 2.8x.
    expect(manager.equipmentSlotManager.get('weapon')!.enhanceLevel).toBeGreaterThan(30)

    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

// ------------------------------------------------------------------
// F-C: forged productionSites[].level / buildings[].level above the
// player's realm tier. upgradeSite refuses when
// currentRealmTier < targetLevel and BuildingSystem.upgrade refuses
// when getRealmTier(realmId) < level+1 ("Building level N corresponds
// to realm tier N") - at mortal (tier 1) only level 1 is writable, at
// the beta ceiling (tier 3) at most level 3. The validator bounds both
// only by authored maxLevel (9). The claim mints the level-9 cycle
// speed (4.6x) and the level-9 building rate/capacity.
// ------------------------------------------------------------------
describe('F-C: forged site/building levels mint impossible production', () => {
  it('rejects a level-9 production site on a mortal save', () => {
    const save = mortalSave()
    save.productionSites = [
      {
        siteId: FOREST,
        level: 9,
        autoRestart: true,
        activeWorkerSlots: 0,
        workerCycles: [],
      } as never,
    ]

    // mint evidence: the forged level survives restore and a spawned
    // lane stamps the level-9 cycle span (4.6x faster than level 1).
    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    expect(manager.productionSystem.getState(FOREST)?.level).toBe(9)

    manager.productionSystem.tickWorkers(T0, manager.materialBag, manager.materialRegistry, 'mortal', 4)
    const spawned = manager.productionSystem.getState(FOREST)?.workerCycles?.[0]
    expect(spawned).toBeDefined()
    const spanMs = (spawned!.completesAtMs as number) - (spawned!.startedAtMs as number)
    expect(spanMs).toBe(computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal']!, 9) * 1000)

    // writer control: upgradeSite at realm tier 1 can never emit 9.
    const control = new GameManager()
    control.productionSystem.ensureSiteState(FOREST)
    expect(control.productionSystem.upgradeSite(FOREST, control.materialBag, 1)).toBe(false)

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('rejects a level-9 gathering_outpost on a mortal save', () => {
    const save = mortalSave()
    save.buildings = [
      {
        instanceId: 'probe-building-1',
        buildingId: 'gathering_outpost',
        level: 9,
        lastCollectedAt: T0 - 3600_000,
        accrualRealmId: 'mortal',
      } as never,
    ]

    // mint evidence: the stored accrual at level 9 exceeds the level-1
    // value the upgrade writer could ever produce at mortal (capacity
    // also scales, so the bound is capacity of the forged level).
    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    const instance = manager.buildingManager.get('probe-building-1')
    expect(instance?.level).toBe(9)
    const template = manager.buildingRegistry.get('gathering_outpost')
    const stored9 = manager.buildingSystem.getStoredAmount(instance!, template, T0, 'mortal')
    const stored1 = manager.buildingSystem.getStoredAmount(
      { ...instance!, level: 1 },
      template,
      T0,
      'mortal',
    )
    expect(stored9).toBeGreaterThan(stored1)

    // writer control: upgrade() at mortal (tier 1) refuses level 2+.
    expect(
      manager.buildingSystem.upgrade(
        'probe-building-1',
        manager.buildingRegistry,
        manager.buildingManager,
        manager.materialBag,
        'mortal',
      ),
    ).toBe(false)

    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

// ------------------------------------------------------------------
// F-D: forged workerCycles[].siteLevelAtStart above the parent site's
// level. The span check only verifies completesAtMs-startedAtMs matches
// computeCycleSeconds(base, siteLevelAtStart), and siteLevelAtStart is
// bounded by siteMaxLevel - never by entry.level (level is monotonic,
// the stamp can never exceed the site's current level). A level-9 stamp
// on a level-1 mortal site admits a ~4.6x shorter reward window that
// settles on the next tick.
// ------------------------------------------------------------------
describe('F-D: forged workerCycle siteLevelAtStart mints a compressed settle', () => {
  it('rejects a level-9 cycle window on a level-1 site', () => {
    const save = mortalSave()
    const spanMs = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal']!, 9) * 1000
    save.productionSites = [
      {
        siteId: FOREST,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 0,
        workerCycles: [
          {
            cycleId: 'probe-cycle-1',
            siteId: FOREST,
            collectionRealmId: 'mortal',
            siteLevelAtStart: 9,
            rewardTableVersion: 1,
            rollSeed: 7,
            startedAtMs: T0 - 5000,
            completesAtMs: T0 - 5000 + spanMs,
          },
        ],
      } as never,
    ]

    // mint evidence: the impossible window restores and settles on tick
    // (in-flight lanes settle even with zero worker slots - INV-D-03).
    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    const restored = manager.productionSystem.getState(FOREST)
    expect(restored?.workerCycles?.[0]?.siteLevelAtStart).toBe(9)

    const before = manager.materialBag.getAll().reduce((sum, s) => sum + s.amount, 0)
    manager.productionSystem.tickWorkers(
      T0 - 5000 + spanMs + 1000,
      manager.materialBag,
      manager.materialRegistry,
      'mortal',
      0,
    )
    const after = manager.materialBag.getAll().reduce((sum, s) => sum + s.amount, 0)
    expect(after).toBeGreaterThan(before)
    expect(manager.productionSystem.getState(FOREST)?.workerCycles?.length ?? 0).toBe(0)

    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

// ------------------------------------------------------------------
// F-E / F-REALM-CEILING (fixed wave 3): forged realmId beyond the
// release ceiling. The transition gate is adjacent-only +
// isRealmAvailable(target) (foundation_establishment -> golden_core
// is closed), so no beta writer can produce the claim - and the save
// boundary now REJECTS it on player.realmId. This supersedes the old
// F-SCOPE-5 "flagged but playable" contract: loading the claim used
// to flag 'realm_beyond_release' while every realm-tier-keyed faucet
// (spirit stones, site/building caps, vendor floor) minted at the
// forged tier.
// ------------------------------------------------------------------
describe('F-E/F-REALM-CEILING: a beyond-ceiling realm claim is rejected at the save boundary', () => {
  it('a forged golden_core save rejects on player.realmId', () => {
    const save = beyondCeilingSave('golden_core')
    const shape = validateGameSaveShape(save)

    expect(shape.ok).toBe(false)
    expect(shape.issues.some((issue) => issue.path === 'player.realmId')).toBe(true)
  })

  it('every ladder realm past the release ceiling rejects the same way', () => {
    for (const realmId of [
      'nascent_soul',
      'soul_transformation',
      'void_refinement',
      'body_integration',
      'mahayana',
      'tribulation',
    ]) {
      expect(validateGameSaveShape(beyondCeilingSave(realmId)).ok).toBe(false)
    }
  })

  it('control: a coherent realm claim at the ceiling still validates', () => {
    expect(validateGameSaveShape(beyondCeilingSave('foundation_establishment')).ok).toBe(true)
  })
})

// ------------------------------------------------------------------
// HOLD probes: surfaces attacked that DID bound the forged claim.
// These must PASS - they pin the existing coherence evidence.
// ------------------------------------------------------------------
describe('HOLDS: forged claims that stay rejected or inert', () => {
  it('workerCycle collectionRealmId above player realm is rejected', () => {
    const save = mortalSave()
    const spanMs = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['qi_refining']!, 1) * 1000
    save.productionSites = [
      {
        siteId: FOREST,
        level: 1,
        autoRestart: false,
        activeWorkerSlots: 0,
        workerCycles: [
          {
            cycleId: 'probe-cycle-hold',
            siteId: FOREST,
            collectionRealmId: 'qi_refining',
            siteLevelAtStart: 1,
            rewardTableVersion: 1,
            rollSeed: 7,
            startedAtMs: T0 - 5000,
            completesAtMs: T0 - 5000 + spanMs,
          },
        ],
      } as never,
    ]
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('enhanceLevel above MAX_SLOT_ENHANCE_LEVEL is rejected', () => {
    const save = mortalSave()
    save.equipmentSlots = [{ slot: 'weapon', enhanceLevel: 101, enhanceFailStreak: 0 } as never]
    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a material stack of an unknown id is rejected at preflight', () => {
    const save = mortalSave()
    save.materials = [{ materialId: 'spirit_stone_forged_tier', amount: 1 } as never]
    const { result } = restoreSave(save)
    expect(result.status).toBe('rejected')
  })

  it('forged externalModifiers are wiped at restore', () => {
    const save = mortalSave()
    save.player.externalModifiers = [
      {
        id: 'forged-ext',
        sourceId: 'forged',
        sourceType: 'equipment',
        stat: 'might',
        flat: 9999,
      } as never,
    ]
    const { player, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    expect((player as unknown as PlayerData).externalModifiers).toEqual([])
  })
})
