/**
 * QA FIXPOINT probe (run qa-fixpoint-master) - settlement-authority
 * re-authentication pins. Clean-round B6 / Terminal-4 reviewers showed
 * that persisted intent was trusted verbatim at restore/settle: a
 * carried dormant record re-authorized live effects (realm transition,
 * pill delivery, body modifiers, breakthrough grade) without ever
 * re-deriving the scope verdict enforced at origination. These pins
 * assert the settle seams now fail closed, dormant records stay intact
 * but inert, and the unsupported-save flag covers the record classes.
 *
 * Beta flags are pinned by lockBetaFeaturesForTests() - the suite
 * asserts behavior under the canonical all-false table.
 */
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import { unsupportedReleaseReason } from '@/core/betaScopeSurface'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import { GameManager } from '@/core/game/GameManager'
import {
  TribulationOutcomeService,
  type TribulationPlayerWriter,
} from '@/core/tribulation/TribulationOutcomeService'
import { resolveKienCoGrade } from '@/data/breakthrough/BreakthroughGrades'
import { betaRecipeFamilyOfId } from '@/core/betaScope'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import type { ActiveAlchemyJob } from '@/core/alchemy/AlchemySystem'
import { getTribulationChapters } from '@/data/tribulation/TribulationChapters'
import { witnessedAlchemyJob, witnessedCommitOutcomeFields } from './helpers/witnessFixtures'
import { materials } from '@/data/materials/materials'
import { pills } from '@/data/pill/pills'
import { equipment } from '@/data/equipment/equipment'
import { affixes } from '@/data/equipment/affixes'
import { buildings } from '@/data/building/buildings'
import { SKILLS } from '@/data/skill/Skills'
import { PHAP_TU_SKILLS } from '@/data/skill/PhapTuSkills'
import { SPELL_KIT_IDS } from '@/data/skill/Skills'
import { TECHNIQUES } from '@/data/technique/Techniques'
import type { GameSave } from '@/services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '@/services/save/saveVersion'
import type { Skill } from '@/core/skill/Skill'
import type { Technique } from '@/core/technique/Technique'
import type { StatModifier } from '@/core/stats/StatCalculator'
import { getRealmIndex } from '@/core/realm/realmSystem'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

/** A legal beta-committed player (Phap Tu Ngu Hanh / spell_pathway). */
function committedPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  return player({
    cultivationPath: 'spell',
    cultivationWay: 'spell_pathway',
    mortalBasicSkillId: undefined,
    // F-SCOPE-1 (fixpoint W2-3): the element-axis commit is atomic -
    // beta element + its minted root + the learned basic's writer node.
    spellPath: { element: 'fire' },
    nodeLevels: { hoa_linh_ngo: 1, core_hoa_cau_thuat: 1 },
    purchasedNodeIds: ['hoa_linh_ngo', 'core_hoa_cau_thuat'],
    ...overrides,
  })
}

// The holder contract is way-owned: a committed save must carry its
// way's technique (spell_pathway -> five_elements_art) with a sealed
// grade record when the live grade lags the realm index.
function wayTechniqueSlice(realmId: string): Technique {
  const entry: Technique = {
    id: 'five_elements_art',
    name: 'Five Elements Art',
    description: 'payload entry',
    grade: 1,
    rank: 2,
    mastery: 100,
    quality: 'huyen',
    gradeHistory: {},
  }
  if (entry.grade < getRealmIndex(realmId)) {
    entry.gradeHistory = { 1: { finalRank: 12, completionState: 'dai_thanh' } }
  }
  return entry
}

const PRECURSOR_ENTRY: Skill = {
  id: 'linh_bao',
  name: 'Linh Bao',
  description: 'creation pick',
  type: 'active',
  level: 1,
  maxLevel: 10,
  cooldown: 1,
  target: 'enemy',
  effects: [],
}

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

