// QA FIXPOINT probe (blind adversarial audit, commit a7d12edf) -
// CONSUMER-side attacks on the beta scope contract that the sibling
// qa.test.ts files do not already pin. Every probe carries a dormant
// record past a restore/persist boundary into the consumer that would
// mint effects from it:
//
//   * combat build resolution on a way_out_of_scope save, incl. the
//     formation-loadout, aura, clone-buff, companion and
//     survive.extraSources channels;
//   * survive-lethal charges minted from carried talent ids;
//   * persisted realm-sourced modifier claims and the main-stat cap;
//   * dormant talent effects (pham_cot / pham_nhan_chi_cot);
//   * hidden-beast spawn substitution + kill-counter writes;
//   * carried Quan The diverter and Nghich Chu Tian mechanics minting
//     cultivation banking / level writes downstream of eligibility;
//   * alchemy dormant-family job settle (park, never deliver);
//   * decompose carried started cycle (tick + offline settle inert);
//   * vendor reads (sell/preview/rows) on dormant materials incl. the
//     hidden-beast and zhou-tian currencies;
//   * quest claim on a carried scope-hidden daily quest;
//   * building write seam on chi_hien_quan (the manualWorkforce domain);
//   * chooseCultivationPath on a dormant way;
//   * dormant-way technique mastery accrual;
//   * learned dormant passive skills emitting modifiers;
//   * tri-state verdict honesty on betaCombatRolesFor;
//   * betaHiddenRealmRecordFor on a carried discovered record;
//   * unsupportedReleaseReason flags carried hidden state (the save
//     still loads - flag, not block).
//
// Assertions marked DEFECT fail on the audited state - each failure is
// the deterministic repro for a reported finding.
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, resolvePlayerStatAssembly, type PlayerData } from '@/core/player/Player'
import { GameManager } from '@/core/game/GameManager'
import { unsupportedReleaseReason, betaHiddenRealmRecordFor } from '@/core/betaScopeSurface'
import { betaCombatRolesFor } from '@/core/betaScopeSkillDomain'
import { lockBetaFeaturesForTests, unlockAllFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import { resolveCombatBuild, type CombatBuildDeps } from '@/core/game/CombatBuild'
import { resolveCultivationPathRuntime } from '@/core/player/CultivationPathRegistry'
import type { CultivationPathRuntimeDeps } from '@/core/player/CultivationPathRuntime'
import { resolvePathCapabilities } from '@/core/player/CultivationPathSystem'
import { SkillManager } from '@/core/skill/SkillManager'
import { SkillSystem } from '@/core/skill/SkillSystem'
import { TemplateRegistry } from '@/core/game/TemplateRegistry'
import { NodeRegistry } from '@/core/progression/NodeRegistry'
import { SKILLS } from '@/data/skill/Skills'
import type { Skill } from '@/core/skill/Skill'
import { GENERIC_PHYSICAL_BASIC } from '@/data/skill/TurnBasicAttacks'
import { DEFAULT_PARTY_FORMATION } from '@/core/game/PartyFormation'
import { VAN_PHAP_THAN_HOA_ID } from '@/data/buff/ReactionStatusBuffs'
import { freshSwordPathState } from '@/core/kiem-tu/KiemTuState'
import { SurviveLethalGuard } from '@/core/talent/SurviveLethalGuard'
import {
  collectTalentEffects,
  getTalentCombatPassiveSkillId,
} from '@/core/talent/TalentEffects'
import { getEffectiveMainStatCap, getMainStatCap } from '@/core/stats/StatCap'
import { grantRealmPassive } from '@/core/realm/RealmPassiveSystem'
import { REALM_PASSIVES } from '@/data/realm/RealmPassives'
import { HiddenBeastSystem } from '@/core/game/HiddenBeastSystem'
import { hiddenBeastChannels } from '@/data/drop/HiddenMaterialChannels'
import { HIDDEN_BEASTS } from '@/data/enemy/HiddenBeasts'
import { MaterialBag } from '@/core/material/MaterialBag'
import { MaterialRegistry } from '@/core/material/MaterialRegistry'
import { materials } from '@/data/materials/materials'
import { buildings } from '@/data/building/buildings'
import { STAGES } from '@/data/stage/Stages'
import { zones } from '@/data/stage/Zones'
import { ENEMIES } from '@/data/enemy/Enemies'
import { QUESTS } from '@/data/quest/quests'
import { attemptNghichChuTian } from '@/core/realm/hidden/NghichChuTian'
import { resolveFinalCultivationGain } from '@/core/cultivation/CultivationDiversion'
// Side-effect import: registers the Quan The diverter on the
// final-cultivation-gain seam exactly as production load does.
import '@/core/realm/hidden/QuanTheDiversion'
import { AlchemySystem, type ActiveAlchemyJob } from '@/core/alchemy/AlchemySystem'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { witnessedAlchemyJob } from './helpers/witnessFixtures'
import { PillBag } from '@/core/pill/PillBag'
import { pills } from '@/data/pill/pills'
import { DecomposeSystem } from '@/core/production/DecomposeSystem'
import { TechniqueManager } from '@/core/technique/TechniqueManager'
import { TechniqueSystem } from '@/core/technique/TechniqueSystem'
import { TECHNIQUES } from '@/data/technique/Techniques'
import type { HiddenPerfectionState } from '@/core/realm/hidden/HiddenPerfection'

// These suites assert the beta scope lock - pin the canonical
// all-false tables (the global test setup unlocks them).
lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

function realGameManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerBuildings(buildings)
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerStages(STAGES)
  gameManager.catalogOps.registerZones(zones)
  gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
  gameManager.catalogOps.registerQuests(QUESTS)
  return gameManager
}

