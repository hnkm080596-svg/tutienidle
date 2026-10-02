// QA pin - writer-bound wave 4 (T21 stale-tip triage on b51a3524).
//
// The deterministic triage replayed every still-live claim class from the
// TC10/A12/B12 harvest against the validator. Each bound is an
// earnability-coherence check on monotonic inputs (realm markers,
// completedTiers, openedIds, authored durations) - never a writability
// gate. A forged claim that no writer on the save could produce is
// rejected at the boundary; an authored-shape control stays accepted.
//
// Bound surface pinned here:
//   F-REALM-1   realm witness - qi+ requires an owned technique + stamped
//               grade; fe+ requires the persisted foundation record.
//   F-A12-2     breakthroughGrade <= clamp(completedTiers,1,6) on qi+.
//   F-TAL-1     selectedTalentIds - pick ceiling, parked ids, great_dao
//               witness, <=1 creation talent.
//   F-TC10-ENT  entitlement pending while the pick ceiling is saturated.
//   F-MOD-1     realm-passive modifier must replay the authored envelope.
//   F-TRB-1     highestFoundationAchieved / committedOutcome grade rank
//               must be resolvable from persisted body records.
//   F-SKL-1     skills[] membership must be producible by a writer on
//               the save (starter | way kit | node grants | talent
//               passives | realm ladder).
//   F-CYC-1     workerCycle span replays the authored cycle window and
//               never started after the save was written.
//   F-A12-4     alchemy job span replays the authored recipe duration
//               and never started after the save was written.

import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../../src/core/player/Player'
import { GameManager } from '../../src/core/game/GameManager'
import { getRealmIndex } from '../../src/core/realm/realmSystem'
import type { ProductionCycleSave } from '../../src/services/save/saveTypes'
import { materials } from '../../src/data/materials/materials'
import { pills } from '../../src/data/pill/pills'
import { equipment } from '../../src/data/equipment/equipment'
import { affixes } from '../../src/data/equipment/affixes'
import { buildings } from '../../src/data/building/buildings'
import { SKILLS } from '../../src/data/skill/Skills'
import { TECHNIQUES } from '../../src/data/technique/Techniques'
import { alchemyRecipes } from '../../src/data/alchemy/alchemyRecipes'
import { alchemySecondsFor } from '../../src/core/alchemy/AlchemySystem'
import { witnessedAlchemyJob, witnessedCommitOutcomeFields } from './helpers/witnessFixtures'
import { CYCLE_BASE_SECONDS_BY_REALM, computeCycleSeconds } from '../../src/core/production/ProductionBalance'
import { QUESTS } from '../../src/data/quest/quests'
import { lockBetaFeaturesForTests } from '../../src/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../src/core/game/__fixtures__/betaTalentsUnlock'
import { usePlayerStore } from '../../src/stores/player'
import { restoreGameSession, type GameSave } from '../../src/services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from '../../src/services/save/saveAcceptance'
import type { StatModifier } from '../../src/core/stats/StatCalculator'
import type { Technique } from '../../src/core/technique/Technique'
import type { TribulationSaveSlice } from '../../src/services/save/saveTypes'

type RealmId = string

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

const catalogs = staticSaveAcceptanceCatalogs()

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerSkillTemplates([...SKILLS])
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  manager.catalogOps.registerQuests(QUESTS)
  return manager
}

function committedPlayer(realmId: RealmId): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  player.spellPath = { element: null }
  player.realmId = realmId
  player.realmLevel = 1
  delete player.mortalBasicSkillId
  if (getRealmIndex(realmId) >= getRealmIndex('qi_refining')) {
    player.breakthroughGrade = 1
  }
  if (getRealmIndex(realmId) >= getRealmIndex('foundation_establishment')) {
    player.highestFoundationAchieved = 'human'
  }
  return player
}

function wayTechnique(realmIndex: number): Technique {
  const entry = structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
  entry.grade = Math.max(1, Math.min(entry.grade, realmIndex))
  entry.gradeHistory = {}
  for (let g = 1; g < entry.grade; g += 1) {
    entry.gradeHistory[g] = { finalRank: 18, completionState: 'vien_man' }
  }
  if (entry.grade < realmIndex) {
    entry.gradeHistory[entry.grade] = { finalRank: 18, completionState: 'vien_man' }
  }
  return entry
}

