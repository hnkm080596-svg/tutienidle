/**
 * QA FIXPOINT probe (run qa-fixpoint-master) - reviewer A18, scope
 * AUTHORITY seam: can a FORGED or out-of-envelope persisted value mint
 * effects/items/authority at restore that no writer can produce?
 *
 * Attack matrix over saveShapeValidation + authority write seams:
 *   - bag forges (above-realm material, dormant-domain pill)
 *   - claim forges (dormant skill, dormant way pair, dormant kiem node,
 *     parked/above-realm talent, dormant timed effect, forged casts)
 *   - write-seam forges (vendor sale of unearned material, dormant
 *     pill use, way grant replay on dormant way)
 *
 * Beta flags are pinned by the lock fixtures - behavior asserted under
 * the canonical all-false table.
 */
import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { lockBetaWaysForTests } from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaFeaturesForTests } from '../../src/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaTalentsForTests } from '../../src/core/game/__fixtures__/betaTalentsUnlock'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

import { GameManager } from '../../src/core/game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../../src/core/player/Player'
import { equipment } from '../../src/data/equipment/equipment'
import { affixes } from '../../src/data/equipment/affixes'
import { materials } from '../../src/data/materials/materials'
import { pills } from '../../src/data/pill/pills'
import { buildings } from '../../src/data/building/buildings'
import { SKILLS } from '../../src/data/skill/Skills'
import { TECHNIQUES } from '../../src/data/technique/Techniques'
import { alchemyRecipes } from '../../src/data/alchemy/alchemyRecipes'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { restoreGameSession, type GameSave } from '../../src/services/save/SaveSystem'
import { usePlayerStore } from '../../src/stores/player'
import { getPrecursorFlatDamageBonus } from '../../src/core/skill/SkillSystem'
import { isRealmTransitionEnabled } from '../../src/core/realm/ReleasePolicy'
import { freshSwordPathState } from '../../src/core/kiem-tu/KiemTuState'
import { unsupportedReleaseReason } from '../../src/core/betaScopeSurface'
import type { PillTarget } from '../../src/core/pill/PillSystem'

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return { ...createDefaultPlayer(), ...overrides }
}

