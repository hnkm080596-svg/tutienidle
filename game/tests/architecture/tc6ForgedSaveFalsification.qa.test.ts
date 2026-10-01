// F-TC6 - terminal falsification sweep probes (QA evidence file).
// Blind hostile-save probes against the beta scope lock at commit
// fba2bd85: forge every carried slice to shapes no writer can mint and
// assert the acceptance seams (shape validation, restore preflight,
// unsupportedReleaseReason flagging) reject, park, or flag them.
//
// IMPORTANT: the global vitest setup (tests/setup.betaScope.ts) starts
// every suite with the FULL pre-lock catalog admitted - this suite
// re-pins the canonical beta lock so the probes exercise production
// scope-verdict behavior.
import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { lockBetaWaysForTests } from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '../../src/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaTalentsForTests } from '../../src/core/game/__fixtures__/betaTalentsUnlock'

lockBetaWaysForTests()
lockBetaFeaturesForTests()
lockBetaTalentsForTests()

import { GameManager } from '../../src/core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../src/core/player/Player'
import { materials } from '../../src/data/materials/materials'
import { pills } from '../../src/data/pill/pills'
import { equipment } from '../../src/data/equipment/equipment'
import { affixes } from '../../src/data/equipment/affixes'
import { buildings } from '../../src/data/building/buildings'
import { SKILLS } from '../../src/data/skill/Skills'
import { TECHNIQUES } from '../../src/data/technique/Techniques'
import { alchemyRecipes } from '../../src/data/alchemy/alchemyRecipes'
import { QUESTS } from '../../src/data/quest/quests'
import { REALM_PASSIVES } from '../../src/data/realm/RealmPassives'
import { TribulationOutcomeService } from '../../src/core/tribulation/TribulationOutcomeService'
import { getRealmIndex } from '../../src/core/realm/realmSystem'

type RealmId = string
import { unsupportedReleaseReason } from '../../src/core/betaScopeSurface'
import { usePlayerStore } from '../../src/stores/player'
import { restoreGameSession, type GameSave } from '../../src/services/save/SaveSystem'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from '../../src/services/save/saveAcceptance'
import type { StatModifier } from '../../src/core/stats/StatCalculator'
import type { BuildingInstance } from '../../src/core/building/BuildingInstance'
import type { Technique } from '../../src/core/technique/Technique'
import type { AlchemyJobSave, TribulationSaveSlice } from '../../src/services/save/saveTypes'

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

/** Minimal legal committed beta save: spell_pathway at the given realm. */
function committedPlayer(realmId: RealmId): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  player.spellPath = { element: null }
  player.realmId = realmId
  player.realmLevel = 1
  delete player.mortalBasicSkillId
  return player
}

