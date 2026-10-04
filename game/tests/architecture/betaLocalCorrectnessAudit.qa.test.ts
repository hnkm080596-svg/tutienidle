// QA probe - LOCAL CORRECTNESS / REGRESSION blind audit, pinned commit
// a7d12edf (branch devin/qa-fixpoint). Scope contract under attack:
//   beta scope = Pham Nhan -> spell initiation -> Luyen Khi -> Truc Co.
//   Dormant scope-hidden systems must stay inert, flagged saves must
//   still LOAD, and the luyen the chain (body_refinement -> meridian ->
//   zhou_tian) is LIVE.
//
// Evidence convention per AGENTS P4: a probe asserting SAFE behavior
// that FAILS is the deterministic defect evidence; a probe asserting
// contract behavior that passes pins the invariant.
//
// Findings with failing probes:
//   F-LC-1 (Medium) tribulation.cooldownUntil is unbounded at shape
//     validation AND TribulationDirector.restoreRuntime restores it
//     verbatim -> a crafted save wedges tribulation start() forever
//     (progression deadlock qi_refining -> foundation_establishment).
//     Probes: "unbounded tribulation.cooldownUntil must be rejected"
//     and "a restored cooldown beyond the authored bound must not
//     wedge start()".
//   F-LC-2 (Low) betaSupportedFor/unsupportedReleaseReason facade on
//     GameManagerProgressionOps and the domain betaSupportedFor(player)
//     cannot see saveSlices -> slice-owned dormant records
//     (dormant_alchemy_job / dormant_decompose_state) are unclassifiable
//     through those seams. Dead code today (zero consumers); the live
//     boot path uses the domain function WITH slices correctly.
//     Probe: "betaSupportedFor must agree with the slice-aware verdict".
import { describe, expect, it } from 'vitest'

import { GameManager } from '../../src/core/game/GameManager'
import {
  createDefaultPlayer,
  resolvePlayerStatAssembly,
  type PlayerData,
} from '../../src/core/player/Player'
import { lockBetaFeaturesForTests } from '../../src/core/game/__fixtures__/betaFeaturesUnlock'
import {
  commitSpellInitiationForTest,
  lockBetaWaysForTests,
} from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../src/core/game/__fixtures__/betaTalentsUnlock'
import {
  BETA_MORTAL_STARTER_SKILL_ID,
  isBetaElement,
  isBetaEnemyId,
  isBetaQuestEnabled,
  isBetaWay,
  scopeHiddenPillFamilyOfId,
} from '../../src/core/betaScope'
import {
  betaHiddenRealmRecordFor,
  betaNextRealmSurfaceFor,
  betaRealmLadderNodes,
  betaSupportedFor,
  isBetaBuildingSurface,
  isBetaLeftPanelMode,
  isBetaStandalonePanel,
  isBetaWheelSlot,
  unsupportedReleaseReason,
} from '../../src/core/betaScopeSurface'
import {
  isBeyondReleaseCeiling,
  isRealmAvailable,
  isRealmTransitionEnabled,
} from '../../src/core/realm/ReleasePolicy'
import { getBreakthroughRequirements } from '../../src/core/realm/BreakthroughGate'
import {
  recordHiddenBreakthrough,
  resolveBreakthroughType,
} from '../../src/core/realm/hidden/HiddenLineage'
import { mortalBoundaryContractViolation } from '../../src/core/skill/MortalPrecursors'
import {
  collectActiveWayStatModifiers,
  getActiveWay,
  getCultivationPathStatModifiers,
} from '../../src/core/player/CultivationPathSystem'
import { HiddenBeastSystem } from '../../src/core/game/HiddenBeastSystem'
import { betaEffectiveWorkerCapacity } from '../../src/core/production/WorkerCapacity'
import { getEffectiveMainStatCap } from '../../src/core/stats/StatCap'
import {
  investBodyChapterState,
  isBodyChapterUnlocked,
} from '../../src/core/realm/body/BodyProgressionSystem'
import { TribulationDirector, TRIBULATION_COOLDOWN_SECONDS } from '../../src/core/tribulation/TribulationDirector'
import type { TribulationRuntimeSave } from '../../src/core/tribulation/TribulationDirector'
import { TribulationOutcomeService } from '../../src/core/tribulation/TribulationOutcomeService'
import type { TribulationPlayerWriter } from '../../src/core/tribulation/TribulationOutcomeService'
import { EventBus } from '../../src/core/events/EventBus'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from '../../src/services/save/saveAcceptance'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { computeRestoreIdentity } from '../../src/services/save/saveTypes'
import { buildGameSave } from '../../src/services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import type { GameSave } from '../../src/services/save/saveTypes'
import { alchemyRecipes } from '../../src/data/alchemy/alchemyRecipes'
import { materials } from '../../src/data/materials/materials'
import { pills } from '../../src/data/pill/pills'
import { equipment } from '../../src/data/equipment/equipment'
import { affixes } from '../../src/data/equipment/affixes'
import { buildings } from '../../src/data/building/buildings'
import { SKILLS } from '../../src/data/skill/Skills'
import { TECHNIQUES } from '../../src/data/technique/Techniques'
import { alchemySecondsFor } from '../../src/core/alchemy/AlchemySystem'
import { witnessedAlchemyJob, witnessedCommitOutcomeFields } from './helpers/witnessFixtures'
import { calculateOfflineTime } from '../../src/core/idle/GameClock'
import {
  getActiveCultivationSpeedPercent,
  splitCultivationSpeedWindow,
} from '../../src/core/economy/TuLinhTranBalance'
import { calculateOfflineProgress } from '../../src/core/idle/OfflineProgressSystem'
import {
  CORE_REALM_LEVEL,
  QI_REFINING_BREAKTHROUGH_STAGE_ID,
} from '../../src/core/realm/realmSystem'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function mortalPlayer(): PlayerData {
  const p = createDefaultPlayer()
  p.mortalBasicSkillId = BETA_MORTAL_STARTER_SKILL_ID
  return p
}

