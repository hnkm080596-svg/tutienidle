import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { collectKiemPhoComboModifiers } from '../kiem-tu/KiemPhoNodeModifiers'
import { collectOwnedEvolutionIds } from '../kiem-tu/NguKiemDaoProvider'
import { getRealmIndex } from '../realm/realmSystem'
import { aggregateNodeStatModifiers } from '../progression/NodeSystem'
import { KIEM_PHO_COMBOS } from '../../data/skill/KiemPhoCombos'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Kiem Tu Reimagined Task 11 (spec 2026-09-15 sec.6, K20) -- progression
// tree end-to-end: requiredWay-tagged nodes are inert + unpurchasable
// across the way boundary (M6 -- the retired swordPathMode field /
// kiem_tu_an flip node are gone; way membership is the gate).
//
// Ngu Kiem Beta (design 2026-09-24) -- the Cuu Cung purchase-grant
// economy is a NON-GOAL and gone: no node grants kiemY/kiemDao and the
// kiemDaoBelowCap prereq kind died with it. The ngu tree is now the
// evolution spine: Khoi is grant-only through the way commit,
// Lien is the only insight-purchasable spine node inside the beta
// ceiling, Phong stays sealed behind a beyond-beta realm gate.

function setup() {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  const player = createDefaultPlayer()
  player.cultivationPath = 'sword'
  player.cultivationWay = 'sword_pathway'
  player.realmId = 'mahayana'
  player.swordPath = freshSwordPathState()
  player.skillInsight = 100_000

  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

// M6 -- ngu membership is the WAY, not a purchased node: flipping
// cultivationWay is the whole switch.
function asNgu(player: ReturnType<typeof createDefaultPlayer>) {
  player.cultivationWay = 'hidden_sword_pathway'
  player.nodeLevels = {}
}

describe('swordPath tree — evolution spine grants', () => {
  it('ngu_kiem_khoi is grantedOnly — never purchasable, no insight deducted', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    player.realmId = 'qi_refining'

    const insightBefore = player.skillInsight
    expect(gameManager.progressionOps.canPurchaseNode('ngu_kiem_khoi', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('ngu_kiem_khoi', player)).toBe(false)
    expect(player.skillInsight).toBe(insightBefore)
    expect(player.nodeLevels.ngu_kiem_khoi).toBeUndefined()
  })

  it('ngu_kiem_lien purchases when Khoi is owned at foundation_establishment', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    player.realmId = 'foundation_establishment'
    player.nodeLevels = { ngu_kiem_khoi: 1 } // the ritual grant seam

    expect(gameManager.progressionOps.canPurchaseNode('ngu_kiem_lien', player)).toBe(true)
    expect(gameManager.progressionOps.purchaseNode('ngu_kiem_lien', player)).toBe(true)
    expect(player.nodeLevels.ngu_kiem_lien).toBe(1)
  })

  it('ngu_kiem_lien is blocked below foundation_establishment even with Khoi owned', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    player.realmId = 'qi_refining'
    player.nodeLevels = { ngu_kiem_khoi: 1 }

    const insightBefore = player.skillInsight
    expect(gameManager.progressionOps.canPurchaseNode('ngu_kiem_lien', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('ngu_kiem_lien', player)).toBe(false)
    expect(player.skillInsight).toBe(insightBefore)
  })

  it('ngu_kiem_lien requires Khoi owned (evolution chain order)', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    player.realmId = 'foundation_establishment'
    player.nodeLevels = {}

    expect(gameManager.progressionOps.canPurchaseNode('ngu_kiem_lien', player)).toBe(false)
  })

  it('a purchased spine node is single-level — no upgrade path exists', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    player.realmId = 'foundation_establishment'
    player.nodeLevels = { ngu_kiem_khoi: 1 }
    expect(gameManager.progressionOps.purchaseNode('ngu_kiem_lien', player)).toBe(true)
    expect(gameManager.progressionOps.canPurchaseNode('ngu_kiem_lien', player)).toBe(false)
    expect(gameManager.progressionOps.canUpgradeNode('ngu_kiem_lien', player)).toBe(false)
  })

  it('owned spine nodes surface through collectOwnedEvolutionIds', () => {
    const { player } = setup()
    asNgu(player)
    player.nodeLevels = { ngu_kiem_khoi: 1, ngu_kiem_lien: 1 }

    expect([...collectOwnedEvolutionIds(player, KIEM_TU_NODES)].sort()).toEqual(['khoi', 'lien'])
  })

  it('ngu_kiem_phong_an stays sealed inside the beta ceiling', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    player.realmId = 'foundation_establishment'
    player.nodeLevels = { ngu_kiem_khoi: 1, ngu_kiem_lien: 1 }

    expect(gameManager.progressionOps.canPurchaseNode('ngu_kiem_phong_an', player)).toBe(false)
  })
})

