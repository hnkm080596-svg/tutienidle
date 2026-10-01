/**
 * QA FIXPOINT probe (run qa-fixpoint-master) - adversarial save-edge
 * attacks on the beta scope contract (frontend-contract.md sec.H):
 * hostile/legacy saves must "deserialize safely, flag explicitly" and
 * scope-hidden persisted state must stay DORMANT - never leak into
 * visible play (stat caps, realm passives, combat inputs).
 *
 * Beta flags are pinned by lockBetaFeaturesForTests() - the suite
 * asserts behavior under the canonical all-false table.
 */
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '@/core/player/Player'
import { unsupportedReleaseReason } from '@/core/betaScopeSurface'
import { getEffectiveMainStatCap, getMainStatCap } from '@/core/stats/StatCap'
import { grantRealmPassive } from '@/core/realm/RealmPassiveSystem'
import { REALM_PASSIVES } from '@/data/realm/RealmPassives'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { GameManager } from '@/core/game/GameManager'
import { pills } from '@/data/pill/pills'
import { scopeHiddenPillFamilyOfId } from '@/core/betaScope'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { resolveCombatBuild, type CombatBuildDeps } from '@/core/game/CombatBuild'
import { resolveCultivationPathRuntime } from '@/core/player/CultivationPathRegistry'
import type { CultivationPathRuntimeDeps } from '@/core/player/CultivationPathRuntime'
import { SkillManager } from '@/core/skill/SkillManager'
import { SkillSystem } from '@/core/skill/SkillSystem'
import { TemplateRegistry } from '@/core/game/TemplateRegistry'
import { NodeRegistry } from '@/core/progression/NodeRegistry'
import { SKILLS } from '@/data/skill/Skills'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { KIEM_TU_NODES } from '@/data/progression/KiemTuNodes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import type { Skill } from '@/core/skill/Skill'
import { freshSwordPathState, type OrbId } from '@/core/kiem-tu/KiemTuState'
import { createSpellPathState } from '@/core/phap-tu/PhapTuState'
import { hasStaticPathCapability, resolvePathCapabilities } from '@/core/player/CultivationPathSystem'
import { BattleLootSystem, type BattleLootSystemDeps } from '@/core/game/BattleLootSystem'
import { MaterialRegistry } from '@/core/material/MaterialRegistry'
import type { Material } from '@/core/material/Material'
import type { ResolvedDropItem } from '@/core/drop/resolveDrops'
import { GENERIC_PHYSICAL_BASIC } from '@/data/skill/TurnBasicAttacks'
import { VAN_PHAP_THAN_HOA_ID } from '@/data/buff/ReactionStatusBuffs'

lockBetaFeaturesForTests()
lockBetaWaysForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    ...createDefaultPlayer(),
    ...overrides,
  }
}

describe('save-safety: unsupportedReleaseReason robustness', () => {
  it('never throws on hostile hiddenPerfection shapes', () => {
    for (const hostile of [null, 5, 'x', [], { realms: null }]) {
      const p = player()
      ;(p as { hiddenPerfection?: unknown }).hiddenPerfection = hostile
      expect(() => unsupportedReleaseReason(p), `hiddenPerfection=${JSON.stringify(hostile)}`).not.toThrow()
    }
  })

  it('flags a save whose hiddenPerfection is a corrupted non-object as hidden state', () => {
    const p = player()
    ;(p as { hiddenPerfection?: unknown }).hiddenPerfection = { realms: 'not-an-object' }
    expect(unsupportedReleaseReason(p)).toBe('hidden_progression_state')
  })

  it('flags a save with null hiddenPerfection deterministically (no crash, closed reason or tolerated)', () => {
    const p = player()
    ;(p as { hiddenPerfection?: unknown }).hiddenPerfection = null
    // Contract: "deserialize safely, flag explicitly" - the read-model
    // must resolve to a value, never TypeError.
    const reason = unsupportedReleaseReason(p)
    expect(reason === null || typeof reason === 'string').toBe(true)
  })
})