function baseSave(p: PlayerData, overrides: Partial<GameSave> = {}): GameSave {
  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: { ...p, lastSavedAt: Date.now() },
    techniques: [],
    skills: p.cultivationWay === 'spell_pathway'
      ? [
          structuredClone(
            PHAP_TU_SKILLS.find((skill) => skill.id === SPELL_KIT_IDS.fire[0])!,
          ),
        ]
      : [],
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

  // Mortal saves must carry the creation pick learned + core-granted
  // (mirrors the boundary fixture contract).
  if (save.player.realmId === 'mortal' && save.player.cultivationPath === undefined) {
    if (save.player.mortalBasicSkillId === undefined) {
      save.player.mortalBasicSkillId = 'linh_bao'
    }
    if (overrides.skills === undefined) {
      save.skills = [{ ...structuredClone(PRECURSOR_ENTRY), id: save.player.mortalBasicSkillId }]
    }
    const coreId = `core_${save.player.mortalBasicSkillId}`
    if ((save.player.nodeLevels[coreId] ?? 0) < 1) {
      save.player.nodeLevels = { ...save.player.nodeLevels, [coreId]: 1 }
    }
    if (!save.player.purchasedNodeIds.includes(coreId)) {
      save.player.purchasedNodeIds = [...save.player.purchasedNodeIds, coreId]
    }
  }

  return save
}

function writerOf(p: PlayerData): TribulationPlayerWriter {
  const writer = p as TribulationPlayerWriter
  writer.setEquipmentModifiers = (modifiers: StatModifier[]) => {
    p.modifiers = modifiers
  }
  return writer
}

function dormantJob(overrides: Partial<ActiveAlchemyJob> = {}): ActiveAlchemyJob {
  // F-ALCH-JOB-FORGE: every carried job needs the reservation witness
  // startJob stamps - derive it from the (possibly overridden) recipe
  // so the fixture replays a producible record.
  const { reservation, ...jobOverrides } = overrides
  const job = {
    jobId: 'carried-dormant',
    recipeId: 'alchemy_phi_van_dan_mortal',
    pillId: 'phi_van_dan_mortal',
    herbMaterialId: 'some_herb',
    startedAtMs: 1,
    completesAtMs: 2, // long past - settles at restore
    roomLevelAtStart: 1,
    ...jobOverrides,
  }
  const recipe = alchemyRecipes.find((r) => r.id === job.recipeId)
  return witnessedAlchemyJob(job, reservation, recipe) as ActiveAlchemyJob
}

function dormantOutcome(overrides: {
  attemptId?: number
  outcome?: 'victory' | 'defeat'
  targetRealmId?: string
  grade?: 'human'
  breakthroughType?: 'normal' | 'hidden'
  departingRealmId?: string
} = {}) {
  // F-TRB-FORGE: the record must carry the provenance witness
  // commitOutcome stamps - derive the floor from the authored chapter
  // table of the (possibly overridden) target realm.
  const record = {
    attemptId: 7,
    outcome: 'victory' as 'victory' | 'defeat',
    targetRealmId: 'golden_core',
    grade: 'human' as const,
    breakthroughType: 'normal' as 'normal' | 'hidden',
    ...overrides,
  }
  const chaptersTotal = getTribulationChapters(record.targetRealmId)?.length ?? 1
  const chapterIndex = record.outcome === 'victory' ? chaptersTotal - 1 : 0
  const departingRealmId = overrides.departingRealmId ?? 'qi_refining'
  return {
    attemptId: record.attemptId,
    outcome: record.outcome,
    targetRealmId: record.targetRealmId,
    grade: record.grade,
    breakthroughType: record.breakthroughType,
    ...witnessedCommitOutcomeFields({
      ...record,
      departingRealmId,
      chapterIndex,
      chaptersTotal,
      lightningStrikesTaken: 0,
      attemptSeed: 7,
    }),
    receipt: null,
    settlementError: false,
  }
}

