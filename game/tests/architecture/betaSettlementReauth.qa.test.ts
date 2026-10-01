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
import { materials } from '@/data/materials/materials'
import { pills } from '@/data/pill/pills'
import { equipment } from '@/data/equipment/equipment'
import { affixes } from '@/data/equipment/affixes'
import { buildings } from '@/data/building/buildings'
import { SKILLS } from '@/data/skill/Skills'
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
  return {
    jobId: 'carried-dormant',
    recipeId: 'alchemy_phi_van_dan_mortal',
    pillId: 'phi_van_dan_mortal',
    herbMaterialId: 'some_herb',
    startedAtMs: 1,
    completesAtMs: 2, // long past - settles at restore
    roomLevelAtStart: 1,
    ...overrides,
  }
}

function dormantOutcome(overrides: Record<string, unknown> = {}) {
  return {
    attemptId: 7,
    outcome: 'victory' as const,
    targetRealmId: 'golden_core',
    grade: 'human' as const,
    breakthroughType: 'normal' as const,
    receipt: null,
    settlementError: false,
    ...overrides,
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

    // The carry is flagged as out-of-scope state.
    expect(
      unsupportedReleaseReason(p, { tribulation: save.tribulation }),
    ).toBe('pending_tribulation_state')
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
    const hostile = { tribulation: { committedOutcome: { outcome: 'victory' } } }
    expect(() => unsupportedReleaseReason(p, hostile)).not.toThrow()
    expect(unsupportedReleaseReason(p, hostile)).toBe('pending_tribulation_state')
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

  it('a carried thong_mach_dan job (special recipe, no realm suffix) also parks', () => {
    const manager = makeManager()
    const p = player()
    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(
      baseSave(p, {
        alchemyJobs: [dormantJob({ recipeId: 'alchemy_thong_mach_dan', pillId: 'thong_mach_dan' })],
      }),
    )

    expect(manager.pillBag.getAmount('thong_mach_dan')).toBe(0)
    expect(manager.alchemySystem.getJobs()).toHaveLength(1)
    expect(manager.alchemySystem.drainSettlementEvents()).toEqual([])
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

describe('F-BODY-EMIT: carried body-progression records never emit modifiers under lock', () => {
  it('restore rehydration strips the owned bat-mach slice instead of re-emitting it', () => {
    const manager = makeManager()
    const p = committedPlayer({
      realmId: 'qi_refining',
      bodyProgression: {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: { openedIds: ['nham_mach', 'doi_mach', 'am_kieu_mach'] },
        zhou_tian: { completed: 0 },
      },
      physiqueGrade: 'bao',
      modifiers: [
        { id: 'bat-mach:doc_mach:strength', sourceId: 'doc_mach', sourceType: 'realm', stat: 'strength', percent: 5 },
      ],
    })
    manager.setActivePlayer(p)
    manager.saveOps.restoreFromSave(
      baseSave(p, { techniques: [wayTechniqueSlice('qi_refining')] }),
    )

    const bodyMods = p.modifiers.filter((m) => m.id.startsWith('bat-mach:'))
    expect(bodyMods).toEqual([])
  })
})

describe('F-BODY-GRADE: the Truc Co grade ignores carried body records under lock', () => {
  it('resolveKienCoGrade returns human on a carried max-body save', () => {
    const p = committedPlayer({
      bodyProgression: {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: { openedIds: ['nham_mach', 'doi_mach', 'am_kieu_mach'] },
        zhou_tian: { completed: 0 },
      },
      physiqueGrade: 'bao',
    })
    expect(resolveKienCoGrade(p, true)).toBe('human')
  })
})

describe('F-BODY-FLAG: unsupportedReleaseReason covers carried body progression', () => {
  it('flags opened meridians', () => {
    const p = committedPlayer({
      bodyProgression: {
        body_refinement: { completedTiers: 0, currentTierProgress: 0 },
        meridian: { openedIds: ['nham_mach'] },
        zhou_tian: { completed: 0 },
      },
    })
    expect(unsupportedReleaseReason(p)).toBe('body_progression_state')
  })

  it('flags a non-default physique grade even with zero-state chapters', () => {
    const p = committedPlayer({ physiqueGrade: 'phap' })
    expect(unsupportedReleaseReason(p)).toBe('body_progression_state')
  })

  it('never throws on hostile bodyProgression shapes', () => {
    for (const hostile of [null, 5, 'x', [], { meridian: { openedIds: 'nope' } }]) {
      const p = player()
      ;(p as { bodyProgression?: unknown }).bodyProgression = hostile
      expect(() => unsupportedReleaseReason(p), JSON.stringify(hostile)).not.toThrow()
    }
  })
})

describe('F-SINK: thong_mach_dan is no longer a beta-admitted sink', () => {
  it('the special recipe fails closed at origination', () => {
    expect(betaRecipeFamilyOfId('alchemy_thong_mach_dan')).toBeNull()
    expect(betaRecipeFamilyOfId('thong_mach_dan')).toBeNull()

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
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('scope_hidden')
  })
})