describe('dormancy: hidden progression on a loaded save must not affect visible play', () => {
  it('completedHiddenBodyRealmIds does not raise the main-stat cap under beta scope', () => {
    const p = player({
      realmId: 'qi_refining',
      hiddenPerfection: {
        lineageActive: true,
        completedHiddenBodyRealmIds: ['mortal', 'qi_refining'],
        hiddenBreakthroughRealmIds: [],
        realms: {},
      },
    })
    // Under beta scope the hidden-content domain is dormant: a carried
    // record must not grant its +10pp/realm cap bonus into visible play.
    expect(getEffectiveMainStatCap(p)).toBe(getMainStatCap('qi_refining'))
  })

  it('hiddenBreakthroughRealmIds does not grant the enhanced realm-passive variant under beta scope', () => {
    const p = player({
      realmId: 'qi_refining',
      grantedRealmPassiveIds: [],
      modifiers: [],
      hiddenPerfection: {
        lineageActive: true,
        completedHiddenBodyRealmIds: [],
        hiddenBreakthroughRealmIds: ['qi_refining'],
        realms: {},
      },
    })
    grantRealmPassive(p, 'qi_refining')
    const definition = REALM_PASSIVES.find((d) => d.id === 'qi_refining')!
    const normal = definition.buildModifiers(p).map((m) => m.stat + ':' + m.percent)
    const granted = p.modifiers.map((m) => m.stat + ':' + m.percent)
    // The carried hidden record must not select the enhanced variant.
    expect(granted).toEqual(normal)
  })
})

describe('dormancy: dormant-family pills on a carried save stay inert (F-TRI-1)', () => {
  const noopTarget = { addCultivation: () => {}, heal: () => {}, applyBuff: () => {} }

  it('scopeHiddenPillFamilyOfId resolves authored dormant families only', () => {
    expect(scopeHiddenPillFamilyOfId('phi_van_dan_mortal')).toBe('phi_van_dan')
    expect(scopeHiddenPillFamilyOfId('to_cot_dan_mortal')).toBe('to_cot_dan')
    expect(scopeHiddenPillFamilyOfId('alchemy_duong_than_dan_qi_refining')).toBe('duong_than_dan')
    // Enabled families and unknown spellings are not a scope question.
    expect(scopeHiddenPillFamilyOfId('tu_linh_dan_mortal')).toBeNull()
    expect(scopeHiddenPillFamilyOfId('khai_linh_dan_mortal')).toBeNull()
    expect(scopeHiddenPillFamilyOfId('unknown_legacy_pill')).toBeNull()
  })

  it('usePillDetailed rejects a dormant-family pill without consuming it', () => {
    const gameManager = new GameManager()
    const p = player()
    gameManager.setActivePlayer(p)
    gameManager.catalogOps.registerPills(pills.filter((x) => x.id === 'phi_van_dan_mortal'))
    gameManager.pillBag.add(gameManager.pillRegistry.get('phi_van_dan_mortal'), 1)

    const dexBefore = p.baseStats.dexterity
    const result = gameManager.pillOps.usePillDetailed('phi_van_dan_mortal', noopTarget, p)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('scope_hidden')
    expect(gameManager.pillBag.getAmount('phi_van_dan_mortal')).toBe(1)
    expect(p.baseStats.dexterity).toBe(dexBefore)
  })

  it('an enabled beta pill still consumes through the same path', () => {
    const gameManager = new GameManager()
    const p = player()
    gameManager.setActivePlayer(p)
    gameManager.catalogOps.registerPills(pills.filter((x) => x.id === 'tu_linh_dan_mortal'))
    gameManager.pillBag.add(gameManager.pillRegistry.get('tu_linh_dan_mortal'), 1)

    const result = gameManager.pillOps.usePillDetailed('tu_linh_dan_mortal', noopTarget, p)

    expect(result.ok).toBe(true)
    expect(gameManager.pillBag.getAmount('tu_linh_dan_mortal')).toBe(0)
  })
})

describe('dormancy: a way_out_of_scope save must not execute its dormant kit (F-TRI-2)', () => {
  function buildDeps(): { deps: CombatBuildDeps; runtimeDeps: CultivationPathRuntimeDeps } {
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

  it('sword_pathway combat build falls back to the generic kit', () => {
    const { deps, runtimeDeps } = buildCombatDeps()
    const p = player({
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
      swordPath: freshSwordPathState(),
    })

    // The save is flagged unsupported through the canonical reader.
    expect(unsupportedReleaseReason(p)).toBe('way_out_of_scope')

    const runtime = resolveCultivationPathRuntime(p, runtimeDeps)
    const build = resolveCombatBuild(p, runtime, deps)

    // Dormant-way kit must not execute - same ACCESS seam class as the
    // companion/formation gating below it in resolveCombatBuild.
    expect(build.kit.basic).toBe(GENERIC_PHYSICAL_BASIC)
    expect(build.kit.special).toBeUndefined()
    expect(build.kit.ultimate).toBeUndefined()
    expect(build.kit.buildDynamicBasic).toBeUndefined()
    expect(build.kit.statDomains).toBeUndefined()
  })

  it('spell_pathway combat build still resolves its committed kit', () => {
    const { deps, runtimeDeps } = buildCombatDeps()
    const p = player({
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
      spellPath: createSpellPathState(),
    })

    const runtime = resolveCultivationPathRuntime(p, runtimeDeps)
    const build = resolveCombatBuild(p, runtime, deps)

    expect(build.kit.basic).toBeTruthy()
    expect(build.kit.basic).not.toBe(GENERIC_PHYSICAL_BASIC)
  })
})


describe('path authority: the ritual gate fails closed for dormant ways (I-PA-1)', () => {
  it('chooseCultivationPath rejects a non-beta way pair before any other check', () => {
    const gameManager = new GameManager()
    // Registered catalogs + realmLevel >= CORE_REALM_LEVEL so every
    // downstream preflight passes and the beta admission gate is the ONLY
    // possible rejector (same fixture shape as buildSnapshot.test.ts).
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const p = player({ realmLevel: 12 })

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', p)).toBe(false)
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('body', 'body_pathway', p)).toBe(false)
    // spell_pathway carries an element axis - it also fails closed here;
    // its only entry point is the atomic commitFiveElementInitiation.
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', p)).toBe(false)
  })
})

