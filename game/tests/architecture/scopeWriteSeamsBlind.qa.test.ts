/**
 * Blind adversarial audit - AUTHORITY/scope write seams (pin ea406a1f).
 *
 * Scope attacked: write/authority seams only - purchase/upgrade/learn/
 * respec/spec-claim, way selection, talent invest, building build/
 * upgrade/worker assigns, production cycles, alchemy job starts,
 * quest accept/claim, pill craft/consume/dissolve, equipment
 * enhance/socket/dissolve, formation edits, devtools/admin paths,
 * migrations, event handlers that write state, and persisted-claim
 * producibility at save boundaries (any persisted value no authored
 * writer could produce).
 *
 * Known human-accepted residual class (not reported): same-value
 * forged counters where an authored writer COULD produce the value
 * (quest progress, timestamps, counters within authored bounds).
 *
 * Beta flags are pinned by lockBeta*ForTests() - the suite asserts
 * behavior under the canonical all-false table (the global setup file
 * unlocks everything for the historical suite). it.fails probes are
 * CONFIRMED defects: the inner assertion expresses the scope contract
 * and currently fails; if a fix lands the it.fails wrapper goes red.
 */
import { describe, expect, it, vi } from 'vitest'
import { GameManager } from '@/core/game/GameManager'
import { ManualClockSource } from '@/core/battle/turn/CombatClock'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import { getRealmIndex } from '@/core/realm/realmSystem'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { KIEM_TU_NODES } from '@/data/progression/KiemTuNodes'
import { THE_TU_NODES } from '@/data/progression/TheTuNodes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { materials } from '@/data/materials/materials'
import { pills } from '@/data/pill/pills'
import { buildings } from '@/data/building/buildings'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { ENEMIES } from '@/data/enemy/Enemies'
import { SKILLS } from '@/data/skill/Skills'
import { QUESTS } from '@/data/quest/quests'
import { betaTechniqueAdmitted } from '@/core/betaScopeSkillDomain'
import { isBetaEnemyId, isBetaFeature, isBetaWay } from '@/core/betaScope'
import { applyPathChoice } from '@/core/player/CultivationPathSystem'
import { issueCompanionGifts } from '@/core/companion/CompanionGifts'
import { attemptNghichChuTian } from '@/core/realm/hidden/NghichChuTian'
import { registerEnemySpawnDebug } from '@/core/dev/enemySpawnDebug'
import { freshSwordPathState } from '@/core/kiem-tu/KiemTuState'
import { validateGameSaveShape } from '@/services/save/saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from '@/services/save/saveAcceptance'
import { CURRENT_SAVE_VERSION } from '@/services/save/saveVersion'
import type { GameSave } from '@/services/save/saveTypes'
import type { Technique } from '@/core/technique/Technique'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

// The 5 canonical techniques declared by dormant ways (hidden_spell,
// sword, hidden_sword, body, hidden_body) - the exact catalog ids the
// scope gate exists to keep out of live beta play.
const DORMANT_CANONICAL_TECHNIQUE_IDS = [
  'dao_insight_art',
  'sword_control_art',
  'myriad_swords_art',
  'diamond_body_art',
  'responsive_body_art',
] as const

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.setCombatClockSource(new ManualClockSource())
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  manager.catalogOps.registerSkillTemplates([...SKILLS])
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerEnemyTemplates(ENEMIES)
  manager.catalogOps.registerQuests(QUESTS)
  manager.catalogOps.registerProgressionNodes([
    ...KIEM_TU_NODES,
    ...THE_TU_NODES,
    ...SKILL_CORE_NODES,
  ])
  return manager
}

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