describe('F-CONS-B1: a carried tribulation committedOutcome must re-derive admission at settle', () => {
  it('a dormant-target victory parks forever - no realm entry, no receipt, record intact', () => {
    const manager = makeManager()
    // Gate-coherent entrant: the dormant-transition arm alone must keep
    // this parked (an un-gated fixture would park through the
    // breakthrough-gate arm instead and mask this check).
    const p = committedPlayer({
      realmId: 'qi_refining',
      realmLevel: 16,
      completedStageIds: ['qi_refining_abyssal_pool'],
    })
    const save = baseSave(p, {
      tribulation: { committedOutcome: dormantOutcome() },
      techniques: [wayTechniqueSlice('qi_refining')],
    })

    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(save)

    const committed = manager.tribulationDirector.getCommittedOutcome()
    expect(committed).not.toBeNull()
    expect(committed!.targetRealmId).toBe('golden_core')

    const service = new TribulationOutcomeService()
    expect(service.settleOutcome(writerOf(p), manager, manager.tribulationDirector)).toBeNull()

    // Nothing applied: realm/cultivation untouched, record still pending.
    expect(p.realmId).toBe('qi_refining')
    expect(manager.tribulationDirector.getCommittedOutcome()).not.toBeNull()
  })

  it('a hidden-type victory targeting an in-scope realm is still parked (dormant lineage)', () => {
    const manager = makeManager()
    const p = committedPlayer({
      realmId: 'qi_refining',
      realmLevel: 16,
      completedStageIds: ['qi_refining_abyssal_pool'],
    })
    const save = baseSave(p, {
      tribulation: {
        committedOutcome: dormantOutcome({
          targetRealmId: 'foundation_establishment',
          breakthroughType: 'hidden',
        }),
      },
      techniques: [wayTechniqueSlice('qi_refining')],
    })

    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(save)

    const service = new TribulationOutcomeService()
    expect(service.settleOutcome(writerOf(p), manager, manager.tribulationDirector)).toBeNull()
    expect(p.realmId).toBe('qi_refining')
    expect(manager.tribulationDirector.getCommittedOutcome()).not.toBeNull()
  })

  it('a dormant-target defeat levies no penalty table', () => {
    const manager = makeManager()
    // Gate-coherent entrant - same arm-isolation reason as the victory
    // fixture above.
    const p = committedPlayer({
      realmId: 'qi_refining',
      realmLevel: 16,
      cultivation: 500,
      completedStageIds: ['qi_refining_abyssal_pool'],
    })
    const save = baseSave(p, {
      tribulation: { committedOutcome: dormantOutcome({ outcome: 'defeat' }) },
      techniques: [wayTechniqueSlice('qi_refining')],
    })

    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(save)

    const service = new TribulationOutcomeService()
    expect(service.settleOutcome(writerOf(p), manager, manager.tribulationDirector)).toBeNull()
    expect(p.cultivation).toBe(500)
    expect(manager.tribulationDirector.getCommittedOutcome()).not.toBeNull()
  })

  it('control: an admissible committed outcome still settles (qi_refining -> foundation_establishment)', () => {
    const manager = makeManager()
    // The settle seam re-derives the ordinary breakthrough gate, so an
    // honest record carries the gate inputs the battle entry required
    // (level >= 12 and the qi_refining chapter-final clear).
    const p = committedPlayer({
      realmId: 'qi_refining',
      realmLevel: 16,
      completedStageIds: ['qi_refining_abyssal_pool'],
    })
    const save = baseSave(p, {
      tribulation: {
        committedOutcome: dormantOutcome({ targetRealmId: 'foundation_establishment' }),
      },
      techniques: [wayTechniqueSlice('qi_refining')],
    })

    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(save)

    const service = new TribulationOutcomeService()
    const result = service.settleOutcome(writerOf(p), manager, manager.tribulationDirector)
    expect(result?.kind).toBe('victory')
    expect(p.realmId).toBe('foundation_establishment')
    expect(manager.tribulationDirector.getCommittedOutcome()?.receipt).not.toBeNull()
  })

  it('a forged committed outcome with a malformed payload stays inert (no throw)', () => {
    const p = committedPlayer({ realmId: 'foundation_establishment' })
    const hostile = { alchemyJobs: [{ recipeId: 'alchemy_thong_mach_dan', pillId: 'x' }] }
    expect(() => unsupportedReleaseReason(p, hostile)).not.toThrow()
    expect(unsupportedReleaseReason(p, hostile)).toBeNull()
  })
})