function buildCombatDeps(): { deps: CombatBuildDeps; runtimeDeps: CultivationPathRuntimeDeps } {
  const skillManager = new SkillManager()
  const skillTemplates = new TemplateRegistry<Skill>()
  for (const skill of SKILLS) {
    skillTemplates.register(skill.id, skill)
  }
  const runtimeDeps: CultivationPathRuntimeDeps = {
    skillManager,
    skillSystem: new SkillSystem(skillManager),
    skillTemplates,
    nodeRegistry: new NodeRegistry(),
    getNodeLevel: () => 0,
    getSpellPathElement: () => undefined,
  }
  const deps: CombatBuildDeps = {
    getBattleBaseChannels: () => [],
    resolveCapabilities: (p) => resolvePathCapabilities(p, { hasSkill: () => false }),
    getSkillLevels: () => ({}),
    getProgressionNodes: () => [],
    getCompanionDefinition: () => undefined,
    getLiveBattleModifiers: () => [],
    getActivePlayer: () => undefined,
  }
  return { deps, runtimeDeps }
}

describe('combat build resolution on a carried way_out_of_scope save', () => {
  it('emits nothing from any dormant channel', () => {
    const { deps, runtimeDeps } = buildCombatDeps()
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
      swordPath: freshSwordPathState(),
      // A carried formation loadout + a survive-lethal talent claim ride
      // the same save - none of it may reach the build.
      formationLoadout: { formationId: 'tran_ngu_hanh', slots: [] } as never,
      selectedTalentIds: ['tran_tam', 'pham_nhan_chi_cot'],
    })

    const build = resolveCombatBuild(p, resolveCultivationPathRuntime(p, runtimeDeps), deps)

    expect(build.kit.basic).toBe(GENERIC_PHYSICAL_BASIC)
    expect(build.kit.special).toBeUndefined()
    expect(build.kit.ultimate).toBeUndefined()
    expect(build.formation).toEqual(DEFAULT_PARTY_FORMATION)
    expect(build.companions).toEqual([])
    // No formation buff, no spell aura, no clone-granted buff: every
    // emitted entry buff must fail to materialize on this save.
    expect(build.entryBuffs.map((entry) => entry.definitionId)).not.toContain(VAN_PHAP_THAN_HOA_ID)
    expect(build.survive.extraSources).toBeUndefined()
    // Raw ids pass through but re-gate at the effect reader (next probe).
    expect(build.survive.talentIds).toEqual(['tran_tam', 'pham_nhan_chi_cot'])
  })
})