function wayTechnique(realmIndex: number): Technique {
  const entry = structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
  entry.grade = Math.max(1, Math.min(entry.grade, realmIndex))
  entry.gradeHistory = {}
  // Canonical history: every grade BELOW the live grade carries a sealed
  // record; the live grade carries one only when it lags the realm.
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
  playerOverrides: Partial<PlayerData>,
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

/** Boot-path classification: shape -> acceptance. */
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

const MOD = (over: Partial<StatModifier>): StatModifier => ({
  id: 'tc6_forge',
  sourceType: 'realm',
  sourceId: 'nham_mach',
  stat: 'strength',
  flat: 999,
  ...over,
})

describe('TC6-A claim-vs-writer: player.modifiers sourceType/sourceId', () => {
  it('A1 - forged realm/nham_mach modifier with a NON-canonical id is rejected at the boundary', () => {
    // F-TC6-9: a meridian-claimed entry must carry the writer-canonical
    // 'bat-mach:<meridian>:<stat>' id on an authored stat at the authored
    // percent - 'tc6_forge' with flat 999 fails shape outright.
    const { save } = committedSave('qi_refining', { modifiers: [MOD({})] })
    const { acceptable, shape } = classify(save)
    expect(shape.ok).toBe(false)
    expect(acceptable).toBe(false)

    const { result } = boot(save)
    expect(result.status).toBe('rejected')
  })

  it('A2 - control: canonical bat-mach:<meridian>:<stat> id IS stripped by applyAllBodyModifiers', () => {
    // Authored-shaped claim (canonical id, meridian stat, authored
    // percent): admitted at shape, then stripped at restore because the
    // meridian is unopened.
    const { save } = committedSave('qi_refining', {
      modifiers: [
        MOD({
          id: 'bat-mach:nham_mach:maxHp',
          stat: 'maxHp',
          flat: undefined,
          percent: 0.05,
        }),
      ],
    })
    const { playerStore, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(playerStore.modifiers.find((m) => m.id === 'bat-mach:nham_mach:maxHp')).toBeUndefined()
  })

  it('A3 - forged talent/loi_kiep modifier (no talent selected) is rejected at the boundary', () => {
    // F-TC6-1: a loi_kiep claim requires the talent held in
    // selectedTalentIds - the same-save ownership witness.
    const { save } = committedSave('qi_refining', {
      selectedTalentIds: [],
      modifiers: [MOD({ id: 'talent_loi_kiep_strength', sourceType: 'talent', sourceId: 'loi_kiep' })],
    })
    const { acceptable, shape } = classify(save)
    expect(shape.ok).toBe(false)
    expect(acceptable).toBe(false)

    const { result } = boot(save)
    expect(result.status).toBe('rejected')
  })

  it('A4 - forged nhap_dao marker + inflated percent rebuilds to authored at emit', () => {
    const { save } = committedSave('qi_refining', {
      grantedRealmPassiveIds: ['qi_refining'],
      modifiers: [
        MOD({
          id: 'realm-passive:nhap_dao:maxHp',
          sourceId: 'nhap_dao',
          stat: 'maxHp',
          flat: undefined,
          percent: 99,
        }),
      ],
    })
    const { acceptable, shape } = classify(save)
    expect(shape.ok).toBe(true)
    expect(acceptable).toBe(true)

    const { playerStore, manager, result } = boot(save)
    expect(result.status).toBe('ok')
    // F-TC6-2 rebuild-don't-trust: the marker stays coherent, but the
    // EMITTED magnitude comes from the authored builder
    // (breakthroughGrade * 0.03) - the persisted 99 never reaches stats.
    const cleanPlayer = committedPlayer('qi_refining')
    const authoredPercent = cleanPlayer.breakthroughGrade * 0.03
    const cleanMaxHp = makeManager().resolveAmbientPlayerStats(cleanPlayer).maxHp
    const stats = manager.resolveAmbientPlayerStats(playerStore.$state)
    expect(stats.maxHp).toBeCloseTo(cleanMaxHp * (1 + authoredPercent), 5)
  })

  it('A5 - forged equipment-source modifier is wiped by setEquipmentModifiers (inert)', () => {
    const { save } = committedSave('qi_refining', {
      modifiers: [MOD({ id: 'tc6_eq', sourceType: 'equipment', sourceId: 'bronze_sword' })],
    })
    const { playerStore, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(playerStore.modifiers.find((m) => m.id === 'tc6_eq')).toBeUndefined()
  })

  it('A6 - forged baseStats magnitude (no writer bound) flows into live final stats', () => {
    const player = committedPlayer('qi_refining')
    player.baseStats.vitality = 1e9
    const { save } = committedSave('qi_refining', { baseStats: player.baseStats })
    const { playerStore, manager, result } = boot(save)
    expect(result.status).toBe('ok')
    // resolvePlayerStatAssembly spreads player.baseStats into assembledBase
    // with no earned-points reconciliation - a fabricated magnitude is the
    // pipeline base itself (vitality -> maxHp flat attribute modifier).
    // Correct contract: baseStats is clamped to the max the player's
    // level/talents could allocate, or re-derived.
    const stats = manager.resolveAmbientPlayerStats(playerStore.$state)
    expect(stats.maxHp).toBeLessThan(1e6)
  })

  it('A7 - forged attributePoints pool (no earned-points bound) allocates to cap live', () => {
    // attributePoints is shape-checked (number >= 0) but never reconciled
    // against earned points (level + talents). baseStats IS clamped to
    // getEffectiveMainStatCap at restore - the pool is not, so the forge
    // buys the same end-state a long grind would, instantly.
    const { save } = committedSave('qi_refining', { attributePoints: 1e9 })
    const { acceptable, shape } = classify(save)
    // F-TC6-6: attributePoints is bounded by getGlobalCultivationLevel
    // (1 point per tier climbed) - a pool above the earnable total
    // rejects the save at the boundary.
    expect(shape.ok).toBe(false)
    expect(acceptable).toBe(false)
  })

  it('A8 - forged quest progress (unbounded) claims a live quest reward', () => {
    // quests.active[].progress is shape-checked (number >= 0) with no
    // bound vs the authored condition; claim() trusts it. A fabricated
    // progress mints the authored reward without ever playing the quest.
    const { save } = committedSave('qi_refining', {}, {
      quests: {
        active: [{ questId: 'kill_wild_wolf_10', progress: 999, claimed: false }],
        completedOnceIds: [],
        lastDailyResetAtMs: 0,
      },
    })
    const { playerStore, manager, result } = boot(save)
    expect(result.status).toBe('ok')
    // F-TC6-7 RESIDUAL: progress survives the restore unchanged. The
    // value is a live counter with legitimate overshoot (pinned by
    // TrucCoJourney at 332 above a requirement of 10) and a forge AT
    // the amount is indistinguishable from earned progress - no event
    // ledger exists in the save schema, so no boundary check can
    // separate the two without data loss. Escalated as
    // unrepairable-in-principle on the current schema.
    expect(manager.questManager.getProgress('kill_wild_wolf_10')?.progress).toBe(999)
    void playerStore
  })
})

describe('TC6-B dormant-record liveness', () => {
  it('B1 - coherent hiddenPerfection + missing passive marker emits ENHANCED realm passive at next sync', () => {
    const { save } = committedSave('qi_refining', {
      hiddenPerfection: {
        lineageActive: true,
        completedHiddenBodyRealmIds: ['mortal'],
        hiddenBreakthroughRealmIds: ['qi_refining'],
        realms: { mortal: { discovered: true, bodyCompleted: true, frozen: false } },
      },
    })
    const { acceptable, shape } = classify(save)
    expect(shape.ok).toBe(true)
    expect(acceptable).toBe(true)

    const { playerStore, manager, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(
      unsupportedReleaseReason(playerStore.$state, {
        tribulation: save.tribulation,
        alchemyJobs: save.alchemyJobs,
      }),
    ).toBe('hidden_progression_state')

    // The NEXT normal breakthrough/victory calls syncRealmStatPassive ->
    // grantRealmPassive reads wasHiddenBreakthrough -> selects the
    // ENHANCED (hidden-path) modifier set: a dormant record driving a
    // live write. Correct contract under the lock: carried hidden records
    // stay inert (normal emit or none).
    manager.realmAdvanceOps.syncRealmStatPassive(playerStore.$state)
    const nhapDao = REALM_PASSIVES.find((p) => p.id === 'qi_refining')!
    const enhanced = nhapDao.buildEnhancedModifiers!(playerStore.$state)
    const emittedEnhanced = playerStore.modifiers.filter((m) =>
      enhanced.some((e) => e.id === m.id && e.percent === m.percent),
    )
    expect(emittedEnhanced.length).toBe(0)
  })

  it('B2 - highestFoundationAchieved great_dao (no beta writer can mint it) mints the 0.2 passive unflagged', () => {
    const { save } = committedSave('foundation_establishment', {
      highestFoundationAchieved: 'great_dao',
      grantedRealmPassiveIds: [], // fe passive marker absent -> next sync grants
    })
    const { acceptable, shape } = classify(save)
    expect(shape.ok).toBe(true)
    expect(acceptable).toBe(true)

    const { playerStore, manager, result } = boot(save)
    expect(result.status).toBe('ok')
    // F-TC6-3: a great_dao foundation is hidden-progression carry - the
    // save is flagged, never silent.
    expect(
      unsupportedReleaseReason(playerStore.$state, {
        tribulation: save.tribulation,
        alchemyJobs: save.alchemyJobs,
      }),
    ).toBe('hidden_progression_state')

    manager.realmAdvanceOps.syncRealmStatPassive(playerStore.$state)
    // KIEN_CO_MAIN_STAT_PERCENT.great_dao = 0.2 - the emit is suppressed
    // entirely under the beta lock (hiddenContent dormant).
    expect(
      playerStore.modifiers.some(
        (m) => m.id.startsWith('realm-passive:kien_co:'),
      ),
    ).toBe(false)
  })

  it('B3 - hidden breakthroughType committed outcome parks (settle null, record kept, flagged)', () => {
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
            breakthroughType: 'hidden',
            receipt: null,
            settlementError: false,
          },
          cooldownUntil: 0,
        } satisfies TribulationSaveSlice,
      },
    )
    const { playerStore, manager, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(
      unsupportedReleaseReason(playerStore.$state, { tribulation: save.tribulation }),
    ).toBe('pending_tribulation_state')
    expect(
      new TribulationOutcomeService().settleOutcome(
        playerStore,
        manager,
        manager.tribulationDirector,
      ),
    ).toBeNull()
    expect(playerStore.realmId).toBe('qi_refining')
    expect(manager.tribulationDirector.getCommittedOutcome()?.outcome).toBe('victory')
  })

  it('B4 - forged NORMAL outcome targeting a dormant realm transition parks inert', () => {
    const { save } = committedSave(
      'foundation_establishment',
      {},
      {
        tribulation: {
          committedOutcome: {
            attemptId: 7,
            outcome: 'victory',
            targetRealmId: 'golden_core',
            grade: 'heaven',
            breakthroughType: 'normal',
            receipt: null,
            settlementError: false,
          },
          cooldownUntil: 0,
        } satisfies TribulationSaveSlice,
      },
    )
    const { playerStore, manager, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(
      unsupportedReleaseReason(playerStore.$state, { tribulation: save.tribulation }),
    ).toBe('pending_tribulation_state')
    expect(
      new TribulationOutcomeService().settleOutcome(playerStore, manager, manager.tribulationDirector),
    ).toBeNull()
    expect(playerStore.realmId).toBe('foundation_establishment')
  })

  it('B5 - dormant-family alchemy job parks: no pill delivered, job retained, flagged', () => {
    const job: AlchemyJobSave = {
      jobId: 'j1',
      recipeId: 'alchemy_thong_mach_dan',
      pillId: 'thong_mach_dan',
      herbMaterialId: 'tu_linh_thao_qi_refining_thuong_co',
      startedAtMs: Date.now() - 999_000,
      completesAtMs: Date.now() - 1,
      roomLevelAtStart: 1,
    }
    const { save } = committedSave('qi_refining', {}, { alchemyJobs: [job] })
    const { playerStore, manager, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(
      unsupportedReleaseReason(playerStore.$state, { alchemyJobs: save.alchemyJobs }),
    ).toBe('dormant_alchemy_job')
    manager.alchemySystem.tick(
      Date.now(),
      manager.pillBag,
      (id) => (manager.pillRegistry.has(id) ? manager.pillRegistry.get(id) : undefined),
    )
    expect(manager.alchemySystem.getJobs().some((j) => j.recipeId === 'alchemy_thong_mach_dan')).toBe(true)
    expect(manager.pillBag.getAmount('thong_mach_dan')).toBe(0)
  })

  it('B6 - beta recipe job with mismatched pillId is rejected at shape (recipe↔pill binding)', () => {
    const job: AlchemyJobSave = {
      jobId: 'j2',
      recipeId: 'alchemy_tu_linh_dan_qi_refining',
      pillId: 'thong_mach_dan', // forged: wrong family member entirely
      herbMaterialId: 'tu_linh_thao_qi_refining_thuong_co',
      startedAtMs: Date.now() - 999_000,
      completesAtMs: Date.now() - 1,
      roomLevelAtStart: 1,
    }
    const { save } = committedSave('qi_refining', {}, { alchemyJobs: [job] })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    // Second wall (F-A7-3): even if it leaked past admission, settle
    // re-derives pill from recipe.pillId - the forged field is dead.
  })

  it('B8 - forged building level (no writer bound at admission) mints scaled production live', () => {
    // gathering_outpost (beta legal, produces spirit stone) at a level no
    // writer can mint (maxLevel 9): shape checks only level>=1, acceptance
    // checks only buildingId, unsupportedReleaseReason has no building
    // reason - the level claim flows straight into rate/capacity math.
    const forged: BuildingInstance = {
      instanceId: 'b_forge',
      buildingId: 'gathering_outpost',
      level: 200,
      lastCollectedAt: Date.now() / 1000 - 36_000, // full 10h offline cap
      accrualRealmId: 'qi_refining',
    } as unknown as BuildingInstance
    const { save } = committedSave('qi_refining', {}, { buildings: [forged] })
    // F-A8-2 boundary bound: level above the template's maxLevel rejects
    // the save outright.
    const { acceptable, shape } = classify(save)
    expect(shape.ok).toBe(false)
    expect(acceptable).toBe(false)

    // F-TC6-5 defense in depth: even past admission the rate/capacity
    // seams clamp level to maxLevel - a forged level can never
    // out-produce a legal instance.
    const now = Date.now() / 1000
    const template = buildings.find((b) => b.id === 'gathering_outpost')!
    const manager = makeManager()
    const forgedStored = manager.buildingSystem.getStoredAmount(forged, template, now, 'qi_refining')
    const legitStored = manager.buildingSystem.getStoredAmount(
      { ...forged, level: template.maxLevel },
      template,
      now,
      'qi_refining',
    )
    expect(legitStored).toBeGreaterThan(0)
    expect(forgedStored).toBeLessThanOrEqual(legitStored)
  })

  it('B7 - RETIRED + scope-hidden family job escapes the parking predicate and settles live', () => {
    // alchemy_hoi_xuan_dan_* : family retired=true AND not in
    // BETA_ENABLED_RECIPE_FAMILIES. tick parks only when
    // `recipe?.retired !== true && scopeHidden(...) !== null` - retired
    // flips the first clause so the dormant job SETTLES and mints the
    // dormant pill into the live bag during restore's offline settle.
    const retiredRecipe = alchemyRecipes.find((r) => r.id === 'alchemy_hoi_xuan_dan_qi_refining')!
    expect(retiredRecipe.retired).toBe(true)
    const job: AlchemyJobSave = {
      jobId: 'j3',
      recipeId: retiredRecipe.id,
      pillId: retiredRecipe.pillId,
      herbMaterialId: 'hoi_xuan_thao_qi_refining_thuong_co', // 100% base
      startedAtMs: Date.now() - 999_000,
      completesAtMs: Date.now() - 1,
      roomLevelAtStart: 1,
    }
    const { save } = committedSave('qi_refining', {}, { alchemyJobs: [job] })
    const { acceptable, shape } = classify(save)
    expect(shape.ok).toBe(true)
    expect(acceptable).toBe(true)

    const { playerStore, manager, result } = boot(save)
    expect(result.status).toBe('ok')
    // Correct contract: the dormant-family record parks (or at minimum
    // fails as unresolvable) - never delivers its dormant pill.
    expect(manager.alchemySystem.getJobs().some((j) => j.recipeId === retiredRecipe.id)).toBe(true)
    expect(manager.pillBag.getAmount(retiredRecipe.pillId)).toBe(0)
    // The flag DOES fire (it reads the persisted job record, not the
    // consumed live state) - the defect is the contradiction: flagged
    // 'dormant_alchemy_job' while the same restore minted the pill live.
    expect(
      unsupportedReleaseReason(playerStore.$state, { alchemyJobs: save.alchemyJobs }),
    ).toBe('dormant_alchemy_job')
  })
})

describe('TC6-C hostile slices', () => {
  it('C1 - player.modifiers non-array / entries non-object are rejected at shape', () => {
    const { save } = committedSave('qi_refining', {})
    const hostile = JSON.parse(JSON.stringify(save))
    hostile.player.modifiers = 'not-an-array'
    expect(validateGameSaveShape(hostile).ok).toBe(false)
    hostile.player.modifiers = [{ bogus: true }]
    expect(validateGameSaveShape(hostile).ok).toBe(false)
  })

  it('C2 - swordPath as a string on a spell save is rejected at shape', () => {
    const { save } = committedSave('qi_refining', {})
    const hostile = JSON.parse(JSON.stringify(save))
    hostile.player.swordPath = 'corrupt'
    expect(validateGameSaveShape(hostile).ok).toBe(false)
  })

  it('C3 - forged production site: unknown siteId rejected at acceptance', () => {
    const { save } = committedSave(
      'qi_refining',
      {},
      { productionSites: [{ siteId: 'ghost_site', level: 1, autoRestart: false }] },
    )
    expect(classify(save).acceptable).toBe(false)
  })

  it('C4 - forged workerCycles: collectionRealmId above player realm rejected at shape', () => {
    const { save } = committedSave(
      'qi_refining',
      {},
      {
        productionSites: [
          {
            siteId: 'thanh_van_grotto',
            level: 1,
            autoRestart: true,
            workerCycles: [
              {
                cycleId: 'c1',
                siteId: 'thanh_van_grotto',
                collectionRealmId: 'golden_core',
                siteLevelAtStart: 1,
                rewardTableVersion: 1,
                rollSeed: 1,
                startedAtMs: 1,
                completesAtMs: 2,
              },
            ],
          },
        ],
      },
    )
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(save))).ok).toBe(false)
  })

  it('C5 - forged decompose settings (workers 3, started) restore inert under scope-hidden', () => {
    const { save } = committedSave(
      'qi_refining',
      {},
      {
        decompose: {
          settings: { gradeFilter: 'all', ageFilter: 'all', workers: 3 },
          nextCycleAt: Date.now() - 1,
          started: true,
        },
      },
    )
    const { manager, result } = boot(save)
    expect(result.status).toBe('ok')
    // Engine reports 0 claimed workers under scope-hidden: the forged
    // slice cannot steal the shared pool or mint materials.
    expect(manager.decomposeSystem.getSettings().workers).toBe(0)
  })

  it('C6 - pill-source timed effect admits ONLY manaRegenPerTurn modifiers', () => {
    const forged = (stat: string) => ({
      id: 'tc6_fx',
      sourceItemId: 'hoi_linh_dan_qi_refining',
      effectGroup: 'pill_regen',
      appliedAtMs: 1,
      expiresAtMs: Date.now() + 60_000,
      modifiers: [
        { id: 'tc6_fx_m', sourceType: 'pill', sourceId: 'hoi_linh_dan_qi_refining', stat, flat: 9999 },
      ],
    })
    const { save: bad } = committedSave(
      'qi_refining',
      { persistentTimedEffects: [forged('strength')] } as Partial<PlayerData>,
      {},
    )
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(bad))).ok).toBe(false)

    // Magnitude is bound too: flat above the authored
    // mpPerSecond*1.5 ceiling is rejected at the boundary.
    const { save: ok } = committedSave(
      'qi_refining',
      { persistentTimedEffects: [forged('manaRegenPerTurn')] } as Partial<PlayerData>,
      {},
    )
    expect(validateGameSaveShape(JSON.parse(JSON.stringify(ok))).ok).toBe(false)
  })

  it('C7 - dormant-authored pill id as effect source is admitted (scope-blind writer bound)', () => {
    // thong_mach_dan is authored but scope-hidden - a writer could never
    // mint this claim under the lock, yet the pill-id bound admits it.
    const forged = {
      id: 'tc6_fx2',
      sourceItemId: 'thong_mach_dan',
      effectGroup: 'pill_regen',
      appliedAtMs: 1,
      expiresAtMs: Date.now() + 60_000,
      modifiers: [
        {
          id: 'tc6_fx2_m',
          sourceType: 'pill',
          sourceId: 'thong_mach_dan',
          stat: 'manaRegenPerTurn',
          flat: 9999,
        },
      ],
    }
    const { save } = committedSave(
      'qi_refining',
      { persistentTimedEffects: [forged] } as Partial<PlayerData>,
      {},
    )
    // F-TC6-8: a dormant authored pill family can never be a writer -
    // the claim is rejected at the boundary before it can feed the live
    // pipeline.
    const res = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(res.ok).toBe(false)

    const { result } = boot(save)
    expect(result.status).toBe('rejected')
  })
})

