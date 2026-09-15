import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { collectKiemPhoComboModifiers } from '../kiem-tu/KiemPhoNodeModifiers'
import { collectKiemDaoCascadeUnlocks } from '../kiem-tu/NguKiemDaoProvider'
import { kiemDaoCap } from '../kiem-tu/NguKiemDao'
import { getRealmIndex } from '../realm/realmSystem'
import { aggregateNodeStatModifiers } from '../progression/NodeSystem'
import { KIEM_PHO_COMBOS } from '../../data/skill/KiemPhoCombos'

// Kiem Tu Reimagined Task 11 (spec 2026-09-15 §6, K20) — the new
// progression tree end-to-end: Cuu Cung purchase grants flow through
// the NguKiemDao domain functions, the kiemDaoBelowCap prereq blocks
// purchase BEFORE insight is deducted, and kiemTuMode-tagged nodes are
// inert + unpurchasable across the mode boundary.

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

  const player = createDefaultPlayer()
  player.cultivationPath = 'kiem_tu'
  player.realmId = 'mahayana'
  player.kiemTu = freshKiemTuState()
  player.skillInsight = 100_000

  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

function asNgu(player: ReturnType<typeof createDefaultPlayer>, outers: number = CUU_CUNG_OUTER_IDS.length) {
  player.kiemTu!.mode = 'ngu'
  player.nodeLevels = { kiem_tu_an: 1 }
  for (const id of CUU_CUNG_OUTER_IDS.slice(0, outers)) {
    player.nodeLevels[id] = 1
  }
}

describe('kiemTu tree — Cuu Cung grants', () => {
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
    expect(player.kiemTu!.kiemY).toBe(grant)
    expect(player.kiemTu!.kiemDaoCount).toBe(1)
  })

  it('kiemYGrant exceeding forge cost auto-converts to kiemDao', () => {
    const { gameManager, player } = setup()
    asNgu(player, 0)
    player.realmId = 'qi_refining'
    player.kiemTu!.kiemY = 9_000

    // cuu_cung_kham grants ~half a forge — the banked total crosses
    // 9,999 so the purchase converts one sword.
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_kham', player)).toBe(true)
    expect(player.kiemTu!.kiemDaoCount).toBe(2)
    expect(player.kiemTu!.kiemY).toBe(9_000 + 5_000 - 9_999)
  })

  it('kiemDaoBelowCap blocks purchase at cap BEFORE insight is deducted', () => {
    const { gameManager, player } = setup()
    asNgu(player, 0)
    player.realmId = 'qi_refining'
    player.kiemTu!.kiemDaoCount = kiemDaoCap(1) // 2 — at cap

    const insightBefore = player.skillInsight
    expect(gameManager.progressionOps.canPurchaseNode('cuu_cung_kham', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_kham', player)).toBe(false)
    expect(player.skillInsight).toBe(insightBefore)
    expect(player.nodeLevels.cuu_cung_kham).toBeUndefined()
    expect(player.kiemTu!.kiemY).toBe(0) // no grant leaked
  })

  it('trung_cung requires all 8 outers and grants +1 kiemDaoCount', () => {
    const { gameManager, player } = setup()
    asNgu(player, 7) // one outer missing
    player.kiemTu!.kiemDaoCount = 1

    expect(gameManager.progressionOps.canPurchaseNode('cuu_cung_trung', player)).toBe(false)
    player.nodeLevels[CUU_CUNG_OUTER_IDS[7]!] = 1
    expect(gameManager.progressionOps.canPurchaseNode('cuu_cung_trung', player)).toBe(true)
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_trung', player)).toBe(true)
    expect(player.kiemTu!.kiemDaoCount).toBe(2)
  })

  it('trung_cung is also cap-guarded', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    player.kiemTu!.kiemDaoCount = kiemDaoCap(getRealmIndex(player.realmId))

    const insightBefore = player.skillInsight
    expect(gameManager.progressionOps.canPurchaseNode('cuu_cung_trung', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_trung', player)).toBe(false)
    expect(player.skillInsight).toBe(insightBefore)
  })
})

describe('kiemTu tree — mode boundary', () => {
  it('ngu player cannot purchase hien orb nodes (inert trap prevented)', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    expect(gameManager.progressionOps.canPurchaseNode('orb_dam_1', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('orb_dam_1', player)).toBe(false)
  })

  it('hien player cannot purchase ngu nodes', () => {
    const { gameManager, player } = setup()
    player.kiemTu!.mode = 'hien'
    player.nodeLevels = { kiem_tu_an: 1 } // inconsistent save shape — gate still holds
    expect(gameManager.progressionOps.canPurchaseNode('ngu_cascade_a', player)).toBe(false)
  })

  it('hien orb node statModifiers do not aggregate while mode is ngu', () => {
    const { gameManager, player } = setup()
    player.nodeLevels = { orb_dam_1: 5 }
    player.kiemTu!.mode = 'ngu'
    const nguMods = aggregateNodeStatModifiers(gameManager.nodeRegistry, player)
    expect(nguMods.filter(m => m.sourceId === 'orb_dam_1')).toEqual([])

    player.kiemTu!.mode = 'hien'
    const hienMods = aggregateNodeStatModifiers(gameManager.nodeRegistry, player)
    expect(hienMods.filter(m => m.sourceId === 'orb_dam_1').length).toBeGreaterThan(0)
  })
})

describe('kiemTu tree — collectors', () => {
  it('purchased orb capstone surfaces as a combo modifier that boosts matching combos', () => {
    const { gameManager, player } = setup()
    player.kiemTu!.mode = 'hien'
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
    // Derived copy — canonical combo data untouched.
    expect(derived).not.toBe(matching)
  })

  it('capstone modifiers stay inert while mode is ngu', () => {
    const { gameManager, player } = setup()
    player.kiemTu!.mode = 'ngu'
    player.nodeLevels = { orb_dam_capstone: 1, kiem_tu_an: 1 }
    expect(collectKiemPhoComboModifiers(player, KIEM_TU_NODES)).toEqual([])
  })

  it('purchased cascade nodes unlock through the effect field', () => {
    const { gameManager, player } = setup()
    asNgu(player)
    player.nodeLevels['ngu_cascade_a'] = 1
    player.nodeLevels['ngu_cascade_d'] = 1

    const unlocks = collectKiemDaoCascadeUnlocks(player, KIEM_TU_NODES)
    expect(unlocks).toEqual({ a: true, e: false, d: true })
  })
})