describe('survive-lethal charges minted from carried talent ids', () => {
  it('a forged non-beta talent list mints zero lethal-survival uses', () => {
    const guard = new SurviveLethalGuard()
    guard.beginBattle(['pham_nhan_chi_cot', 'tran_tam', 'phu_van'], {})
    expect(guard.getRemainingUses()).toBe(0)
    expect(guard.tryConsumeUse()).toBe(false)
  })

  it('control: a held beta survive-lethal talent still mints its charge', () => {
    const guard = new SurviveLethalGuard()
    guard.beginBattle(['bat_tu_the'], { bat_tu_the: 1 })
    expect(guard.getRemainingUses()).toBe(1)
  })
})

describe('persisted stat modifiers + main-stat cap', () => {
  it('a forged realm-sourced modifier claim drops from assembly', () => {
    const p = player({ realmId: 'qi_refining' })
    p.modifiers = [
      // Forged claim: a realm-sourced entry no authored builder emitted
      // - rebuild-don't-trust must drop it.
      {
        id: 'forged_hidden_realm_claim',
        sourceId: 'forged_hidden_realm_claim',
        sourceType: 'realm',
        stat: 'might',
        flat: 99999,
      } as never,
    ]

    const { stats } = resolvePlayerStatAssembly(p, [])
    const clean = resolvePlayerStatAssembly(player({ realmId: 'qi_refining' }), [])
    expect(stats.might).toBe(clean.stats.might)
  })

  it('control: an authored realm passive still emits through rebuild', () => {
    const p = player({ realmId: 'qi_refining' })
    grantRealmPassive(p, REALM_PASSIVES[0]!.id)
    const before = resolvePlayerStatAssembly(p, []).stats

    // Rebuild discards persisted claims and re-derives from the marker.
    p.modifiers = []
    const after = resolvePlayerStatAssembly(p, []).stats
    expect(after.might).toBe(before.might)
  })

  it('carried completedHiddenBodyRealmIds never raise the stat cap', () => {
    const p = player({
      realmId: 'foundation_establishment',
      hiddenPerfection: {
        lineageActive: true,
        lineageClosedByRealmId: {},
        completedHiddenBodyRealmIds: ['qi_refining', 'foundation_establishment'],
        hiddenBreakthroughRealmIds: [],
        realms: {},
      } as unknown as HiddenPerfectionState,
    })
    expect(getEffectiveMainStatCap(p)).toBe(getMainStatCap('foundation_establishment'))
  })
})

describe('dormant talent effects', () => {
  it('a forged non-beta talent emits no effects', () => {
    // pham_nhan_chi_cot (+75% cultivation speed) and tran_tam are
    // outside the beta talent roster - carried ids must mint nothing.
    expect(collectTalentEffects(['pham_nhan_chi_cot', 'tran_tam'], {})).toEqual([])
    expect(getTalentCombatPassiveSkillId(['pham_nhan_chi_cot'], {})).toBeUndefined()
  })

  it('control: a beta talent still emits', () => {
    expect(collectTalentEffects(['bat_tu_the'], {}).length).toBeGreaterThan(0)
  })
})