describe('TC6-D sequence / replay', () => {
  it('D1 - dormant committed outcome round-trips restore->serialize intact (parked, not dropped)', () => {
    const tribulation: TribulationSaveSlice = {
      committedOutcome: {
        attemptId: 3,
        outcome: 'victory',
        targetRealmId: 'golden_core',
        grade: 'human',
        breakthroughType: 'hidden',
        receipt: null,
        settlementError: false,
      },
      cooldownUntil: 0,
    }
    const { save } = committedSave('foundation_establishment', {}, { tribulation })
    const { manager, result } = boot(save)
    expect(result.status).toBe('ok')
    const committed = manager.tribulationDirector.getCommittedOutcome()
    expect(committed?.outcome).toBe('victory')
    expect(committed?.breakthroughType).toBe('hidden')
    const rebuilt = manager.tribulationDirector.serializeRuntime()
    expect(rebuilt.committedOutcome?.outcome).toBe('victory')
    expect(rebuilt.committedOutcome?.breakthroughType).toBe('hidden')
  })

  it('D2 - identical payload restored twice converges (no double-apply)', () => {
    const { save } = committedSave('qi_refining', {})
    const { result: r1, playerStore: p1 } = boot(save)
    expect(r1.status).toBe('ok')
    const { result: r2, playerStore: p2 } = boot(save)
    expect(r2.status).toBe('ok')
    expect(p2.$state.realmId).toBe(p1.$state.realmId)
  })
})