describe('swordPath tree — way boundary', () => {
  it('ngu player cannot purchase hien orb nodes (inert trap prevented)', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    expect(gameManager.progressionOps.canPurchaseNode('orb_dam_1', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('orb_dam_1', player)).toBe(false)
  })

  it('hien player cannot purchase ngu spine nodes', () => {
    const { gameManager, player } = setup()
    player.cultivationWay = 'sword_pathway'
    player.realmId = 'foundation_establishment'
    player.nodeLevels = { ngu_kiem_khoi: 1 } // inconsistent save shape -- gate still holds
    expect(gameManager.progressionOps.canPurchaseNode('ngu_kiem_lien', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('ngu_kiem_lien', player)).toBe(false)
    expect(player.nodeLevels.ngu_kiem_lien).toBeUndefined()
  })

  it('hien orb node statModifiers do not aggregate on the ngu way', () => {
    const { gameManager, player } = setup()
    player.nodeLevels = { orb_dam_1: 5 }
    player.cultivationWay = 'hidden_sword_pathway'
    const nguMods = aggregateNodeStatModifiers(gameManager.nodeRegistry, player)
    expect(nguMods.filter(m => m.sourceId === 'orb_dam_1')).toEqual([])

    player.cultivationWay = 'sword_pathway'
    const hienMods = aggregateNodeStatModifiers(gameManager.nodeRegistry, player)
    expect(hienMods.filter(m => m.sourceId === 'orb_dam_1').length).toBeGreaterThan(0)
  })
})

describe('swordPath tree — collectors', () => {
  it('purchased orb capstone surfaces as a combo modifier that boosts matching combos', () => {
    const { player } = setup()
    player.cultivationWay = 'sword_pathway'
    player.nodeLevels = { orb_dam_capstone: 1 }

    const modifiers = collectKiemPhoComboModifiers(player, KIEM_TU_NODES)
    expect(modifiers.length).toBe(1)
    expect(modifiers[0]!.nodeId).toBe('orb_dam_capstone')

    const matching = KIEM_PHO_COMBOS.find(c => c.pattern.filter(o => o === 'orb_dam').length >= 2)!
    const unmatched = KIEM_PHO_COMBOS.find(c => !c.pattern.includes('orb_dam'))!

    expect(modifiers[0]!.matches(matching)).toBe(true)
    expect(modifiers[0]!.matches(unmatched)).toBe(false)

    const derived = modifiers[0]!.apply(matching)
    expect(derived.damage!.multiplier).toBeGreaterThan(matching.damage!.multiplier)
    // Derived copy -- canonical combo data untouched.
    expect(derived).not.toBe(matching)
  })

  it('capstones granting DIFFERENT buffs compose on one combo (no overwrite)', () => {
    const { player } = setup()
    player.cultivationWay = 'sword_pathway'
    player.nodeLevels = { orb_chem_capstone: 1, orb_bo_capstone: 1, orb_hat_capstone: 1 }

    const modifiers = collectKiemPhoComboModifiers(player, KIEM_TU_NODES)
    expect(modifiers.length).toBe(3)

    // [B,H,C,B] 'phach_lieu_tram_phach' -- matches bo (>=1) + hat (>=1);
    // chem needs >=2 and does not match.
    const twoBuff = KIEM_PHO_COMBOS.find(c => c.id === 'phach_lieu_tram_phach')!
    const d2 = modifiers.reduce((acc, m) => (m.matches(acc) ? m.apply(acc) : acc), twoBuff)
    expect((d2.appliesBuffs ?? []).map(b => b.definitionId).sort()).toEqual(['choang', 'suy_nhuoc'])

    // [C,B,D,C] 'tram_phach_thich_tram' -- matches chem (>=2) + bo (>=1).
    const threeOrb = KIEM_PHO_COMBOS.find(c => c.id === 'tram_phach_thich_tram')!
    const d3 = modifiers.reduce((acc, m) => (m.matches(acc) ? m.apply(acc) : acc), threeOrb)
    expect((d3.appliesBuffs ?? []).map(b => b.definitionId).sort()).toEqual(['kiem_thuong', 'suy_nhuoc'])
    expect(d3.appliesBuffs!.find(b => b.definitionId === 'kiem_thuong')!.stacks).toBe(2)

    // Canonical combo data untouched by modifier application.
    expect(twoBuff.appliesBuffs).toBeUndefined()
    expect(threeOrb.appliesBuffs).toBeUndefined()
  })

  it('capstone modifiers stay inert on the ngu way', () => {
    const { player } = setup()
    player.cultivationWay = 'hidden_sword_pathway'
    player.nodeLevels = { orb_dam_capstone: 1 }
    expect(collectKiemPhoComboModifiers(player, KIEM_TU_NODES)).toEqual([])
  })

  it('evolution ownership stays inert on the hien way (way gate at the collector)', () => {
    const { player } = setup()
    player.cultivationWay = 'sword_pathway'
    player.nodeLevels = { ngu_kiem_lien: 1 }
    expect(collectOwnedEvolutionIds(player, KIEM_TU_NODES).size).toBe(0)
  })

  it('realm index used for forge/cap math stays the only realm gate on the way', () => {
    const { player } = setup()
    expect(getRealmIndex(player.realmId)).toBeGreaterThan(0)
  })
})