function validSave(playerOverrides: Partial<PlayerData> = {}, overrides: Partial<GameSave> = {}) {
  const p = player(playerOverrides)
  p.mortalBasicSkillId = 'linh_bao'
  p.nodeLevels = { ...p.nodeLevels, core_linh_bao: 1 }
  p.purchasedNodeIds = [...p.purchasedNodeIds, 'core_linh_bao']

  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: { ...p, lastSavedAt: Date.now() },
    techniques: [],
    skills: [
      {
        id: 'linh_bao',
        name: 'Linh Bao',
        description: 'creation pick',
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
    quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    productionSites: [],
    alchemyJobs: [],
    decompose: {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      started: false,
      nextCycleAt: 0,
    },
    ...overrides,
  }
  return { save, player: p }
}

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
  return manager
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

function noopTarget(): PillTarget {
  return { addCultivation: () => {}, heal: () => {}, applyBuff: () => {} } as PillTarget
}

describe('A18-1 bag forge: above-realm material cannot restore nor mint vendor value', () => {
  // mortal (tier 1) player cannot produce a golden_core (tier 4) wood -
  // the claim is out of envelope. F-MAT-REALM closes this at the
  // boundary: a profession.realmId tier more than one above the claimed
  // realm tier is rejected outright (the +1 lead is what authored
  // no-gate collect quests tolerate). The vendor's grade-below gate
  // stays as the second layer for admitted one-tier-up holdings.
  it('mortal save carrying golden_core wood is rejected at the shape boundary', () => {
    const { save } = validSave()
    save.materials = [{ materialId: 'golden_core_wood_thuong_co', amount: 5 }]

    const { result, shape } = boot(save)
    expect(shape.ok).toBe(false)
    expect(result.status).toBe('rejected')
  })

  // The admitted edge: a mortal bag of qi_refining wood (tier +1)
  // restores - and the vendor's grade gate still refuses to mint value.
  it('mortal save carrying qi_refining wood restores but vendor refuses the sale', () => {
    const { save } = validSave()
    save.materials = [{ materialId: 'qi_refining_wood_decade', amount: 5 }]

    const { manager, playerStore, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(manager.materialBag.getAmount('qi_refining_wood_decade')).toBe(5)

    const sale = manager.economyOps.sellMaterialToVendor(
      'qi_refining_wood_decade',
      5,
      playerStore.$state as PlayerData,
    )
    expect(sale.ok).toBe(false)
    // No spirit stone mint: the bag keeps every forged unit.
    expect(manager.materialBag.getAmount('qi_refining_wood_decade')).toBe(5)
  })

  // Sibling check: non-profession ids also fail the grade gate closed
  // (isGradeBelowPlayer returns false without profession meta).
  it('essence with no profession meta sells nothing either', () => {
    const { save } = validSave()
    save.materials = [{ materialId: 'tinh_hoa_pham_the', amount: 9 }]

    const { manager, playerStore } = boot(save)
    const sale = manager.economyOps.sellMaterialToVendor(
      'tinh_hoa_pham_the',
      9,
      playerStore.$state as PlayerData,
    )
    expect(sale.ok).toBe(false)
  })
})

describe('A18-2 claim forge: dormant-scope skill id cannot mint a learned skill', () => {
  // ngu_kiem_thuat is owned by the hidden sword way - dormant. A forged
  // membership entry must not mint it: the validator prunes or rejects
  // before the SkillManager learns it.
  it('forged dormant-way skill id does not enter the live skill set', () => {
    const { save } = validSave()
    save.skills = [
      ...save.skills,
      {
        id: 'ngu_kiem_thuat',
        name: 'Ngu Kiem Thuat',
        description: 'forged',
        type: 'active',
        level: 1,
        maxLevel: 10,
        cooldown: 1,
        target: 'enemy',
        effects: [],
      } as unknown as GameSave['skills'][number],
    ]

    const { manager, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(manager.skillManager.has('ngu_kiem_thuat')).toBe(false)
  })
})

describe('A18-3 claim forge: dormant way pair is flagged and its grants stay inert', () => {
  it('coherent sword_pathway save restores flagged way_out_of_scope', () => {
    const { save } = validSave({
      realmId: 'qi_refining',
      breakthroughGrade: 1,
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
      swordPath: freshSwordPathState(),
      nodeLevels: {
        core_linh_bao: 1,
        core_orb_dam: 1,
        core_orb_chem: 1,
        core_orb_bo: 1,
        core_orb_hat: 1,
        core_orb_quet: 1,
      },
    })
    save.player.purchasedNodeIds = [
      ...(save.player.purchasedNodeIds ?? []),
      'core_orb_dam',
      'core_orb_chem',
      'core_orb_bo',
      'core_orb_hat',
      'core_orb_quet',
    ]
    // A real post-mortal save does not carry mortalBasicSkillId (the
    // preflight rejects it); validSave() adds it, so strip it here.
    delete (save.player as Partial<PlayerData>).mortalBasicSkillId
    save.techniques = [
      structuredClone(TECHNIQUES.find((t) => t.id === 'sword_control_art')!),
    ] as GameSave['techniques']
    const orbEntry = (id: string) => ({
      id,
      name: id,
      description: 'way kit',
      type: 'active',
      level: 1,
      maxLevel: 10,
      cooldown: 1,
      target: 'enemy',
      effects: [],
    })
    save.skills = [
      ...save.skills,
      orbEntry('orb_dam'),
      orbEntry('orb_chem'),
      orbEntry('orb_bo'),
      orbEntry('orb_hat'),
      orbEntry('orb_quet'),
    ] as GameSave['skills']

    const { manager, playerStore, result } = boot(save)
    expect(result.status).toBe('ok')
    expect(unsupportedReleaseReason(playerStore.$state as PlayerData)).toBe('way_out_of_scope')

    // The grant replay is authored on the ACTIVE way and gated isBetaWay
    // - a dormant way replays nothing (grantSkillCore writes nodeLevels).
    const p = playerStore.$state as PlayerData
    const before = { ...p.nodeLevels }
    manager.realmAdvanceOps.reconcileWayGrants(p)
    expect(p.nodeLevels).toEqual(before)
    expect(isRealmTransitionEnabled('qi_refining', 'foundation_establishment')).toBe(true)
  })
})

describe('A18-4 bag forge: dormant pill restores inert and refuses use', () => {
  it('phi_van_dan (dormant family) restores into the bag but usePill fails scope_hidden', () => {
    const { save } = validSave()
    save.pills = [{ pillId: 'phi_van_dan_mortal', amount: 2 }]

    const { manager, playerStore } = boot(save)
    expect(manager.pillBag.getAmount('phi_van_dan_mortal')).toBe(2)

    const used = manager.pillOps.usePillDetailed(
      'phi_van_dan_mortal',
      noopTarget(),
      playerStore.$state as PlayerData,
    )
    expect(used.ok).toBe(false)
    expect(used.reason).toBe('scope_hidden')
    expect(manager.pillBag.getAmount('phi_van_dan_mortal')).toBe(2)
  })
})

describe('A18-5 claim forge: talent envelope holds on every leg', () => {
  it('parked talent id is rejected outright', () => {
    const { save } = validSave({ selectedTalentIds: ['phu_van'] })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
  })

  it('golden_core pool talent on a mortal save is rejected (pool-realm bound)', () => {
    const { save } = validSave({ selectedTalentIds: ['kd_thanh_dan'] })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
  })

  it('second golden_core pool id hits the same bound', () => {
    const { save } = validSave({ selectedTalentIds: ['kd_linh_dan'] })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
  })
})

describe('A18-6 claim forge: dormant timed effect and dormant node stay sealed', () => {
  it('persistentTimedEffect from a dormant pill family is rejected', () => {
    const { save } = validSave({
      persistentTimedEffects: [
        {
          id: 'te1',
          kind: 'pill_regen',
          sourceId: 'khai_linh_dan_mortal',
          remainingTurns: 3,
          modifiers: [{ stat: 'manaRegenPerTurn', flat: 5 }],
        } as never,
      ],
    })
    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
  })

  it('dormant kiem-tree nodeLevels keep their record but mint no modifiers', () => {
    const { save } = validSave()
    save.player.nodeLevels = { ...save.player.nodeLevels, ngu_kiem_khoi: 3 }

    const { manager, playerStore, result, shape } = boot(save)
    // The boundary may keep the record (preserved) or reject it - the
    // load-bearing assertion is that no dormant node modifier reaches
    // the emission seam either way.
    expect(['ok', 'rejected']).toContain(result.status)
    if (result.status !== 'ok') {
      expect(shape.ok).toBe(false)
      return
    }
    const channels = manager.effectOps.getBattleBaseChannels(playerStore.$state as PlayerData)
    const nodeChannel = channels.find((channel) => channel.channel === 'node_levels')
    expect(nodeChannel?.modifiers ?? []).toHaveLength(0)
  })
})

describe('A18-7 residual class: forged precursor casts mint only writer-producible value', () => {
  // skillCastCounts/totalExperience is shape-bounded only (non-negative
  // finite). floor(casts/10) is UNCAPPED by design ("KHONG tran") and a
  // writer can reach any value through play - same-value residual, not a
  // defect. This probe documents the mint path so the bound is on record.
  it('forged totalExperience mints floor(casts/10) flat bonus on linh_bao', () => {
    const { save } = validSave()
    save.skills[0]!.totalExperience = 1_000_000
    save.player.skillCastCounts = { linh_bao: 1_000_000 }

    const { manager, result } = boot(save)
    expect(result.status).toBe('ok')

    const skill = manager.skillManager.get('linh_bao')
    expect(skill?.totalExperience).toBe(1_000_000)
    // The uncapped law: +1 flat per 10 casts, no ceiling - identical to
    // what the writer produces at the same counter value.
    expect(getPrecursorFlatDamageBonus(skill?.totalExperience ?? 0)).toBe(100_000)
  })
})