describe('dormancy: dormant way node trees refuse insight writes on a carried save (F-CA-1)', () => {
  function swordSave(levels: Record<string, number> = {}): PlayerData {
    return player({
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
      swordPath: freshSwordPathState(),
      skillInsight: 100,
      nodeLevels: levels,
      purchasedNodeIds: Object.keys(levels),
    })
  }

  it('canPurchaseNode / purchaseNode / upgradeNode all reject dormant-tree nodes', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const p = swordSave({ thich_can: 1 })
    const insightBefore = p.skillInsight

    // The tree is scope-hidden for every beta player: no buy, no level-up.
    expect(gameManager.progressionOps.canPurchaseNode('thich_can', p)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('thich_can', p)).toBe(false)
    expect(gameManager.progressionOps.upgradeNode('thich_can', p)).toBe(false)
    expect(p.skillInsight).toBe(insightBefore)
    expect(p.nodeLevels).toEqual({ thich_can: 1 })
  })

  it('respecNodeTree refuses a save holding dormant records - dormant insight is never refunded', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const p = swordSave({ thich_can: 2 })

    expect(gameManager.progressionOps.respecNodeTree(p)).toBeNull()
    expect(gameManager.progressionOps.previewNodeRespec(p).resetCount).toBe(0)
    // Dormant records stay intact - the lock freezes them, never monetizes them.
    expect(p.nodeLevels).toEqual({ thich_can: 2 })
    expect(p.skillInsight).toBe(100)
  })

  it('a beta save with only admitted nodes still buys and respecs normally', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    // mortal save holding an untagged (way-agnostic) core-style node level
    const mortal = player({ realmId: 'mortal', skillInsight: 50, nodeLevels: {}, purchasedNodeIds: [] })
    expect(gameManager.progressionOps.respecNodeTree(mortal)).not.toBeNull()
  })
})

describe('dormancy: role verdicts on a way_out_of_scope save are all scope-hidden (F-CA-2)', () => {
  it('betaCombatRolesFor emits no renderable role for dormant-way saves', () => {
    const gameManager = new GameManager()
    const p = player({
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
      swordPath: freshSwordPathState(),
    })
    const verdicts = gameManager.progressionOps.betaCombatRolesFor(p)
    expect(verdicts.every((v) => v.state === 'scope-hidden')).toBe(true)
    // Hidden variant fails identically closed.
    const hidden = player({
      cultivationPath: 'sword',
      cultivationWay: 'hidden_sword_pathway',
      swordPath: freshSwordPathState(),
    })
    expect(gameManager.progressionOps.betaCombatRolesFor(hidden).every((v) => v.state === 'scope-hidden')).toBe(true)
  })
})


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

describe('dormancy: hidden-way reaction aura never enters the entry-buff layer (F-A2-1)', () => {
  it('a committed hidden_spell save with its aura passive still emits no aura entryBuffs', () => {
    const { deps, runtimeDeps } = buildCombatDeps()
    deps.resolveCapabilities = (p) =>
      resolvePathCapabilities(p, { hasSkill: (id) => id === 'ngo_dao_hon_don' })
    const p = player({
      realmId: 'foundation_establishment',
      cultivationPath: 'spell',
      cultivationWay: 'hidden_spell_pathway',
      mortalBasicSkillId: undefined,
    })

    const build = resolveCombatBuild(p, resolveCultivationPathRuntime(p, runtimeDeps), deps)

    expect(build.entryBuffs.some((b) => b.definitionId === VAN_PHAP_THAN_HOA_ID)).toBe(false)
  })

})