describe('hidden-beast consumer seams', () => {
  const beastChannel = hiddenBeastChannels()[0]!

  const beastSystem = () =>
    new HiddenBeastSystem({
      getEnemyTemplate: (id) => HIDDEN_BEASTS.find((beast) => beast.id === id),
      channels: [beastChannel],
    })

  it('a carried window-open counter never substitutes the spawn', () => {
    const p = player({
      realmId: 'qi_refining',
      hiddenBeastKills: { [beastChannel.id]: beastChannel.killThreshold + 500 },
    })
    // rng() => 0 wins every chance roll too - still no substitution.
    expect(beastSystem().maybeReplaceSpawn(p, beastChannel.bandRealmId, () => 0)).toBeUndefined()
  })

  it('kills on a banded enemy never write the counter', () => {
    const p = player({ hiddenBeastKills: { [beastChannel.id]: beastChannel.killThreshold - 1 } })
    const opened = beastSystem().onEnemyDefeated(p, 'any_banded_enemy', beastChannel.bandRealmId)
    expect(opened).toEqual([])
    expect(p.hiddenBeastKills[beastChannel.id]).toBe(beastChannel.killThreshold - 1)
  })
})

describe('carried hidden mechanics mint nothing downstream', () => {
  it('a carried active Quan The record never diverts cultivation', () => {
    const p = player({
      realmId: 'qi_refining',
      cultivation: 0,
      bodyProgression: { meridian: { openedIds: ['nham_mach', 'doc_mach'] } } as never,
      hiddenPerfection: {
        lineageActive: true,
        lineageClosedByRealmId: {},
        completedHiddenBodyRealmIds: [],
        hiddenBreakthroughRealmIds: [],
        realms: {
          qi_refining: {
            discovered: true,
            frozen: false,
            mechanic: { kind: 'quan_the', active: true, progress: 10, required: 50_000 },
          },
        },
      } as unknown as HiddenPerfectionState,
    })

    const landed = resolveFinalCultivationGain(p, 1_000)
    expect(landed).toBe(1_000)
    // The banked share stayed data - the diverter never touched it.
    expect(
      (p.hiddenPerfection!.realms.qi_refining!.mechanic as unknown as { progress: number })
        .progress,
    ).toBe(10)
  })

  it('a carried active Nghich Chu Tian record attempts ineligible with no debit', () => {
    const registry = new MaterialRegistry()
    for (const material of materials) registry.register(material)
    const bag = new MaterialBag()
    bag.add(registry.get('tinh_hoa_phap_the'), 99_999)
    bag.add(registry.get('spirit_stone_ha_pham'), 99_999)
    // Bag.add clamps at the authored stack cap - compare pre/post, not
    // the requested amount.
    const essenceBefore = bag.getAmount('tinh_hoa_phap_the')
    const stoneBefore = bag.getAmount('spirit_stone_ha_pham')

    const p = player({
      realmId: 'foundation_establishment',
      hiddenPerfection: {
        lineageActive: true,
        lineageClosedByRealmId: {},
        completedHiddenBodyRealmIds: ['qi_refining'],
        hiddenBreakthroughRealmIds: [],
        realms: {
          foundation_establishment: {
            discovered: true,
            frozen: false,
            mechanic: {
              kind: 'nghich_chu_tian',
              completed: 5,
              pityByLevel: [0, 0, 0, 0, 0],
              active: true,
            },
          },
        },
      } as unknown as HiddenPerfectionState,
    })

    const result = attemptNghichChuTian(p, bag)
    expect(result.outcome).toBe('ineligible')
    expect(result.level).toBe(5)
    expect(bag.getAmount('tinh_hoa_phap_the')).toBe(essenceBefore)
    expect(bag.getAmount('spirit_stone_ha_pham')).toBe(stoneBefore)
    expect(
      (p.hiddenPerfection!.realms.foundation_establishment!.mechanic as unknown as {
        completed: number
      }).completed,
    ).toBe(5)
  })
})