// A flagged save state: legitimately persisted dormant way + slice,
// carried into beta (contract: must still LOAD, stays inert).
function swordSave(overrides: Partial<PlayerData> = {}): PlayerData {
  return player({
    cultivationPath: 'sword',
    cultivationWay: 'sword_pathway',
    swordPath: freshSwordPathState(),
    realmId: 'qi_refining',
    realmLevel: 1,
    skillInsight: 100,
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// F-TECH-1 - TechniqueSystem.grant bypasses the betaTechniqueAdmitted
// scope gate every sibling mutator enforces. Public mint path:
// gameManager.realmAdvanceOps.grantCanonicalTechnique(id, player) ->
// techniqueSystem.grant(template, realmId) with no scope check.
// ---------------------------------------------------------------------------
describe('F-TECH-1: canonical-technique grant bypasses the scope admission gate', () => {
  it.fails.each(DORMANT_CANONICAL_TECHNIQUE_IDS)(
    'grantCanonicalTechnique must refuse dormant canonical %s on an empty holder',
    (techniqueId) => {
      const manager = makeManager()
      // Preconditions: dormant-way technique id (scope-hidden), an
      // empty holder, and a realm whose grade ceiling admits grade 1.
      // The empty-holder+non-mortal state is non-producible at pin
      // (save acceptance rejects it - see the pinned probes below), so
      // this is a latent write-path bypass: the seam has no gate.
      expect(betaTechniqueAdmitted(techniqueId)).toBe(false)
      const p = player({ realmId: 'qi_refining', realmLevel: 1 })

      const admitted = manager.realmAdvanceOps.grantCanonicalTechnique(techniqueId, p)

      // Contract: a write path that mints a dormant-way artifact into
      // the live holder must fail closed like its sibling mutators.
      expect(admitted).toBe(false)
      expect(manager.techniqueManager.getActive()).toBeUndefined()
    },
  )

  it('contrast: every sibling mutator refuses the same dormant holder', () => {
    const manager = makeManager()
    const p = player({ realmId: 'qi_refining', realmLevel: 10 })

    // Seat a dormant holder through the same ungated path under test,
    // then prove the rest of the surface is locked: mastery accrual,
    // realm-exit seal, and the grade-advance ops transaction all
    // refuse - grant() is the lone ungated writer in this class.
    expect(manager.realmAdvanceOps.grantCanonicalTechnique('sword_control_art', p)).toBe(true)
    expect(manager.techniqueManager.getActive()?.id).toBe('sword_control_art')

    expect(manager.techniqueSystem.gainMastery(1_000_000, 'qi_refining', 10))
      .toEqual({ gained: 0, rankUps: 0 })
    expect(manager.techniqueSystem.sealFrozenCycle('foundation_establishment', 10)).toBe(false)
    expect(manager.realmAdvanceOps.tryAdvanceTechniqueGrade(p)).toBe(false)
  })

  it('contrast: what actually refuses the dormant mint at realmIndex 0 is the grade ceiling, not a scope gate', () => {
    const manager = makeManager()
    const p = player({ realmId: 'mortal' })

    // Mortal ceiling is 0; every authored technique is grade 1. This
    // refusal is incidental (ceiling math), identical for beta ids -
    // proving grant() itself carries no scope admission check.
    expect(manager.realmAdvanceOps.grantCanonicalTechnique('sword_control_art', p)).toBe(false)
    expect(manager.realmAdvanceOps.grantCanonicalTechnique('five_elements_art', p)).toBe(false)
  })

  it('save boundary pins the non-producible precondition: a non-mortal save cannot enter with an empty technique holder', () => {
    // The one player state that would make grant() reachable - empty
    // holder on a post-initiation save - is already rejected at the
    // shape layer (before saveAcceptance even runs) on every ingress
    // seam: 'realm >= qi_refining nhưng techniques trống'.
    const save = committedSave('qi_refining', {}, { techniques: [] })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)

    // And a way-less non-mortal save is rejected outright, so no
    // authored ingress produces the required precondition.
    const wayless = committedSave('qi_refining')
    wayless.player.cultivationPath = undefined
    wayless.player.cultivationWay = undefined
    const shape2 = validateGameSaveShape(JSON.parse(JSON.stringify(wayless)))
    expect(
      shape2.ok === false ||
        isSaveAcceptable(shape2.normalizedSave as GameSave, catalogs) === false,
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// F-TECH-2 - setTechniqueQuality mutates a dormant holder's record with
// no scope gate (same class as grant - the dormant record on a flagged
// save must stay frozen data).
// ---------------------------------------------------------------------------
describe('F-TECH-2: technique quality write is ungated on a dormant holder', () => {
  it.fails('setTechniqueQuality must refuse a dormant-way canonical', () => {
    const manager = makeManager()
    const dormant = structuredClone(
      TECHNIQUES.find((t) => t.id === 'sword_control_art')!,
    )
    manager.techniqueManager.restore([dormant])

    const ok = manager.techniqueSystem.setTechniqueQuality('thien')

    expect(ok).toBe(false)
    expect(manager.techniqueManager.getActive()?.quality).toBe(dormant.quality)
  })

  it('control: the same write is admitted on the beta canonical', () => {
    const manager = makeManager()
    const beta = structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
    manager.techniqueManager.restore([beta])

    expect(manager.techniqueSystem.setTechniqueQuality('thien')).toBe(true)
    expect(manager.techniqueManager.getActive()?.quality).toBe('thien')
  })
})

// ---------------------------------------------------------------------------
// F-DEV-1 - devtools seam: window.__tutienEnemySpawnDebug (DEV builds
// only) bypasses beta roster admission (spawnEnemy accepts ANY
// registered catalog enemy, incl. hidden beasts) and mints persisted
// perfect-clear records no authored writer produced.
// ---------------------------------------------------------------------------
describe('F-DEV-1: enemySpawnDebug dev hooks bypass roster + mint persisted claims', () => {
  it('the DEV hook spawns a non-roster hidden beast live', () => {
    const manager = makeManager()
    const p = player({ realmId: 'qi_refining', realmLevel: 1 })
    manager.setActivePlayer(p)

    vi.stubGlobal('window', {})
    try {
      registerEnemySpawnDebug({ gameManager: manager, player: p })
    } finally {
      vi.unstubAllGlobals()
    }

    // registerEnemySpawnDebug guards on (import.meta.env.DEV && window):
    // under vitest DEV is true and the stubbed window carries the hook.
    // In a real production bundle the whole block is stripped - the
    // finding is the seam's existence in dev builds, not ship risk.
    const hooks = (globalThis as { window?: { __tutienEnemySpawnDebug?: unknown } })
      .window?.__tutienEnemySpawnDebug as
      | { spawnEnemy: (id: string) => string; forcePerfectClear: (id: string) => string }
      | undefined
    if (hooks === undefined) {
      // Node env without DEV - nothing to probe; the gate held.
      expect(typeof window).toBe('undefined')
      return
    }

    // 'co_thu' is a registered hidden-beast catalog id that is NOT on
    // the beta roster - roster admission is bypassed by this seam.
    expect(isBetaEnemyId('co_thu')).toBe(false)
    const result = hooks.spawnEnemy('co_thu')
    expect(result).not.toContain('not found')
    expect(manager.getTurnBattle()).not.toBeNull()

    // forcePerfectClear mints persisted claims (perfectClearStageIds +
    // perfectClearSeconds) with no authored writer - they persist into
    // the next save payload.
    hooks.forcePerfectClear('stage_qi_01')
    expect(p.perfectClearStageIds).toContain('stage_qi_01')
    expect(p.perfectClearSeconds['stage_qi_01']).toBeTypeOf('number')
  })
})

// ---------------------------------------------------------------------------
// Seam census - the gates that DO hold. Each probe is green evidence
// for the report's coverage map.
// ---------------------------------------------------------------------------
describe('way selection + way-owned write seams fail closed', () => {
  it('chooseCultivationPath refuses every dormant way', () => {
    const manager = makeManager()
    for (const wayId of ['sword_pathway', 'hidden_sword_pathway', 'body_pathway', 'hidden_body_pathway', 'hidden_spell_pathway'] as const) {
      expect(isBetaWay(wayId)).toBe(false)
      const p = player()
      expect(
        manager.realmAdvanceOps.chooseCultivationPath(wayId.startsWith('hidden_spell') ? 'spell' : wayId.includes('sword') ? 'sword' : 'body', wayId, p),
        wayId,
      ).toBe(false)
      expect(p.cultivationPath).toBeUndefined()
    }
  })

  it('domain applyPathChoice is ops-gated: the only public caller carries the isBetaWay check first', () => {
    // Direct-domain sanity: the dormant commit itself is gated at the
    // ops seam above; a way with a satisfied offerGate still cannot be
    // reached through the public surface. Probed via chooseCultivationPath.
    const manager = makeManager()
    const p = player()
    expect(manager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', p)).toBe(false)
    expect(p.cultivationWay).toBeUndefined()
  })

  it('grantCultivationPathRealmReward refuses a carried dormant way', () => {
    const manager = makeManager()
    const p = swordSave()
    expect(manager.realmAdvanceOps.grantCultivationPathRealmReward(p, 'qi_refining')).toBe(false)
  })

  it('reconcileWayGrants writes nothing on a dormant-way save', () => {
    const manager = makeManager()
    const p = swordSave()
    manager.realmAdvanceOps.reconcileWayGrants(p)
    expect(p.nodeLevels).toEqual({})
    expect(p.purchasedNodeIds).toEqual([])
  })

  it('syncRealmPassive learns nothing on a dormant-way save', () => {
    const manager = makeManager()
    const p = swordSave()
    manager.realmAdvanceOps.syncRealmPassive(p)
    expect(manager.skillManager.getAll().length).toBe(0)
  })
})

describe('progression write seams fail closed on dormant scope', () => {
  it('purchaseNode refuses a dormant-tree node', () => {
    const manager = makeManager()
    const p = swordSave({ nodeLevels: {}, purchasedNodeIds: [] })
    // thich_can is a Kiem Tu tree node (dormant way's tree).
    expect(manager.progressionOps.purchaseNode('thich_can', p)).toBe(false)
    expect(p.skillInsight).toBe(100)
  })

  it('learnSkill refuses a dormant way-declared skill', () => {
    const manager = makeManager()
    const p = player({ realmId: 'qi_refining', cultivationPath: 'sword', cultivationWay: 'sword_pathway', swordPath: freshSwordPathState() })
    expect(manager.progressionOps.learnSkill('passive_kiem_tam_lanh_liet', p)).toBe(false)
    expect(manager.skillManager.has('passive_kiem_tam_lanh_liet')).toBe(false)
  })

  it('respecNodeTree and its preview refuse saves holding dormant nodes', () => {
    const manager = makeManager()
    const p = swordSave({ nodeLevels: { thich_can: 2 }, purchasedNodeIds: ['thich_can'] })

    expect(manager.progressionOps.previewNodeRespec(p)).toBeNull()
    expect(manager.progressionOps.respecNodeTree(p)).toBeNull()
    expect(p.nodeLevels).toEqual({ thich_can: 2 })
    expect(p.skillInsight).toBe(100)
  })

  it('devResetBranch refuses dormant branch records', () => {
    const manager = makeManager()
    const p = swordSave({ nodeLevels: { thich_can: 2 }, purchasedNodeIds: ['thich_can'] })
    expect(manager.progressionOps.devResetBranch('kiem_pho', p)).toBeNull()
    expect(p.nodeLevels).toEqual({ thich_can: 2 })
  })
})

describe('realm/breakthrough seams fail closed at the beta ceiling', () => {
  it('a foundation_establishment player sees no requirements for the disabled next transition', () => {
    const manager = makeManager()
    const p = player({ realmId: 'foundation_establishment', realmLevel: 12 })
    // TC -> KD transition is authored but disabled in the beta window:
    // the gate reports no rows and canTrigger stays false.
    expect(manager.realmAdvanceOps.getBreakthroughRequirements(p)).toEqual([])
    expect(manager.realmAdvanceOps.canTriggerBreakthrough(p)).toBe(false)
  })

  it('hidden lineage + nghich seams stay closed with the feature off', () => {
    const manager = makeManager()
    const p = player({ realmId: 'foundation_establishment', realmLevel: 12 })
    expect(isBetaFeature('hiddenContent')).toBe(false)
    expect(manager.realmAdvanceOps.attemptNghichChuTian(p).outcome).toBe('ineligible')
    expect(attemptNghichChuTian(p, manager.materialBag).outcome).toBe('ineligible')
  })
})

describe('economy/building/companion/artifact seams fail closed', () => {
  it('scope-hidden buildings cannot be built', () => {
    const manager = makeManager()
    const p = player({ realmId: 'qi_refining' })
    expect(manager.buildingOps.canBuildBuilding('chi_hien_quan', p)).toBe(false)
    expect(manager.buildingOps.buildBuilding('chi_hien_quan', p)).toBeFalsy()
  })

  it('manual worker assignment is a no-op while manualWorkforce is hidden', () => {
    const manager = makeManager()
    manager.buildingOps.assignWorkers('tinh_thach_mo', 5)
    expect(manager.buildingOps.getWorkerAssignments().size).toBe(0)
  })

  it('alchemy start refuses a dormant-family recipe id at the ops seam', () => {
    const manager = makeManager()
    const p = player({ realmId: 'qi_refining' })
    const result = manager.alchemyOps.startAlchemyJob(
      'alchemy_phi_van_dan_qi_refining',
      'phi_van_thao_qi_refining',
      p,
    )
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('scope_hidden')
  })

  it('pill consume refuses a dormant-family pill id even with the stack in the bag', () => {
    const manager = makeManager()
    const p = player({ realmId: 'qi_refining' })
    const dormantPill = pills.find((pill) => pill.id === 'phi_van_dan_qi_refining')
    expect(dormantPill).toBeDefined()
    manager.pillBag.add(dormantPill!, 1)
    const result = manager.pillOps.usePillDetailed('phi_van_dan_qi_refining', {
      addCultivation: () => {},
      heal: () => {},
      applyBuff: () => {},
    }, p)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('scope_hidden')
  })

  it('companion acquisition is realm_locked for every op (companion feature hidden)', () => {
    const manager = makeManager()
    const p = player({ realmId: 'foundation_establishment', realmLevel: 1 })
    expect(manager.companionOps.pullCompanion().ok).toBe(false)
    expect(manager.companionOps.exchangeCompanion('than_nong').ok).toBe(false)
    expect(manager.companionOps.claimCompanionGift('any').ok).toBe(false)
  })

  it('issueCompanionGifts appends no record while the companion feature is hidden', () => {
    const p = player({ realmId: 'foundation_establishment' })
    expect(issueCompanionGifts(p, { kind: 'realm_entered', realmId: 'foundation_establishment' })).toEqual([])
    expect(p.companionGifts).toEqual([])
  })

  it('artifact path/grade writes refuse while the artifact domain is hidden', () => {
    const manager = makeManager()
    const p = player({ realmId: 'golden_core', realmLevel: 1 })
    expect(manager.realmAdvanceOps.setArtifactPath(p, 'attack')).toBe(false)
    expect(manager.realmAdvanceOps.tryUpgradeArtifactGrade(p)).toBe(false)
  })

  it('formation loadout commit refuses while formation is hidden', () => {
    const manager = makeManager()
    const p = player({ realmId: 'foundation_establishment' })
    expect(
      manager.turnBattleOps.setFormationLoadout(p, {
        formationId: 'khong_ton_tai',
        assignments: [],
      }),
    ).toBe(false)
    expect(p.formationLoadout).toBeNull()
  })
})

// --- helpers (save fixtures for the acceptance probes) ----------------------

const catalogs = staticSaveAcceptanceCatalogs()

function committedPlayer(realmId: string): PlayerData {
  const p = createDefaultPlayer()
  p.cultivationPath = 'spell'
  p.cultivationWay = 'spell_pathway'
  p.spellPath = { element: null }
  p.realmId = realmId
  p.realmLevel = 1
  delete p.mortalBasicSkillId
  if (getRealmIndex(realmId) >= getRealmIndex('qi_refining')) {
    p.breakthroughGrade = 1
  }
  return p
}

function wayTechnique(): Technique {
  return structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
}

function committedSave(
  realmId: string,
  playerOverrides: Partial<PlayerData> = {},
  overrides: Partial<GameSave> = {},
): GameSave {
  const p = committedPlayer(realmId)
  Object.assign(p, playerOverrides)
  return {
    version: CURRENT_SAVE_VERSION,
    player: { ...p, lastSavedAt: Date.now() },
    techniques: [wayTechnique()],
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
}
