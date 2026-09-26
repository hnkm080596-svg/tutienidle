import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import {
  collectKiemPhoComboModifiers,
  collectKiemPhoSkillDefinitionModifiers,
} from '../kiem-tu/KiemPhoNodeModifiers'
import { applyModifiers } from '../kiem-tu/KiemPhoSystem'
import { collectOwnedEvolutionIds } from '../kiem-tu/NguKiemDaoProvider'
import { getRealmIndex } from '../realm/realmSystem'
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
    expect(gameManager.progressionOps.canPurchaseNode('thich_can', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('thich_can', player)).toBe(false)
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

  it('hien orb node effects do not collect on the ngu way', () => {
    const { player } = setup()
    player.nodeLevels = { thich_can: 5 }
    player.cultivationWay = 'hidden_sword_pathway'
    expect(collectKiemPhoSkillDefinitionModifiers(player, KIEM_TU_NODES)).toEqual([])

    player.cultivationWay = 'sword_pathway'
    const hienMods = collectKiemPhoSkillDefinitionModifiers(player, KIEM_TU_NODES)
    expect(hienMods.filter(m => m.nodeId === 'thich_can' && m.skillId === 'orb_dam').length).toBeGreaterThan(0)
  })
})

describe('swordPath tree — collectors', () => {
  it('purchased Lien Thuc surfaces as a combo modifier that boosts >=2-dam combos', () => {
    const { player } = setup()
    player.cultivationWay = 'sword_pathway'
    player.nodeLevels = { lien_thich: 1 }

    const modifiers = collectKiemPhoComboModifiers(player, KIEM_TU_NODES)
    expect(modifiers.length).toBe(1)
    expect(modifiers[0]!.nodeId).toBe('lien_thich')

    const matching = KIEM_PHO_COMBOS.find(c => c.id === 'nhat_tuyen')!
    const unmatched = KIEM_PHO_COMBOS.find(c => !c.pattern.includes('orb_dam'))!

    expect(modifiers[0]!.matches(matching)).toBe(true)
    expect(modifiers[0]!.matches(unmatched)).toBe(false)

    const derived = modifiers[0]!.apply(matching)
    expect(derived.damage!.multiplier).toBeGreaterThan(matching.damage!.multiplier)
    // Derived copy -- canonical combo data untouched.
    expect(derived).not.toBe(matching)
  })

  it('Kiem Ket + Lien Thuc interactions compose on one combo in phase order (design sec.8)', () => {
    const { player } = setup()
    player.cultivationWay = 'sword_pathway'
    // luu_ngan appends extend_duration; lien_tram appends
    // trigger_periodic. diep_ngan [C,D,C] matches both predicates and
    // already carries an authored trigger_periodic - the phase pin
    // forces extend_duration ahead of both triggers.
    player.nodeLevels = { luu_ngan: 1, lien_tram: 1 }

    const modifiers = collectKiemPhoComboModifiers(player, KIEM_TU_NODES)
    expect(modifiers.length).toBe(2)

    const diepNgan = KIEM_PHO_COMBOS.find(c => c.id === 'diep_ngan')!
    for (const m of modifiers) expect(m.matches(diepNgan)).toBe(true)

    const derived = applyModifiers(diepNgan, modifiers)
    expect(derived.ailmentInteractions!.map(i => i.kind)).toEqual([
      'extend_duration',
      'trigger_periodic',
      'trigger_periodic',
    ])
    // Canonical combo data untouched by modifier application.
    expect(diepNgan.ailmentInteractions).toHaveLength(1)
  })

  it('kiem_pho combo modifiers stay inert on the ngu way', () => {
    const { player } = setup()
    player.cultivationWay = 'hidden_sword_pathway'
    player.nodeLevels = { lien_thich: 1 }
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