describe('dormant production settle seams', () => {
  const dormantJob = (jobId: string): ActiveAlchemyJob => {
    const job = {
      jobId,
      recipeId: 'alchemy_phi_van_dan_qi_refining',
      pillId: 'phi_van_dan_qi_refining',
      herbMaterialId: 'herb_decade',
      startedAtMs: 0,
      completesAtMs: 60_000,
      roomLevelAtStart: 1,
    }
    return witnessedAlchemyJob(
      job,
      undefined,
      alchemyRecipes.find((r) => r.id === job.recipeId),
    ) as ActiveAlchemyJob
  }

  it('a carried dormant alchemy job parks at settle - no pill, no event', () => {
    const system = new AlchemySystem()
    system.setRecipeLookup((id) =>
      id === 'alchemy_phi_van_dan_qi_refining'
        ? ({ id, pillId: 'phi_van_dan_qi_refining' } as never)
        : undefined,
    )
    const pillBag = new PillBag()
    system.restoreJobs([dormantJob('job_dormant')])

    system.tick(120_000, pillBag, (pillId) => pills.find((pill) => pill.id === pillId), () => 0)

    expect(system.getJobs().map((job) => job.jobId)).toEqual(['job_dormant'])
    expect(system.drainSettlementEvents()).toEqual([])
  })

  it('a carried started decompose cycle never runs (tick + offline settle)', () => {
    const registry = new MaterialRegistry()
    for (const material of materials) registry.register(material)
    const bag = new MaterialBag()
    bag.add(registry.get('mortal_ore_decade'), 100)

    const system = new DecomposeSystem(bag, { cycleSeconds: 60 })
    system.restore({
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 3 },
      nextCycleAt: 0,
      started: true,
    })

    system.tick(9_999_999)
    expect(system.drainOutput()).toEqual([])
    expect(system.settleOffline(9_999_999, 0)).toBe(0)
    expect(system.drainOutput()).toEqual([])
    // No cycle ran: the carried ore is never consumed.
    expect(bag.getAmount('mortal_ore_decade')).toBe(100)
  })
})

describe('vendor consumer reads on dormant materials', () => {
  it.each([
    'tinh_hoa_pham_the',
    'tinh_hoa_phap_the',
    'doan_bao_thach',
    'chieu_hien_lenh',
    'yeu_dan_hung_giao',
  ])('sell/preview/rows reject %s', (materialId) => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'foundation_establishment' })

    const sale = gameManager.economyOps.sellMaterialToVendor(materialId, 1, p)
    expect(sale.ok).toBe(false)

    const preview = gameManager.economyOps.previewVendorSale(materialId, 1, p)
    expect(preview).toBeNull()

    const rows = gameManager.economyOps.getVendorSellableRows(p)
    expect(rows.map((row) => row.materialId)).not.toContain(materialId)
  })
})

describe('quest claim on a carried scope-hidden quest', () => {
  it('reconcile deactivates carried daily progress and claim fails closed', () => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'foundation_establishment' })
    gameManager.setActivePlayer(p)

    gameManager.questManager.restore({
      active: [{ questId: 'daily_chieu_hien_lenh', progress: 5, claimed: false }],
      completedOnceIds: [],
      lastDailyResetAtMs: 0,
    })

    gameManager.tickOps.reconcileQuestLifecycle()
    expect(
      gameManager.questOps.getActiveQuests().map((entry) => entry.quest.id),
    ).not.toContain('daily_chieu_hien_lenh')
    expect(gameManager.questOps.claimQuest('daily_chieu_hien_lenh')).toBe(false)
  })
})

describe('write seams on dormant domains', () => {
  it('chi_hien_quan build fails closed at the ops gate', () => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'foundation_establishment' })
    expect(gameManager.buildingOps.canBuildBuilding('chi_hien_quan', p)).toBe(false)
    expect(gameManager.buildingOps.buildBuilding('chi_hien_quan', p)).toBeNull()
  })

  it('chooseCultivationPath rejects a dormant way', () => {
    const gameManager = realGameManager()
    const p = player({ realmId: 'mortal', realmLevel: 10 })
    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', p),
    ).toBe(false)
    expect(p.cultivationPath).toBeUndefined()
  })

  it('a carried dormant technique accrues no mastery', () => {
    const manager = new TechniqueManager()
    const technique = TECHNIQUES.find((entry) => entry.id === 'kiem_tu_tam_phap')
    if (!technique) return
    manager.restore([{ ...structuredClone(technique), rank: 1, mastery: 0 }])
    const system = new TechniqueSystem(manager)
    const result = system.gainMastery(500, 'qi_refining', 5)
    expect(result).toEqual({ gained: 0, rankUps: 0 })
  })

  it('a learned dormant passive skill emits no modifiers', () => {
    const skillManager = new SkillManager()
    const skillSystem = new SkillSystem(skillManager)
    const dormantPassive = SKILLS.find((skill) => skill.id === 'passive_kiem_tam_lanh_liet')
    expect(dormantPassive).toBeTruthy()
    skillSystem.learn(structuredClone(dormantPassive!))
    expect(skillSystem.getScaledPassiveModifiers()).toEqual([])
  })
})