// Minimal canonical mortal save: the authored pick learned + its core
// coverage purchased (mortal-boundary + skill-core contracts).
function mortalSave(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const p = mortalPlayer()
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
    ...overrides,
  }
}

// A REAL committed qi_refining save produced by the live atomic op -
// canonical in every field so probe mutations stay inside the contract.
function committedContext(): { gameManager: GameManager; player: PlayerData } {
  const gameManager = new GameManager()
  const player = mortalPlayer()
  player.nodeLevels = { ...player.nodeLevels, core_linh_bao: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_linh_bao']
  player.realmLevel = CORE_REALM_LEVEL // initiation requires level 12 mortal
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerPills(pills)
  gameManager.catalogOps.registerEquipment(equipment)
  gameManager.catalogOps.registerAffixes(affixes)
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.catalogOps.registerSkillTemplates([...SKILLS])
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  gameManager.setActivePlayer(player)
  // the authored mortal pick must be learned before the commit can
  // strip it - skills live on skillManager, not PlayerData.
  gameManager.progressionOps.learnSkill('linh_bao', player)
  commitSpellInitiationForTest(gameManager, player, 'fire')
  return { gameManager, player }
}

function committedSave(): { save: GameSave; gameManager: GameManager; player: PlayerData } {
  const { gameManager, player } = committedContext()
  return { save: buildGameSave(player, gameManager), gameManager, player }
}

// Tribulation-player writer: PlayerData + the store seam the outcome
// service writes through.
function writerOf(player: PlayerData): TribulationPlayerWriter & { mods: unknown[] } {
  const mods: unknown[] = []
  const writer = player as TribulationPlayerWriter & { mods: unknown[] }
  writer.setEquipmentModifiers = (m) => {
    mods.push(m)
  }
  writer.mods = mods
  return writer
}

function parkedHiddenOutcome(): NonNullable<TribulationRuntimeSave['committedOutcome']> {
  // F-TRB-FORGE: carries the provenance witness a real commit leaves
  // behind - spreads that retarget the record keep the original
  // witness, which is exactly what the digest arm rejects.
  return {
    attemptId: 1,
    outcome: 'victory',
    targetRealmId: 'foundation_establishment',
    grade: 'human',
    breakthroughType: 'hidden',
    ...witnessedCommitOutcomeFields({
      attemptId: 1,
      outcome: 'victory',
      targetRealmId: 'foundation_establishment',
      grade: 'human',
      breakthroughType: 'hidden',
      departingRealmId: 'qi_refining',
      chapterIndex: 2,
      chaptersTotal: 3,
      lightningStrikesTaken: 0,
      attemptSeed: 1,
    }),
    receipt: null,
    settlementError: false,
  }
}

// ---------------------------------------------------------------------------
// Section A - flagged saves LOAD (shape + acceptance) and still flag
// ---------------------------------------------------------------------------

describe('beta scope - flagged saves load', () => {
  it('a canonical committed qi_refining save passes shape + acceptance + carries no flag', () => {
    const { save } = committedSave()
    expect(validateGameSaveShape(save).ok).toBe(true)
    expect(isSaveAcceptable(save as GameSave, staticSaveAcceptanceCatalogs())).toBe(true)
    expect(
      unsupportedReleaseReason(save.player as PlayerData, {
        alchemyJobs: save.alchemyJobs,
        decompose: save.decompose,
      }),
    ).toBeNull()
  })

  it('a carried dormant alchemy job loads and flags dormant_alchemy_job', () => {
    const { save } = committedSave()
    const recipe = alchemyRecipes.find(
      (r) => scopeHiddenPillFamilyOfId(r.id) !== null && r.herbVariants.length > 0,
    )
    expect(recipe, 'fixture: a dormant-family recipe must exist').toBeDefined()

    const T0 = 1_700_000_000_000
    const job = witnessedAlchemyJob(
      {
        jobId: 'j1',
        recipeId: recipe!.id,
        pillId: recipe!.pillId,
        herbMaterialId: recipe!.herbVariants[0]!.materialId,
        startedAtMs: T0,
        completesAtMs: T0 + alchemySecondsFor(recipe!, 1) * 1000,
        roomLevelAtStart: 1,
      },
      undefined,
      recipe,
    )

    const patched = {
      ...save,
      buildings: [
        { instanceId: 'b1', buildingId: 'pill_room', level: 1, lastCollectedAt: T0 },
      ],
      alchemyJobs: [job],
      player: { ...(save.player as PlayerData), lastSavedAt: T0 + 60_000 },
    }

    // Dormancy contract: the flagged record is still a VALID save.
    expect(validateGameSaveShape(patched).ok).toBe(true)
    expect(isSaveAcceptable(patched as unknown as GameSave, staticSaveAcceptanceCatalogs())).toBe(true)
    expect(
      unsupportedReleaseReason(patched.player as PlayerData, { alchemyJobs: patched.alchemyJobs }),
    ).toBe('dormant_alchemy_job')
  })

  it('a live decompose slice loads and flags dormant_decompose_state (both channels)', () => {
    const base = mortalSave({
      decompose: {
        settings: { workers: 1, gradeFilter: 'all', ageFilter: 'all' },
        nextCycleAt: 0,
        started: false,
      },
    })
    expect(validateGameSaveShape(base).ok).toBe(true)
    expect(
      unsupportedReleaseReason(base.player as PlayerData, { decompose: base.decompose as never }),
    ).toBe('dormant_decompose_state')

    const started = mortalSave({
      decompose: {
        settings: { workers: 0, gradeFilter: 'all', ageFilter: 'all' },
        nextCycleAt: 1,
        started: true,
      },
    })
    expect(validateGameSaveShape(started).ok).toBe(true)
    expect(
      unsupportedReleaseReason(started.player as PlayerData, {
        decompose: started.decompose as never,
      }),
    ).toBe('dormant_decompose_state')

    // inert decompose record (stopped, zero workers) is not a reason
    const inert = mortalSave({
      decompose: {
        settings: { workers: 0, gradeFilter: 'all', ageFilter: 'all' },
        nextCycleAt: 0,
        started: false,
      },
    })
    expect(validateGameSaveShape(inert).ok).toBe(true)
    expect(
      unsupportedReleaseReason(inert.player as PlayerData, { decompose: inert.decompose as never }),
    ).toBeNull()
  })

  it('hidden-progression records flag hidden_progression_state', () => {
    const p = mortalPlayer()
    p.hiddenPerfection.hiddenBreakthroughRealmIds = ['mortal']
    expect(unsupportedReleaseReason(p)).toBe('hidden_progression_state')

    const p2 = mortalPlayer()
    p2.hiddenBeastKills = { abyss_beast: 3 }
    expect(unsupportedReleaseReason(p2)).toBe('hidden_progression_state')

    const p3 = mortalPlayer()
    p3.hiddenPerfection.realms = {
      mortal: { discovered: true, bodyCompleted: false, frozen: false },
    }
    expect(unsupportedReleaseReason(p3)).toBe('hidden_progression_state')
  })

  it('dormant companion / artifact / formation / talent records flag in order', () => {
    const p = mortalPlayer()
    p.companions = [{ id: 'c1' }] as unknown as PlayerData['companions']
    expect(unsupportedReleaseReason(p)).toBe('companion_owned')

    const p2 = mortalPlayer()
    p2.artifact = { id: 'a1' } as unknown as PlayerData['artifact']
    expect(unsupportedReleaseReason(p2)).toBe('artifact_owned')

    const p3 = mortalPlayer()
    p3.formationLoadout = { slots: [] } as unknown as PlayerData['formationLoadout']
    expect(unsupportedReleaseReason(p3)).toBe('formation_loadout')

    // pham_nhan_chi_cot stays dormant (Great Dao reward - minted only
    // by the hidden conversion), while pham_cot is a legitimate beta
    // creation talent again and must NOT flag.
    const p4 = mortalPlayer()
    p4.selectedTalentIds = ['pham_nhan_chi_cot']
    expect(unsupportedReleaseReason(p4)).toBe('dormant_talent_state')

    const p5 = mortalPlayer()
    p5.selectedTalentIds = ['pham_cot']
    expect(unsupportedReleaseReason(p5)).toBeNull()
  })

  it('reason ordering is deterministic - realm_beyond_release wins over way', () => {
    const { player } = committedContext()
    player.realmId = 'golden_core'
    expect(unsupportedReleaseReason(player)).toBe('realm_beyond_release')
  })

  it('malformed dormant slices never throw and never fabricate a reason', () => {
    const p = mortalPlayer()
    expect(() =>
      unsupportedReleaseReason(p, {
        alchemyJobs: 'not-an-array',
        decompose: { settings: { workers: 'two' }, started: 'yes' },
      }),
    ).not.toThrow()
    expect(
      unsupportedReleaseReason(p, {
        alchemyJobs: [{ recipeId: 42 }, null],
        decompose: { settings: {}, started: false },
      }),
    ).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Section B - dormancy gates: hidden systems are inert, luyen the is LIVE
// ---------------------------------------------------------------------------

describe('beta scope - dormancy gates', () => {
  it('hidden breakthrough is unforgeable under beta and writes nothing', () => {
    const { player } = committedContext()
    expect(resolveBreakthroughType(player)).toBe('normal')

    const before = structuredClone(player.hiddenPerfection)
    recordHiddenBreakthrough(player, 'foundation_establishment')
    expect(player.hiddenPerfection).toEqual(before)
    expect(player.hiddenPerfection.hiddenBreakthroughRealmIds).toHaveLength(0)
  })

  it('hidden beast counters never mutate under beta', () => {
    const sys = new HiddenBeastSystem({ getEnemyTemplate: () => undefined })
    const p = mortalPlayer()
    const before = structuredClone(p.hiddenBeastKills)
    expect(sys.onEnemyDefeated(p, 'hidden_abyss_beast', 'mortal')).toEqual([])
    expect(p.hiddenBeastKills).toEqual(before)
  })

  it('dormant way stat seams return no modifiers', () => {
    const p = mortalPlayer()
    p.cultivationPath = 'sword'
    p.cultivationWay = 'sword_pathway'
    expect(collectActiveWayStatModifiers(p, resolvePlayerStatAssembly(p, []).stats)).toEqual([])
    expect(getCultivationPathStatModifiers(p)).toEqual([])
    expect(getActiveWay(p)).toBe('sword_pathway') // way is READ but inert
    expect(isBetaWay('sword_pathway')).toBe(false)
    expect(unsupportedReleaseReason(p)).toBe('way_out_of_scope')
  })

  it('luyen the chain is LIVE: body_refinement invests at mortal', () => {
    const p = mortalPlayer()
    p.realmLevel = CORE_REALM_LEVEL // tier 0 needs realmLevel >= 2
    expect(isBodyChapterUnlocked(p, 'body_refinement')).toBe(true)
    const consumed = investBodyChapterState(p, 'body_refinement', 5)
    expect(consumed).toBeGreaterThan(0)
    const state = p.bodyProgression.body_refinement
    expect(state.completedTiers + state.currentTierProgress).toBeGreaterThan(0)
    // meridian stays locked until the prior chapter completes - the
    // sequential gate is a progression gate, not a scope gate.
    expect(isBodyChapterUnlocked(p, 'meridian')).toBe(false)
  })

  it('hidden body records do not widen the live stat cap', () => {
    const p = mortalPlayer()
    const pristine = getEffectiveMainStatCap(p)
    p.hiddenPerfection.completedHiddenBodyRealmIds = ['mortal', 'qi_refining']
    expect(getEffectiveMainStatCap(p)).toBe(pristine)
  })

  it('worker capacity is pinned to the beta baseline while manualWorkforce is hidden', () => {
    const p = mortalPlayer()
    p.autoWorkerCapacity = 9
    expect(betaEffectiveWorkerCapacity(p.autoWorkerCapacity)).toBe(3)
    expect(unsupportedReleaseReason(p)).toBe('manual_workforce_state')
  })

  it('quest surface: daily off, off-roster kill off, roster kill on', () => {
    expect(
      isBetaQuestEnabled({ cadence: 'daily', condition: { kind: 'collect' } } as never),
    ).toBe(false)
    expect(
      isBetaQuestEnabled({
        cadence: 'one_time',
        condition: { kind: 'kill', enemyId: 'not_in_roster' },
      } as never),
    ).toBe(false)
    // Any authored roster enemy id must be admissible.
    const rosterEnemy = 'act1_slime_a'
    if (isBetaEnemyId(rosterEnemy)) {
      expect(
        isBetaQuestEnabled({
          cadence: 'one_time',
          condition: { kind: 'kill', enemyId: rosterEnemy },
        } as never),
      ).toBe(true)
    }
  })

  it('surface maps fail closed on unknown ids', () => {
    expect(isBetaWheelSlot('totally_unknown_slot')).toBe(false)
    expect(isBetaBuildingSurface('totally_unknown_building')).toBe(false)
    expect(isBetaStandalonePanel('totally_unknown_panel')).toBe(false)
    expect(isBetaLeftPanelMode('totally_unknown_mode')).toBe(false)
    expect(betaHiddenRealmRecordFor(mortalPlayer(), 'mortal')).toBeUndefined()
    expect(betaRealmLadderNodes().length).toBeGreaterThan(0)
    // ceiling-adjacent: at the last available realm the next-realm
    // surface reports null rather than leaking a hidden realm card.
    const { player } = committedContext()
    player.realmId = 'foundation_establishment'
    const surface = betaNextRealmSurfaceFor(player)
    expect(
      surface === null || isRealmAvailable(surface.nextRealmId),
    ).toBe(true)
  })

  it('realm transition gate: adjacent + inside-release only', () => {
    expect(isRealmTransitionEnabled('mortal', 'qi_refining')).toBe(true)
    expect(isRealmTransitionEnabled('qi_refining', 'foundation_establishment')).toBe(true)
    expect(isRealmTransitionEnabled('mortal', 'foundation_establishment')).toBe(false) // skip
    expect(isRealmTransitionEnabled('foundation_establishment', 'golden_core')).toBe(false) // beyond
    expect(isRealmAvailable('golden_core')).toBe(false)
    expect(isBeyondReleaseCeiling('golden_core')).toBe(true)
  })

  it('breakthrough requirements hide behind a closed transition', () => {
    const p = mortalPlayer()
    p.realmId = 'foundation_establishment'
    p.realmLevel = 12
    expect(getBreakthroughRequirements(p)).toEqual([])
  })

  it('mortal boundary contract: contradictory path/pick combinations reject', () => {
    const p = mortalPlayer()
    p.cultivationPath = 'spell' // mortal carrying a path
    expect(
      mortalBoundaryContractViolation({ player: p, skills: [] }),
    ).not.toBeNull()

    const p2 = mortalPlayer()
    p2.mortalBasicSkillId = 'some_other_pick'
    expect(
      mortalBoundaryContractViolation({ player: p2, skills: [] }),
    ).not.toBeNull()

    const p3 = mortalPlayer()
    p3.realmId = 'qi_refining' // non-mortal with no way
    expect(
      mortalBoundaryContractViolation({ player: p3, skills: [] }),
    ).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Section C - initiation atomicity (commitFiveElementInitiation)
// ---------------------------------------------------------------------------

describe('beta scope - initiation atomicity', () => {
  it('re-commit on a committed player fails already_committed with zero drift', () => {
    const { gameManager, player } = committedContext()
    const committed = structuredClone(player)

    const again = gameManager.realmAdvanceOps.commitFiveElementInitiation('water', player)
    expect(again.ok).toBe(false)
    // preflight ordering: not_mortal fires before already_committed on
    // a committed (qi_refining) player - either way zero drift.
    expect(again.ok ? undefined : again.reason).toBe('not_mortal')
    expect(player).toEqual(committed)
  })

  it('every beta element is admissible; a foreign element id rejects', () => {
    for (const el of ['fire', 'water', 'wood', 'metal', 'earth'] as const) {
      expect(isBetaElement(el)).toBe(true)
    }
    expect(isBetaElement('lightning')).toBe(false)
  })

  it('a rejected commit leaves the player untouched (snapshot audit)', () => {
    const gameManager = new GameManager()
    const player = mortalPlayer()
    gameManager.setActivePlayer(player)
    gameManager.catalogOps.registerProgressionNodes(
      // registries live in the canonical helper; here we only need the
      // failure leg: no linh_bao lv3 casts -> way_not_offered reject.
      [],
    )
    const before = structuredClone(player)
    const result = gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player)
    expect(result.ok).toBe(false)
    expect(player).toEqual(before)
  })
})

// ---------------------------------------------------------------------------
// Section D - tribulation lifecycle + restore (F-LC-1 lives here)
// ---------------------------------------------------------------------------

describe('tribulation lifecycle + restore', () => {
  it('F-LC-1a (DEFECT): an unbounded persisted cooldownUntil must be rejected', () => {
    // The only legal writer stamps started-now + 300s. A value this far
    // in the future is provable forgery of the same class the validator
    // already rejects for alchemy spans - but the tribulation slice has
    // NO upper bound, so this passes shape validation.
    const result = validateGameSaveShape({
      ...mortalSave(),
      tribulation: { cooldownUntil: 9e15 },
    })
    // SAFE behavior: reject. Current behavior: accepts -> probe FAILS.
    expect(result.ok).toBe(false)
  })

  it('F-LC-1b (restore mint demo): the forged cooldown WOULD wedge start() forever', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime({ cooldownUntil: 9e15 })

    // Mint demo: the envelope bound in F-LC-1a is load-bearing - the
    // same payload restored verbatim would wedge the cooldown at
    // ~9e12s, far past the authored 300s.
    const seconds = director.getCooldownSeconds()
    expect(seconds).toBeGreaterThan(TRIBULATION_COOLDOWN_SECONDS)
  })

  it('F-LC-1c (DEFECT consequence): the wedged director blocks an eligible start', () => {
    const { player } = committedContext()
    player.realmLevel = 12
    player.completedStageIds = [
      ...new Set([...player.completedStageIds, QI_REFINING_BREAKTHROUGH_STAGE_ID]),
    ]

    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime({ cooldownUntil: 9e15 })
    // Mint demo: eligible player + reachable transition, and only the
    // forged cooldown stands in the way - the wedge the envelope bound
    // prevents would make start() return false forever.
    expect(
      director.start(
        player,
        resolvePlayerStatAssembly(player, []).stats,
        false,
        'foundation_establishment',
      ),
    ).toBe(false)
  })

  it('an honest cooldown restore does not wedge once expired', () => {
    const { player } = committedContext()
    player.realmLevel = 12
    player.completedStageIds = [
      ...new Set([...player.completedStageIds, QI_REFINING_BREAKTHROUGH_STAGE_ID]),
    ]

    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime({ cooldownUntil: Date.now() - 1 })
    expect(director.getCooldownSeconds()).toBe(0)
    expect(
      director.start(
        player,
        resolvePlayerStatAssembly(player, []).stats,
        false,
        'foundation_establishment',
      ),
    ).toBe(true)
  })

  it('a parked hidden committedOutcome is inert at settle and does not wedge start()', () => {
    const { player } = committedContext()
    player.realmLevel = 12
    player.completedStageIds = [
      ...new Set([...player.completedStageIds, QI_REFINING_BREAKTHROUGH_STAGE_ID]),
    ]

    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime({ committedOutcome: parkedHiddenOutcome() })

    const service = new TribulationOutcomeService()
    const writer = writerOf(player)
    const before = structuredClone({ realmId: player.realmId, cultivation: player.cultivation })
    expect(service.settleOutcome(writer, new GameManager(), director)).toBeNull()
    expect({ realmId: player.realmId, cultivation: player.cultivation }).toEqual(before)

    // start() clears the parked record instead of wedging on it.
    expect(
      director.start(
        player,
        resolvePlayerStatAssembly(player, []).stats,
        false,
        'foundation_establishment',
      ),
    ).toBe(true)
    expect(director.getCommittedOutcome()).toBeNull()
  })

  it('a parked committedOutcome on a non-adjacent target stays inert', () => {
    const { player } = committedContext()
    player.realmLevel = 12
    player.completedStageIds = [
      ...new Set([...player.completedStageIds, QI_REFINING_BREAKTHROUGH_STAGE_ID]),
    ]

    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime({
      committedOutcome: {
        ...parkedHiddenOutcome(),
        breakthroughType: 'normal',
        targetRealmId: 'golden_core', // skip target - transition disabled
      },
    })
    const service = new TribulationOutcomeService()
    expect(service.settleOutcome(writerOf(player), new GameManager(), director)).toBeNull()
  })

  it('defeat settlement applies exactly once - second settle returns the receipt', () => {
    const { player } = committedContext()
    player.realmLevel = 12
    player.completedStageIds = [
      ...new Set([...player.completedStageIds, QI_REFINING_BREAKTHROUGH_STAGE_ID]),
    ]

    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime({
      committedOutcome: {
        attemptId: 7,
        outcome: 'defeat',
        targetRealmId: 'foundation_establishment',
        grade: 'human',
        breakthroughType: 'normal',
        ...witnessedCommitOutcomeFields({
          attemptId: 7,
          outcome: 'defeat',
          targetRealmId: 'foundation_establishment',
          grade: 'human',
          breakthroughType: 'normal',
          departingRealmId: 'qi_refining',
          chapterIndex: 0,
          chaptersTotal: 3,
          lightningStrikesTaken: 0,
          attemptSeed: 7,
        }),
        receipt: null,
        settlementError: false,
      },
    })

    player.cultivation = 10_000
    const service = new TribulationOutcomeService()
    const gameManager = new GameManager()
    const writer = writerOf(player)
    const first = service.settleOutcome(writer, gameManager, director)
    expect(first).not.toBeNull()

    const cultivationAfterFirst = player.cultivation
    const second = service.settleOutcome(writer, gameManager, director)
    expect(second).toBe(first) // receipt identity - no re-apply
    expect(player.cultivation).toBe(cultivationAfterFirst)
  })

  it('restoreRuntime is replacement-complete: a second empty restore clears all runtime', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime({
      committedOutcome: parkedHiddenOutcome(),
      cooldownUntil: Date.now() + 60_000,
    })
    expect(director.getCommittedOutcome()).not.toBeNull()
    expect(director.getCooldownSeconds()).toBeGreaterThan(0)

    director.restoreRuntime({})
    expect(director.getCommittedOutcome()).toBeNull()
    expect(director.getCooldownSeconds()).toBe(0)
  })

  it('serialize -> restore round-trips receipt and settlementError markers', () => {
    const director = new TribulationDirector({ eventBus: new EventBus() })
    director.restoreRuntime({
      committedOutcome: {
        ...parkedHiddenOutcome(),
        receipt: {
          kind: 'victory',
          grantedCultivation: 0,
          announcement: { titleKey: 't', bodyKey: 'b' },
        } as never,
      },
      cooldownUntil: 123,
    })
    const roundTrip = new TribulationDirector({ eventBus: new EventBus() })
    roundTrip.restoreRuntime(director.serializeRuntime())
    expect(roundTrip.getCommittedOutcome()?.receipt).not.toBeNull()
    expect(roundTrip.getCooldownSeconds()).toBe(0) // 123ms -> expired already
  })
})

// ---------------------------------------------------------------------------
// Section E - restore identity + offline math
// ---------------------------------------------------------------------------

describe('restore identity + offline math', () => {
  it('computeRestoreIdentity covers every carried slice and ignores lastSavedAt', () => {
    const { save } = committedSave()
    const a = computeRestoreIdentity(save)
    const shifted = {
      ...save,
      player: { ...(save.player as PlayerData), lastSavedAt: 0 },
    } as GameSave
    expect(computeRestoreIdentity(shifted)).toBe(a) // documented exclusion

    const withJobs = { ...save, alchemyJobs: [{ jobId: 'x' }] } as unknown as GameSave
    expect(computeRestoreIdentity(withJobs)).not.toBe(a)

    const withTrib = {
      ...save,
      tribulation: { cooldownUntil: 5 },
    } as unknown as GameSave
    expect(computeRestoreIdentity(withTrib)).not.toBe(a)

    const withQuests = {
      ...save,
      quests: { active: [{ id: 'q' }] },
    } as unknown as GameSave
    expect(computeRestoreIdentity(withQuests)).not.toBe(a)
  })

  it('offline time never goes negative on a future lastOnlineAt', () => {
    const now = 1_700_000_000_000
    expect(
      calculateOfflineTime({ lastOnlineAt: now + 60_000 }, now).offlineSeconds,
    ).toBe(0)
    expect(
      calculateOfflineTime({ lastOnlineAt: now - 90_000_000 }, now).offlineSeconds,
    ).toBe(24 * 60 * 60)
  })

  it('cultivation buff window splits at expiry; unbuffed base is recoverable', () => {
    const start = 1_000
    const end = 10_000
    const effects = [
      {
        id: 'e1',
        sourceItemId: 'tu_linh_tran',
        effectGroup: 'tu_linh_tran',
        appliedAtMs: 0,
        expiresAtMs: 4_000,
        cultivationSpeedPercent: 0.25,
        modifiers: [],
      },
    ]
    expect(getActiveCultivationSpeedPercent(effects, start)).toBe(0.25)
    expect(getActiveCultivationSpeedPercent(effects, end)).toBe(0)

    const segments = splitCultivationSpeedWindow(effects, start, end)
    expect(segments).toEqual([
      { seconds: 3, percent: 0.25 },
      { seconds: 6, percent: 0 },
    ])

    // EM-02: base = saved/(1+percentAtSave); percentAtSave=0 must not
    // produce NaN/Infinity.
    const percent = getActiveCultivationSpeedPercent([], start)
    const base = 12 / (1 + percent)
    expect(Number.isFinite(base)).toBe(true)
    expect(base).toBe(12)

    // no window -> zero grant, never NaN
    expect(calculateOfflineProgress(0, base).cultivation).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Section F - facade divergence (F-LC-2 lives here)
// ---------------------------------------------------------------------------

describe('facade divergence', () => {
  // Low, deferred per Medium+-only ruling (human exception). The
  // player-only facade has zero consumers today; the canonical boot
  // read passes slices correctly. Skipped, not deleted.
  it.skip('F-LC-2 (DEFECT): betaSupportedFor must agree with the slice-aware verdict', () => {
    const { player } = committedContext()
    const dormantJob = { recipeId: 'alchemy_duong_than_dan_qi_refining' }
    expect(
      unsupportedReleaseReason(player, { alchemyJobs: [dormantJob] }),
    ).toBe('dormant_alchemy_job')

    // The player-only boolean claims "the save carries no out-of-scope
    // state" - it cannot see the slice, so it reports true for a save
    // the canonical read flags. Any future consumer trusting this seam
    // silently loses the dormant-job/dormant-decompose classes.
    expect(betaSupportedFor(player)).toBe(false)
  })
})