describe('dormancy: dormant-kit skill cores reject insight spends and learns (F-A2-2 / F-A2-3)', () => {
  it('canUpgradeNode and levelUpSkill reject a dormant way core on a carried save', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const p = player({
      cultivationPath: 'body',
      cultivationWay: 'hidden_body_pathway',
      skillInsight: 100,
      nodeLevels: { core_tham_the: 1 },
      purchasedNodeIds: ['core_tham_the'],
    })

    expect(gameManager.progressionOps.canUpgradeNode('core_tham_the', p)).toBe(false)
    expect(gameManager.progressionOps.levelUpSkill('tham_the', p)).toBe(false)
    // Dormant core holding fails respec closed the same as a dormant tree node.
    expect(gameManager.progressionOps.respecNodeTree(p)).toBeNull()
    expect(p.nodeLevels).toEqual({ core_tham_the: 1 })
  })

  it('learnSkill rejects hidden-kit skill ids even on a clean beta save', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const p = player()

    for (const id of ['van_phap_tuy_tam', 'da_phap_lien_tuyen', 'ngo_dao_hon_don', 'ngu_kiem_thuat', 'tham_the']) {
      expect(gameManager.progressionOps.learnSkill(id, player()), `learn ${id}`).toBe(false)
    }
  })

  it('mortal precursors and beta spell-kit skills stay learnable/levelable (positive controls)', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    expect(gameManager.progressionOps.learnSkill('huy_quyen', player())).toBe(true)
    // hoa_cau_thuat: beta element-kit skill, generated core, no cast
    // threshold - the insight level channel stays open on a beta save.
    const spellSave = player({
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
      spellPath: createSpellPathState(),
      skillInsight: 500,
      nodeLevels: { core_hoa_cau_thuat: 1 },
      purchasedNodeIds: ['core_hoa_cau_thuat'],
    })
    expect(gameManager.progressionOps.levelUpSkill('hoa_cau_thuat', spellSave)).toBe(true)
  })
})


describe('dormancy: a carried sword save cannot drive sword machinery (F-B-2)', () => {
  it('setKiemPhoPreset fails closed under beta scope and leaves the preset untouched', () => {
    const gameManager = new GameManager()
    const p = player({
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
      swordPath: freshSwordPathState(),
      // qi_refining: orb_dam is realm-unlocked so validatePreset alone
      // would admit the write - the scope seam is the only rejector.
      realmId: 'qi_refining',
      realmLevel: 12,
    })

    expect(unsupportedReleaseReason(p)).toBe('way_out_of_scope')
    // The capability gate alone would admit (the save carries
    // sword.sword_scroll) - the scope seam is the only rejector.
    expect(hasStaticPathCapability(p, 'sword.sword_scroll')).toBe(true)

    expect(gameManager.progressionOps.setKiemPhoPreset(p, ['orb_dam', 'orb_dam'] as OrbId[])).toBe(
      false,
    )
    expect(p.swordPath!.preset).toEqual(['orb_dam'])
  })
})


describe('beta-live progression: physique essences fund the realm body chapters (F-B-1)', () => {
  const ESSENCE: Material = {
    id: 'tinh_hoa_pham_the',
    name: 'Tinh Hoa Pham The',
    category: 'essence',
    sourceType: 'monster',
    description: 'chapter essence',
  }

  function buildLoot() {
    const materialRegistry = new MaterialRegistry()
    materialRegistry.register(ESSENCE)
    const bag: Array<{ id: string; amount: number }> = []
    const gained: Array<{ id: string; amount: number }> = []
    const deps = {
      eventBus: { emit: () => {} },
      notifications: { push: () => {} },
      stageManager: { getActive: () => undefined },
      zoneRegistry: { getZoneForStage: () => undefined },
      materialRegistry,
      materialBag: {
        add: (material: Material, amount: number) => {
          bag.push({ id: material.id, amount })
          return 0
        },
      },
      notifyMaterialGained: (id: string, amount: number) => {
        gained.push({ id, amount })
      },
    } as unknown as BattleLootSystemDeps

    return { loot: new BattleLootSystem(deps), bag, gained }
  }

  function grant(loot: BattleLootSystem, items: ResolvedDropItem[]) {
    ;(
      loot as unknown as {
        grantResolvedDrops: (i: ResolvedDropItem[], steps: number, sourceId: string) => void
      }
    ).grantResolvedDrops(items, 0, 'probe')
  }

  it('physique essence drops deliver under beta scope (chapter faucet stays open)', () => {
    const { loot, bag, gained } = buildLoot()

    grant(loot, [{ kind: 'material', itemId: 'tinh_hoa_pham_the', amount: 3 }])

    expect(bag).toEqual([{ id: 'tinh_hoa_pham_the', amount: 3 }])
    expect(gained).toEqual([{ id: 'tinh_hoa_pham_the', amount: 3 }])
  })
})