describe('tri-state verdict honesty', () => {
  const deps = { hasSkill: () => false }

  it('mortal save: basic available, special progression-locked, ultimate scope-hidden', () => {
    const entries = betaCombatRolesFor(player(), deps)
    const byRole = Object.fromEntries(entries.map((entry) => [entry.role, entry]))
    expect(byRole.basic?.state).toBe('available')
    expect(byRole.special?.state).toBe('progression-locked')
    expect(byRole.ultimate?.state).toBe('scope-hidden')
    // Exactly one verdict per role - no half-rendered slot.
    expect(entries.every((entry) =>
      ['available', 'progression-locked', 'scope-hidden'].includes(entry.state),
    )).toBe(true)
  })

  it('dormant-way save: every role reports scope-hidden, never a half-render', () => {
    const p = player({
      realmId: 'qi_refining',
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
      swordPath: freshSwordPathState(),
    })
    const entries = betaCombatRolesFor(p, deps)
    expect(entries.map((entry) => entry.state)).toEqual([
      'scope-hidden',
      'scope-hidden',
      'scope-hidden',
    ])
  })
})

describe('hidden record read models on a carried save', () => {
  it('betaHiddenRealmRecordFor hides a carried discovered record', () => {
    const p = player({
      realmId: 'qi_refining',
      hiddenPerfection: {
        lineageActive: true,
        lineageClosedByRealmId: {},
        completedHiddenBodyRealmIds: [],
        hiddenBreakthroughRealmIds: [],
        realms: { qi_refining: { discovered: true, frozen: false, mechanic: { kind: 'quan_the', active: true, progress: 0, required: 50_000 } } },
      } as unknown as HiddenPerfectionState,
    })
    expect(betaHiddenRealmRecordFor(p, 'qi_refining')).toBeUndefined()
  })

  it('unsupportedReleaseReason flags carried hidden state; the save still loads', () => {
    const p = player({
      realmId: 'qi_refining',
      hiddenPerfection: {
        lineageActive: true,
        lineageClosedByRealmId: {},
        completedHiddenBodyRealmIds: ['qi_refining'],
        hiddenBreakthroughRealmIds: [],
        realms: {},
      } as unknown as HiddenPerfectionState,
    })
    expect(unsupportedReleaseReason(p)).toBe('hidden_progression_state')
  })
})

describe('fail-open coverage gaps verified inert at a7d12edf', () => {
  it('unlocking all features still cannot leak a dormant way into the build', () => {
    unlockAllFeaturesForTests()
    try {
      const { deps, runtimeDeps } = buildCombatDeps()
      const p = player({
        realmId: 'qi_refining',
        cultivationPath: 'sword',
        cultivationWay: 'sword_pathway',
        swordPath: freshSwordPathState(),
      })
      // Feature lock off, WAY lock still on: the way allow-list is the
      // kit authority - dormant kits stay dormant regardless.
      const build = resolveCombatBuild(p, resolveCultivationPathRuntime(p, runtimeDeps), deps)
      expect(build.kit.basic).toBe(GENERIC_PHYSICAL_BASIC)
    } finally {
      lockBetaFeaturesForTests()
    }
  })
})
