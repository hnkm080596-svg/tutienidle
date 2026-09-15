import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'

// Kiem Tu Reimagined Task 10 (spec K2/K4) — the kiem_tu_an hidden node:
// invisible + unpurchasable until tram reaches Lv3; purchase flips
// kiemTu.mode to 'ngu' one-way, learns AND equips van_kiem_quyet;
// hard-gated to kiem_tu hien outside combat; non-refundable via
// devResetBranch.

const KIEM_TU_AN_GATE = { kind: 'skillCastCount' as const, skillId: 'tram', level: 3 }

function makeDummyEnemy(id: string) {
  return defineEnemy({
    id,
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 10_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      evasionRate: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function setup(tramLevel = 3, tramCasts = 10_000) {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)

  const player = createDefaultPlayer()
  player.cultivationPath = 'kiem_tu'
  player.realmId = 'golden_core'
  player.kiemTu = freshKiemTuState()
  player.skillInsight = 500
  player.skillLevels = { tram: tramLevel }
  player.skillCastCounts = { tram: tramCasts }

  gameManager.setActivePlayer(player)
  gameManager.progressionOps.learnSkill('tram')

  return { gameManager, player }
}

function node(id: string) {
  const found = KIEM_TU_NODES.find(n => n.id === id)
  if (!found) throw new Error(`node ${id} missing from KIEM_TU_NODES`)
  return found
}

describe('kiem_tu_an node data', () => {
  it('exists in KIEM_TU_NODES with revealWhen + purchase prereq = tram Lv3', () => {
    const an = node('kiem_tu_an')

    expect(an.revealWhen).toEqual(KIEM_TU_AN_GATE)
    expect(an.prerequisites).toContainEqual(KIEM_TU_AN_GATE)
    expect(an.effect.kiemTuModeSwitch).toBe('ngu')
  })
})

describe('kiem_tu_an gate', () => {
  it('unpurchasable while tram < Lv3', () => {
    const { gameManager, player } = setup(2, 9_000)

    expect(gameManager.progressionOps.canPurchaseNode('kiem_tu_an', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('kiem_tu_an', player)).toBe(false)
    expect(player.kiemTu!.mode).toBe('hien')
  })

  it('unpurchasable for non-kiem-tu players even at tram Lv3', () => {
    const { gameManager, player } = setup()
    player.cultivationPath = 'phap_tu'

    expect(gameManager.progressionOps.canPurchaseNode('kiem_tu_an', player)).toBe(false)
  })

  it('purchase flips mode to ngu + learns and equips van_kiem_quyet', () => {
    const { gameManager, player } = setup()

    expect(gameManager.progressionOps.purchaseNode('kiem_tu_an', player)).toBe(true)
    expect(player.kiemTu!.mode).toBe('ngu')
    expect(gameManager.techniqueManager.has('van_kiem_quyet')).toBe(true)
    expect(gameManager.techniqueManager.getEquipped()?.id).toBe('van_kiem_quyet')
  })

  it('one-way: a ngu player cannot repurchase the node', () => {
    const { gameManager, player } = setup()

    gameManager.progressionOps.purchaseNode('kiem_tu_an', player)
    player.skillInsight = 500

    expect(gameManager.progressionOps.canPurchaseNode('kiem_tu_an', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('kiem_tu_an', player)).toBe(false)
  })

  it('purchase rejected while a battle is active (participant desync guard)', () => {
    const { gameManager, player } = setup()
    gameManager.startBattleWithPlayer(player, makeDummyEnemy('kta_enemy'))

    expect(gameManager.progressionOps.canPurchaseNode('kiem_tu_an', player)).toBe(false)
    expect(gameManager.progressionOps.purchaseNode('kiem_tu_an', player)).toBe(false)
    expect(player.kiemTu!.mode).toBe('hien')
  })

  it('devResetBranch does not clear or refund the mode switch', () => {
    const { gameManager, player } = setup()
    const insightBefore = player.skillInsight

    gameManager.progressionOps.purchaseNode('kiem_tu_an', player)
    const insightAfterPurchase = player.skillInsight

    const refund = gameManager.progressionOps.devResetBranch('ngu_kiem', player)

    expect(refund).toBe(0)
    expect(player.kiemTu!.mode).toBe('ngu')
    expect(player.skillInsight).toBe(insightAfterPurchase)
    void insightBefore
  })
})