function committedSave(
  realmId: RealmId,
  playerOverrides: Partial<PlayerData> = {},
  overrides: Partial<GameSave> = {},
): { save: GameSave; player: PlayerData } {
  const player = committedPlayer(realmId)
  Object.assign(player, playerOverrides)
  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: { ...player, lastSavedAt: Date.now() },
    techniques: [wayTechnique(getRealmIndex(realmId))],
    skills: [],
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
  return { save, player }
}

function classify(save: GameSave) {
  const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
  const acceptable =
    shape.ok === true &&
    shape.normalizedSave !== undefined &&
    isSaveAcceptable(shape.normalizedSave as GameSave, catalogs)
  return { shape, acceptable }
}

function boot(save: GameSave) {
  setActivePinia(createPinia())
  const playerStore = usePlayerStore()
  const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
  const manager = makeManager()
  const result = shape.ok
    ? restoreGameSession(playerStore, manager, shape.normalizedSave as GameSave)
    : { status: 'rejected' as const, message: 'shape' }
  return { playerStore, manager, result, shape }
}

const pillRoom = {
  instanceId: 'b-pill',
  buildingId: 'pill_room',
  level: 1,
  lastCollectedAt: 0,
}

describe('F-REALM-1: realm witness requires transition receipts', () => {
  it('a qi_refining save with no owned technique is rejected', () => {
    const { save } = committedSave('qi_refining', {}, { techniques: [] })
    const { shape, acceptable } = classify(save)
    expect(shape.ok).toBe(false)
    expect(acceptable).toBe(false)
    expect(boot(save).result.status).toBe('rejected')
  })

  it('a qi_refining save with breakthroughGrade < 1 is rejected', () => {
    const { save } = committedSave('qi_refining', { breakthroughGrade: 0 })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('a foundation_establishment save without the victory record is rejected', () => {
    const { save } = committedSave('foundation_establishment', {
      highestFoundationAchieved: undefined,
    })
    expect(classify(save).shape.ok).toBe(false)
    expect(boot(save).result.status).toBe('rejected')
  })

  it('control: the committed qi + fe saves validate', () => {
    expect(classify(committedSave('qi_refining').save).shape.ok).toBe(true)
    expect(classify(committedSave('foundation_establishment').save).shape.ok).toBe(true)
  })
})

describe('F-A12-2: breakthroughGrade derives from completedTiers on qi+', () => {
  it('grade above the derivable completedTiers bound is rejected', () => {
    const { save } = committedSave('qi_refining', { breakthroughGrade: 6 })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: the stamped grade 1 validates', () => {
    const { save } = committedSave('qi_refining', { breakthroughGrade: 1 })
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-TAL-1: selectedTalentIds pick coherence', () => {
  it('picks beyond the realm ceiling are rejected', () => {
    const { save } = committedSave('qi_refining', {
      selectedTalentIds: ['loi_kiep', 'ho_tich_bat_phat', 'ngo_dao'],
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('a parked talent held is rejected', () => {
    const { save } = committedSave('qi_refining', { selectedTalentIds: ['tran_tam'] })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('the great_dao reward talent without the hidden witness is rejected', () => {
    const { save } = committedSave('foundation_establishment', {
      selectedTalentIds: ['pham_nhan_chi_cot'],
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: a creation pick + a pool pick at realm validates', () => {
    const { save } = committedSave('foundation_establishment', {
      selectedTalentIds: ['loi_kiep', 'lk_dung_nap'],
    })
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-TC10-ENT: entitlement saturation', () => {
  it('a pending entitlement on a saturated pick list is rejected', () => {
    const { save } = committedSave('foundation_establishment', {
      selectedTalentIds: ['loi_kiep', 'ho_tich_bat_phat', 'lk_dung_nap'],
      pendingTalentEntitlement: {
        realmId: 'foundation_establishment',
        offeredTalentIds: ['tc_dia_can'],
      },
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: a pending entitlement with an open slot validates', () => {
    const { save } = committedSave('foundation_establishment', {
      selectedTalentIds: ['loi_kiep', 'lk_dung_nap'],
      pendingTalentEntitlement: {
        realmId: 'foundation_establishment',
        offeredTalentIds: ['tc_dia_can'],
      },
    })
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-MOD-1: realm-passive modifier must replay the authored envelope', () => {
  const authored = (percent: number): StatModifier => ({
    id: 'realm-passive:nhap_dao:maxHp',
    sourceId: 'nhap_dao',
    sourceType: 'realm',
    stat: 'maxHp',
    percent,
  })

  it('an inflated-percent claim is rejected', () => {
    const { save } = committedSave('qi_refining', {
      grantedRealmPassiveIds: ['qi_refining'],
      modifiers: [authored(0.09)],
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('a claim on a passive the marker never granted is rejected', () => {
    const { save } = committedSave('qi_refining', {
      grantedRealmPassiveIds: ['qi_refining'],
      modifiers: [
        {
          id: 'realm-passive:kien_co:maxHp',
          sourceId: 'kien_co',
          sourceType: 'realm',
          stat: 'maxHp',
          percent: 0.05,
        },
      ],
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: the authored grade-1 envelope validates', () => {
    const { save } = committedSave('qi_refining', {
      grantedRealmPassiveIds: ['qi_refining'],
      modifiers: [authored(0.03)],
    })
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-TRB-1: foundation grade rank must be resolvable', () => {
  it('highestFoundationAchieved above the resolvable rank is rejected', () => {
    const { save } = committedSave('foundation_establishment', {
      highestFoundationAchieved: 'heaven',
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('great_dao without the hidden breakthrough marker is rejected', () => {
    const { save } = committedSave('foundation_establishment', {
      highestFoundationAchieved: 'great_dao',
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('a committed outcome claiming earth with no body records is rejected', () => {
    const { save } = committedSave(
      'qi_refining',
      {},
      {
        tribulation: {
          committedOutcome: {
            attemptId: 1,
            outcome: 'victory',
            targetRealmId: 'foundation_establishment',
            grade: 'earth',
            breakthroughType: 'normal',
            ...witnessedCommitOutcomeFields({
              attemptId: 1,
              outcome: 'victory',
              targetRealmId: 'foundation_establishment',
              grade: 'earth',
              breakthroughType: 'normal',
              departingRealmId: 'qi_refining',
              chapterIndex: 2,
              chaptersTotal: 3,
              lightningStrikesTaken: 0,
              attemptSeed: 1,
            }),
            receipt: null,
            settlementError: false,
          },
          cooldownUntil: 0,
        } satisfies TribulationSaveSlice,
      },
    )
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: a committed outcome at the always-resolvable human grade validates', () => {
    const { save } = committedSave(
      'qi_refining',
      {},
      {
        tribulation: {
          committedOutcome: {
            attemptId: 1,
            outcome: 'victory',
            targetRealmId: 'foundation_establishment',
            grade: 'human',
            breakthroughType: 'normal',
            ...witnessedCommitOutcomeFields({
              attemptId: 1,
              outcome: 'victory',
              targetRealmId: 'foundation_establishment',
              grade: 'human',
              breakthroughType: 'normal',
              departingRealmId: 'qi_refining',
              chapterIndex: 2,
              chaptersTotal: 3,
              lightningStrikesTaken: 0,
              attemptSeed: 1,
            }),
            receipt: null,
            settlementError: false,
          },
          cooldownUntil: 0,
        } satisfies TribulationSaveSlice,
      },
    )
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-SKL-1: skills[] membership must be producible', () => {
  it('a skill no writer on the save can grant is rejected', () => {
    // van_phap_tuy_tam belongs to the dormant hidden kit - not the
    // mortal starter, not a beta way kit, no node grant, no realm
    // ladder id -> unproducible on this save.
    const hiddenSkill = structuredClone(SKILLS.find((s) => s.id === 'van_phap_tuy_tam')!)
    const { save } = committedSave('qi_refining', {}, { skills: [hiddenSkill] })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: the mortal starter skill validates', () => {
    // A mortal save mints the starter skill only through its own pick
    // marker - keep the authored pair together. A learned levelled
    // skill also carries its core node (existing coverage rule).
    const player = createDefaultPlayer()
    player.mortalBasicSkillId = 'linh_bao'
    player.nodeLevels = { core_linh_bao: 1 }
    player.purchasedNodeIds = ['core_linh_bao']
    const save: GameSave = {
      version: CURRENT_SAVE_VERSION,
      player: { ...player, lastSavedAt: Date.now() },
      techniques: [],
      skills: [structuredClone(SKILLS.find((s) => s.id === 'linh_bao')!)],
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
    }
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-CYC-1: workerCycle span replays the authored window', () => {
  const cycle = (completesAtMs: number) => ({
    cycleId: 'c1',
    siteId: 'thanh_van_lam',
    collectionRealmId: 'mortal',
    siteLevelAtStart: 1,
    rewardTableVersion: 1,
    rollSeed: 1,
    startedAtMs: completesAtMs - computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM.mortal ?? 0, 1) * 1000,
    completesAtMs,
  })
  const site = (workerCycles: ProductionCycleSave[]) => [
    { siteId: 'thanh_van_lam', level: 1, autoRestart: true, workerCycles },
  ]

  it('a span that does not replay the authored window is rejected', () => {
    const { save } = committedSave('qi_refining', {}, {
      productionSites: site([{ ...cycle(Date.now() + 60_000), completesAtMs: Date.now() + 99_999 }]),
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('a cycle started after the save was written is rejected', () => {
    const authoredSpan = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM.mortal ?? 0, 1) * 1000
    const { save } = committedSave('qi_refining', {}, {
      productionSites: site([
        { ...cycle(Date.now() + authoredSpan + 60_000) },
      ]),
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: an authored-span cycle validates', () => {
    const { save } = committedSave('qi_refining', {}, {
      productionSites: site([cycle(Date.now() + 60_000)]),
    })
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-A12-4: alchemy job span replays the authored recipe duration', () => {
  const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_truc_co_dan')!

  it('a span that does not replay the recipe duration is rejected', () => {
    const { save } = committedSave('qi_refining', {}, {
      buildings: [pillRoom],
      alchemyJobs: [
        witnessedAlchemyJob(
          {
            jobId: 'j1',
            recipeId: recipe.id,
            pillId: recipe.pillId,
            herbMaterialId: recipe.herbVariants[0]!.materialId,
            startedAtMs: 1,
            completesAtMs: 999,
            roomLevelAtStart: 1,
          },
          undefined,
          recipe,
        ),
      ],
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('a job started after the save was written is rejected', () => {
    const { save } = committedSave('qi_refining', {}, {
      buildings: [pillRoom],
      alchemyJobs: [
        witnessedAlchemyJob(
          {
            jobId: 'j1',
            recipeId: recipe.id,
            pillId: recipe.pillId,
            herbMaterialId: recipe.herbVariants[0]!.materialId,
            startedAtMs: Date.now() + 1_000,
            completesAtMs: Date.now() + 1_000 + alchemySecondsFor(recipe, 1) * 1000,
            roomLevelAtStart: 1,
          },
          undefined,
          recipe,
        ),
      ],
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: an authored-span job validates', () => {
    const { save } = committedSave('qi_refining', {}, {
      buildings: [pillRoom],
      alchemyJobs: [
        witnessedAlchemyJob(
          {
            jobId: 'j1',
            recipeId: recipe.id,
            pillId: recipe.pillId,
            herbMaterialId: recipe.herbVariants[0]!.materialId,
            startedAtMs: 1,
            completesAtMs: 1 + alchemySecondsFor(recipe, 1) * 1000,
            roomLevelAtStart: 1,
          },
          undefined,
          recipe,
        ),
      ],
    })
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-TC10-CPS: cultivationPerSecond TLT headroom requires a live record', () => {
  const liveTlt = (lastSavedAt: number) => ({
    id: 'tlt-1',
    sourceItemId: 'tu_linh_tran',
    effectGroup: 'tu_linh_tran',
    cultivationSpeedPercent: 0.25,
    durationStackable: false,
    modifiers: [],
    appliedAtMs: lastSavedAt - 1_000,
    expiresAtMs: lastSavedAt + 86_399_000,
  })

  it('cps above base x speed x ramp without any tu_linh_tran record rejects', () => {
    // The +25% TLT factor is only derivable while a live record exists;
    // a TLT-less save claiming the headroom mints extra offline accrual.
    const { save } = committedSave('qi_refining', { cultivationPerSecond: 12 })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('cps beyond the TLT headroom rejects even with a live record', () => {
    const { save } = committedSave('qi_refining', { cultivationPerSecond: 20 })
    save.player.persistentTimedEffects = [liveTlt(save.player.lastSavedAt)]
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: cps at base x speed x ramp x 1.25 with a live record validates', () => {
    const { save } = committedSave('qi_refining', { cultivationPerSecond: 12.5 })
    save.player.persistentTimedEffects = [liveTlt(save.player.lastSavedAt)]
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-TC10-OC: cultivationOvercharge is bounded by the lifetime tally', () => {
  it('an overcharge above totalCultivationGained rejects even with the bank talent', () => {
    // addCultivation splits already-gained cultivation into the bank -
    // a bank larger than the lifetime tally is a fabricated grant.
    const { save } = committedSave('qi_refining', {
      selectedTalentIds: ['hai_na'],
      talentLevels: { hai_na: 1 },
      cultivationOvercharge: 1_000_000,
      totalCultivationGained: 100,
    })
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: an overcharge within the lifetime tally validates', () => {
    const { save } = committedSave('qi_refining', {
      selectedTalentIds: ['hai_na'],
      talentLevels: { hai_na: 1 },
      cultivationOvercharge: 50,
      totalCultivationGained: 100,
    })
    expect(classify(save).shape.ok).toBe(true)
  })
})

describe('F-SCOPE-EQ-1: equipped grade must be producible at the claimed realm', () => {
  // equip() enforces canUseItemGrade (exact realm->grade match) and every
  // tribulation transition unequips all gear; the mortal->qi_refining
  // initiation is the single non-unequip transition, so qi_refining may
  // still carry equipped cuu_pham while later realms admit only their
  // own grade.
  function equipEntry(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      instanceId: 'eq-1',
      itemId: 'base_kiem',
      slot: 'weapon',
      equipped: true,
      grade: 'bat_pham',
      quality: 'hoang',
      mainStat: {
        id: 'eq-1:main',
        sourceId: 'eq-1',
        sourceType: 'equipment',
        stat: 'might',
        flat: 12,
      },
      affixes: [],
      forgeUsesTotal: 6,
      forgeUsesRemaining: 6,
      ...over,
    }
  }

  it('a bat_pham weapon equipped at foundation_establishment rejects', () => {
    const { save } = committedSave('foundation_establishment')
    save.equipment = [equipEntry()] as never
    expect(classify(save).shape.ok).toBe(false)
  })

  it('a that_pham weapon equipped at qi_refining rejects', () => {
    const { save } = committedSave('qi_refining')
    save.equipment = [equipEntry({ grade: 'that_pham' })] as never
    expect(classify(save).shape.ok).toBe(false)
  })

  it('control: a bat_pham weapon equipped at qi_refining validates', () => {
    const { save } = committedSave('qi_refining')
    save.equipment = [equipEntry()] as never
    expect(classify(save).shape.ok).toBe(true)
  })

  it('control: a cuu_pham weapon equipped at qi_refining validates (initiation carry)', () => {
    const { save } = committedSave('qi_refining')
    save.equipment = [equipEntry({ grade: 'cuu_pham' })] as never
    expect(classify(save).shape.ok).toBe(true)
  })

  it('control: an unequipped bat_pham record at foundation stays loadable', () => {
    const { save } = committedSave('foundation_establishment')
    save.equipment = [equipEntry({ equipped: false })] as never
    expect(classify(save).shape.ok).toBe(true)
  })
})