describe('F-CONS-B2: a carried dormant-family alchemy job must not deliver', () => {
  it('restore-settle parks the job: no pill, no settlement event, record intact', () => {
    const manager = makeManager()
    const p = player()
    const save = baseSave(p, { alchemyJobs: [dormantJob()] })

    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(save)

    expect(manager.pillBag.getAmount('phi_van_dan_mortal')).toBe(0)
    expect(manager.alchemySystem.drainSettlementEvents()).toEqual([])
    expect(manager.alchemySystem.getJobs()).toHaveLength(1)
    expect(
      unsupportedReleaseReason(p, { alchemyJobs: save.alchemyJobs }),
    ).toBe('dormant_alchemy_job')
  })

  it('a carried thong_mach_dan job (live meridian recipe) settles and delivers', () => {
    // User scope ruling: luyen the / kinh mach / chu thien is a LIVE
    // beta chain - thong_mach_dan is beta-admitted again, so a carried
    // job of that recipe is not a dormant record at all.
    const manager = makeManager()
    const p = player()
    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(
      baseSave(p, {
        alchemyJobs: [
          dormantJob({
            recipeId: 'alchemy_thong_mach_dan',
            pillId: 'thong_mach_dan',
            herbMaterialId: 'tu_linh_thao_qi_refining_thuong_co',
          }),
        ],
      }),
    )

    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
    expect(manager.pillBag.getAmount('thong_mach_dan')).toBeGreaterThan(0)
  })

  it('an unknown recipeId fails honestly instead of parking forever', () => {
    const manager = makeManager()
    const p = player()
    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(
      baseSave(p, { alchemyJobs: [dormantJob({ recipeId: 'recipe_corrupt' })] }),
    )

    // Not a scope question: the recipe-miss arm consumes the job with a
    // failure event rather than parking it.
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
    const events = manager.alchemySystem.drainSettlementEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.success).toBe(false)
    expect(
      unsupportedReleaseReason(p, { alchemyJobs: [dormantJob({ recipeId: 'recipe_corrupt' })] }),
    ).toBeNull()
  })

  it('a parked dormant job never delivers on later ticks either', () => {
    const manager = makeManager()
    const p = player()
    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(baseSave(p, { alchemyJobs: [dormantJob()] }))

    manager.alchemySystem.tick(
      Date.now() + 86_400_000,
      manager.pillBag,
      (pillId) => pills.find((pill) => pill.id === pillId),
    )

    expect(manager.pillBag.getAmount('phi_van_dan_mortal')).toBe(0)
    expect(manager.alchemySystem.getJobs()).toHaveLength(1)
  })

  it('control: an enabled-family job still settles and delivers', () => {
    const manager = makeManager()
    const p = player()
    const recipe = alchemyRecipes.find((r) => betaRecipeFamilyOfId(r.id) === 'tu_linh_dan')!
    const herb = recipe.herbVariants.find((v) => v.age === 'myriad_year' || v.age === 'thuong_co')!
    const job = dormantJob({
      jobId: 'carried-live',
      recipeId: recipe.id,
      pillId: recipe.pillId,
      herbMaterialId: herb.materialId,
      roomLevelAtStart: 9,
    })
    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(baseSave(p, { alchemyJobs: [job] }))

    const settled = manager.alchemySystem.getJobs()
    expect(settled).toHaveLength(0)
    expect(manager.pillBag.getAmount(recipe.pillId)).toBeGreaterThan(0)
    expect(
      unsupportedReleaseReason(p, { alchemyJobs: [job] }),
    ).toBeNull()
  })
})

