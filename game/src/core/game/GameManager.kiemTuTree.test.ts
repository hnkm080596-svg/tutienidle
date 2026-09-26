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
import { collectKiemDaoCascadeUnlocks } from '../kiem-tu/NguKiemDaoProvider'
import { kiemDaoCap } from '../kiem-tu/NguKiemDao'
import { getRealmIndex } from '../realm/realmSystem'
import { KIEM_PHO_COMBOS } from '../../data/skill/KiemPhoCombos'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Kiem Tu Reimagined Task 11 (spec 2026-09-15 §6, K20) — the new
// progression tree end-to-end: Cuu Cung purchase grants flow through
// the NguKiemDao domain functions, the kiemDaoBelowCap prereq blocks
// purchase BEFORE insight is deducted, and requiredWay-tagged nodes are
// inert + unpurchasable across the way boundary (M6 — the retired
// swordPathMode field / kiem_tu_an flip node are gone; way membership is
// the gate).

const CUU_CUNG_OUTER_IDS = [
  'cuu_cung_kham',
  'cuu_cung_khon',
  'cuu_cung_chan',
  'cuu_cung_ton',
  'cuu_cung_can',
  'cuu_cung_doai',
  'cuu_cung_cin',
  'cuu_cung_ly',
] as const

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

// M6 — ngu membership is the WAY, not a purchased node: flipping
// cultivationWay is the whole switch (no kiem_tu_an prereq chain any
// more — ngu nodes need only requiredWay + realm + kiemDaoBelowCap).
function asNgu(player: ReturnType<typeof createDefaultPlayer>, outers: number = CUU_CUNG_OUTER_IDS.length) {
  player.cultivationWay = 'hidden_sword_pathway'
  player.nodeLevels = {}
  for (const id of CUU_CUNG_OUTER_IDS.slice(0, outers)) {
    player.nodeLevels[id] = 1
  }
}

describe('swordPath tree — Cuu Cung grants', () => {
  it('purchasing an outer node grants kiemY through the domain function', () => {
    const { gameManager, player } = setup()
    asNgu(player, 0)
    player.realmId = 'qi_refining'

    const node = gameManager.nodeRegistry.get('cuu_cung_kham')
    const grant = node.effect.kiemYGrant!

    expect(gameManager.progressionOps.canPurchaseNode('cuu_cung_kham', player)).toBe(true)
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_kham', player)).toBe(true)
    // gainKiemY converts greedily at forgeCost — the grant stays banked
    // when below the qi_refining forge cost (9,999).
    expect(player.swordPath!.kiemY).toBe(grant)
    expect(player.swordPath!.kiemDaoCount).toBe(1)
  })

  it('kiemYGrant exceeding forge cost auto-converts to kiemDao', () => {
    const { gameManager, player } = setup()
    asNgu(player, 0)
    player.realmId = 'qi_refining'
    player.swordPath!.kiemY = 9_000

    // cuu_cung_kham grants ~half a forge — the banked total crosses
    // 9,999 so the purchase converts one sword.
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_kham', player)).toBe(true)
    expect(player.swordPath!.kiemDaoCount).toBe(2)
    expect(player.swordPath!.kiemY).toBe(9_000 + 5_000 - 9_999)
  })

  it('kiemDaoBelowCap blocks purchase at cap BEFORE insight is deducted', () => {
    const { gameManager, player } = setup()
    asNgu(player, 0)
    player.realmId = 'qi_refining'
    player.swordPath!.kiemDaoCount = kiemDaoCap(1) // 2 — at cap

    const insightBefore = player.skillInsight
    expect(gameManager.progressionOps.canPurchaseNode('cuu_cung_kham', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_kham', player)).toBe(false)
    expect(player.skillInsight).toBe(insightBefore)
    expect(player.nodeLevels.cuu_cung_kham).toBeUndefined()
    expect(player.swordPath!.kiemY).toBe(0) // no grant leaked
  })

  it('trung_cung requires all 8 outers and grants +1 kiemDaoCount', () => {
    const { gameManager, player } = setup()
    asNgu(player, 7) // one outer missing
    player.swordPath!.kiemDaoCount = 1

    expect(gameManager.progressionOps.canPurchaseNode('cuu_cung_trung', player)).toBe(false)
    player.nodeLevels[CUU_CUNG_OUTER_IDS[7]!] = 1
    expect(gameManager.progressionOps.canPurchaseNode('cuu_cung_trung', player)).toBe(true)
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_trung', player)).toBe(true)
    expect(player.swordPath!.kiemDaoCount).toBe(2)
  })

  it('trung_cung is also cap-guarded', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    player.swordPath!.kiemDaoCount = kiemDaoCap(getRealmIndex(player.realmId))

    const insightBefore = player.skillInsight
    expect(gameManager.progressionOps.canPurchaseNode('cuu_cung_trung', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_trung', player)).toBe(false)
    expect(player.skillInsight).toBe(insightBefore)
  })
})

describe('swordPath tree — way boundary', () => {
  it('ngu player cannot purchase hien orb nodes (inert trap prevented)', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    expect(gameManager.progressionOps.canPurchaseNode('thich_can', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('thich_can', player)).toBe(false)
  })

  it('hien player cannot purchase ngu nodes', () => {
    const { gameManager, player } = setup()
    player.cultivationWay = 'sword_pathway'
    player.nodeLevels = { ngu_kiem_sac: 1 } // inconsistent save shape — gate still holds
    expect(gameManager.progressionOps.canPurchaseNode('ngu_cascade_a', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('ngu_cascade_a', player)).toBe(false)
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
    // Derived copy — canonical combo data untouched.
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

  it('purchased cascade nodes unlock through the effect field', () => {
    const { player } = setup()
    asNgu(player)
    player.nodeLevels['ngu_cascade_a'] = 1
    player.nodeLevels['ngu_cascade_d'] = 1

    const unlocks = collectKiemDaoCascadeUnlocks(player, KIEM_TU_NODES)
    expect(unlocks).toEqual({ a: true, e: false, d: true })
  })
})
