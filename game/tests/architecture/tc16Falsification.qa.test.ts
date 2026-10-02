// TC16 blind falsification probes - asserts SECURE expectations only.
// Each test names the forged claim, why no authored writer can produce
// it, and the mint path it feeds. ASCII comments only.
// Verdict notes:
// - F-TC16-EQ-DUPSLOT: shape gate ADMITS two equipped items on one slot
//   (no writer bound there), but EquipmentBag.indexEquipped flips the
//   earlier entry equipped=false, so the double-mint never lands.
//   Documented inert admission - the hold below pins the secure end
//   state so a future indexEquipped regression surfaces.
// - F-TC16-TRIB-SKIPREALM: the shape gate validates grade/type shape
//   but does not pin targetRealmId adjacency - a skipped-realm victory
//   receipt is admitted and parked. The settle seam re-derives
//   isRealmTransitionEnabled + canTriggerBreakthrough, so the claim
//   stays inert. Hold pins that re-gate.

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
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
import { witnessedAlchemyJob, witnessedCommitOutcomeFields } from './helpers/witnessFixtures'
import { buildings } from '@/data/building/buildings'
import { QUESTS } from '@/data/quest/quests'
import { GameManager } from '@/core/game/GameManager'
import { makeInstance } from '@/core/equipment/EquipmentInstance.fixture'
import { createDefaultPlayer } from '@/core/player/Player'
import { usePlayerStore } from '@/stores/player'
import { withMortalCreationPick } from '@/services/save/GameSave.fixture'
import { restoreGameSession } from '@/services/save/SaveSystem'
import { validateGameSaveShape } from '@/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '@/services/save/SaveSystem'
import { TribulationOutcomeService } from '@/core/tribulation/TribulationOutcomeService'
import type { TribulationPlayerWriter } from '@/core/tribulation/TribulationOutcomeService'
import type { GameSave } from '@/services/save/saveTypes'

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

function restoreSave(save: GameSave) {
  const player = usePlayerStore()
  const manager = createRegisteredManager()
  const result = restoreGameSession(player, manager, save)
  return { player, manager, result }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(Date, 'now').mockReturnValue(1_725_160_000_000)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ------------------------------------------------------------------
// F-TC16-EQ-DUPSLOT: equip() unequips the current slot item first, so
// two equipped:true entries on one slot are unproducible. The shape
// gate currently admits the dup; the hold pins that restore mints
// modifiers for at most ONE of them.
// ------------------------------------------------------------------
describe('F-TC16-EQ-DUPSLOT: two equipped items on one slot', () => {
  function twoEquippedWeapons(save: GameSave): void {
    save.equipment = [
      structuredClone(
        makeInstance({
          instanceId: 'probe-weapon-a',
          itemId: 'base_kiem',
          equipped: true,
          mainStat: {
            id: 'probe-weapon-a-main',
            sourceId: 'probe-weapon-a',
            sourceType: 'equipment',
            stat: 'might',
            flat: 10,
          },
        }),
      ),
      structuredClone(
        makeInstance({
          instanceId: 'probe-weapon-b',
          itemId: 'base_kiem',
          equipped: true,
          mainStat: {
            id: 'probe-weapon-b-main',
            sourceId: 'probe-weapon-b',
            sourceType: 'equipment',
            stat: 'might',
            flat: 10,
          },
        }),
      ),
    ]
  }

  it('restore mints modifiers for at most one of the dup-slot entries', () => {
    const save = mortalSave()
    twoEquippedWeapons(save)

    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')

    const weaponAMods = manager.equipmentSystem
      .getModifiers()
      .filter((modifier) => modifier.sourceId === 'probe-weapon-a')
    const weaponBMods = manager.equipmentSystem
      .getModifiers()
      .filter((modifier) => modifier.sourceId === 'probe-weapon-b')

    expect(weaponAMods.length + weaponBMods.length).toBeLessThanOrEqual(1)
  })
})

// ------------------------------------------------------------------
// F-TC16-TRIB-SKIPREALM: committedOutcome is persisted intent. A forged
// victory receipt targeting a realm two rungs up (mortal -> golden_core
// skips qi_refining) cannot be writer-produced: start() requires
// adjacency + the breakthrough gate. The settle seam must re-derive
// both gates and keep the record inert.
// ------------------------------------------------------------------
describe('F-TC16-TRIB-SKIPREALM: forged skipped-realm victory receipt', () => {
  it('settle re-gates adjacency + breakthrough and keeps the claim inert', () => {
    const save = mortalSave()
    save.tribulation = {
      committedOutcome: {
        attemptId: 1,
        outcome: 'victory',
        targetRealmId: 'golden_core',
        grade: 'human',
        breakthroughType: 'normal',
        ...witnessedCommitOutcomeFields({
          attemptId: 1,
          outcome: 'victory',
          targetRealmId: 'golden_core',
          grade: 'human',
          breakthroughType: 'normal',
          departingRealmId: 'mortal',
          chapterIndex: 0,
          chaptersTotal: 1,
          lightningStrikesTaken: 0,
          attemptSeed: 1,
        }),
        receipt: null,
        settlementError: false,
      },
    }

    const { player, manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')

    const realmBefore = save.player.realmId
    const passivesBefore = save.player.grantedRealmPassiveIds?.length ?? 0

    const service = new TribulationOutcomeService()
    const settled = service.settleOutcome(
      player as unknown as TribulationPlayerWriter,
      manager,
      manager.tribulationDirector,
    )

    expect(settled).toBeNull()
    expect(save.player.realmId).toBe(realmBefore)
    expect(save.player.grantedRealmPassiveIds?.length ?? 0).toBe(passivesBefore)
  })
})

// ------------------------------------------------------------------
// F-TC16-ALCHEMY-RECIPE-MISMATCH: the job pillId is denormalized from
// the recipe at startJob. A forged job whose persisted pillId disagrees
// with the authored recipe (e.g. claiming a dormant-family pill under
// a live recipe) must fail the shape gate - no delivery window.
// ------------------------------------------------------------------
describe('F-TC16-ALCHEMY-RECIPE-MISMATCH: forged pillId on a live recipe', () => {
  it('the shape gate rejects a pillId that disagrees with the recipe', () => {
    const recipe = alchemyRecipes.find((candidate) => candidate.id === 'alchemy_tu_linh_dan_mortal')!
    const save = mortalSave()
    save.alchemyJobs = [
      witnessedAlchemyJob(
        {
          jobId: 'forged-job',
          recipeId: recipe.id,
          pillId: 'phi_van_dan_mortal',
          herbMaterialId: recipe.herbVariants[0]!.materialId,
          startedAtMs: save.player.lastSavedAt - 10_000,
          completesAtMs: save.player.lastSavedAt,
          roomLevelAtStart: 1,
        },
        undefined,
        recipe,
      ),
    ]

    const shape = validateGameSaveShape(save)
    expect(shape.ok).toBe(false)
  })
})