describe('live body chain (scope ruling): body-progression records emit and grade normally', () => {
  // REVERTED F-BODY-EMIT / F-BODY-GRADE / F-BODY-FLAG / F-SINK: Minh
  // ruled luyen the / kinh mach / chu thien a LIVE beta chain - only
  // the hidden breakthrough (dot pha an) stays gated. Carried body
  // records therefore emit their owned slice, count toward the Truc Co
  // grade, and do NOT flag the save as unsupported.
  it('restore rehydration emits the owned bat-mach slice (live chain)', () => {
    const manager = makeManager()
    const p = committedPlayer({
      realmId: 'qi_refining',
      // F-TC15 pacing: 3 opened meridians producible in-page at
      // realmLevel 6 (am_kieu_mach's authored requirement).
      realmLevel: 6,
      bodyProgression: {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: { progress: { nham_mach: 100, doi_mach: 100, am_kieu_mach: 100 } },
        zhou_tian: { completed: 0 },
      },
      physiqueGrade: 'bao',
    })
    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(
      baseSave(p, { techniques: [wayTechniqueSlice('qi_refining')] }),
    )

    const bodyMods = p.modifiers.filter((m) => m.id.startsWith('bat-mach:'))
    expect(bodyMods.length).toBeGreaterThan(0)
  })

  it('resolveKienCoGrade counts live body investment (earth on a max-tier save)', () => {
    const p = committedPlayer({
      // F-TC15 pacing: same 3-meridian producibility bound.
      realmLevel: 6,
      bodyProgression: {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: { progress: { nham_mach: 100, doi_mach: 100, am_kieu_mach: 100 } },
        zhou_tian: { completed: 0 },
      },
      physiqueGrade: 'bao',
    })
    // 6 tiers >= 3 + Truc Co Dan present => 'earth' (heaven still needs
    // 6 opened meridians - only 3 here).
    expect(resolveKienCoGrade(p, true)).toBe('earth')
  })

  it('carried body progression does NOT flag the save as unsupported', () => {
    const p = committedPlayer({
      bodyProgression: {
        body_refinement: { completedTiers: 0, currentTierProgress: 0 },
        meridian: { progress: { nham_mach: 100 } },
        zhou_tian: { completed: 0 },
      },
    })
    expect(unsupportedReleaseReason(p)).toBeNull()
    expect(unsupportedReleaseReason(committedPlayer({ physiqueGrade: 'phap' }))).toBeNull()
  })

  it('never throws on hostile bodyProgression shapes', () => {
    for (const hostile of [null, 5, 'x', [], { meridian: { openedIds: 'nope' } }]) {
      const p = player()
      ;(p as { bodyProgression?: unknown }).bodyProgression = hostile
      expect(() => unsupportedReleaseReason(p), JSON.stringify(hostile)).not.toThrow()
    }
  })

  it('thong_mach_dan is beta-admitted again (live meridian consumer)', () => {
    expect(betaRecipeFamilyOfId('alchemy_thong_mach_dan')).toBe('thong_mach_dan')
    expect(betaRecipeFamilyOfId('thong_mach_dan')).toBe('thong_mach_dan')

    const recipe = alchemyRecipes.find((r) => r.id === 'alchemy_thong_mach_dan')!
    const manager = makeManager()
    const result = manager.alchemySystem.startJob(
      recipe,
      recipe.herbVariants[0]!.materialId,
      manager.materialBag,
      manager.materialRegistry,
      999999,
      3,
      1,
      9,
    )
    // No scope_hidden refusal - the chain is live. Origination may still
    // fail for an authored reason (missing herb, room level), never for
    // scope.
    if (!result.ok) {
      expect(result.reason).not.toBe('scope_hidden')
    }
  })
})
