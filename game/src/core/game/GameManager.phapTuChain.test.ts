import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS, CHAIN_SKILL_IDS } from '../../data/skill/Skills'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { buffs } from '../../data/buff/buffs'
import type { Enemy } from '../enemy/Enemy'
import { createBaseStats, type Stats } from '../stats/StatBlock'

// Task 12 (plan 2026-09-03-thuan-he) — glue end-to-end qua GameManager:
// mua node lap_dao_thuan_fire + unlock B → startBattleWithPlayer →
// setChainDefinition hoạt động (B không cast được trước A), ult Thế đầy
// → tryPlayerUltimate() nổ đúng profile (không chiếm loadout slot).
//
// Player fixture đi ĐÚNG đường production: chooseCultivationPath lúc
// mortal (tự Lễ Nhập Môn → qi_refining), rồi bump realmId thủ công tới
// foundation_establishment (gate của phap_tu_lap_dao — cùng cách
// GameManager.phapTuFirePath.test.ts vẫn làm).
function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  const stats = { ...createBaseStats(), attack: 0, defense: 0 }

  return {
    id: 'glue_enemy',
    name: 'Glue Enemy',
    level: 1,
    realmId: 'mortal',
    stats,
    currentHp: 100000,
    maxHp: 100000,
    alive: true,
    rewards: { experience: 0, silver: 0 },
    lane: 'front',
    ...overrides,
  } as Enemy
}

function setup() {
  const gameManager = new GameManager()

  gameManager.registerSkillTemplates(SKILLS)
  gameManager.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.registerBuffs(buffs)

  const player = createDefaultPlayer()

  player.realmLevel = 12
  player.skillInsight = 100

  expect(gameManager.chooseCultivationPath('phap_tu', player)).toBe(true)

  player.realmId = 'foundation_establishment'
  player.realmLevel = 1

  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

const PLAYER_STATS = { ...createBaseStats(), maxHp: 1000, attack: 50 } as Stats

describe('GameManager — glue chuỗi Thuần + ult (Task 12)', () => {
  it('chưa Lập Đạo Thuần → startBattle không gate chain (B cast tự do như cũ)', () => {
    const { gameManager, player } = setup()

    gameManager.startBattleWithPlayer(player, PLAYER_STATS, makeEnemy())

    const battle = gameManager.getBattle()

    expect(battle).not.toBeNull()

    // Không chain definition → scheduler không gate: chỉ cần tick là A
    // cast (slot 0). Không assert B vì B chưa unlock ở đây.
    gameManager.battleSystem.update(4)

    expect(gameManager.skillManager.get('hoa_cau_thuat')?.unlocked).toBe(true)
  })

  it('mua lap_dao_thuan_fire + unlock B → chain gate: B chỉ cast SAU A', () => {
    const { gameManager, player } = setup()

    expect(gameManager.purchaseNode('phap_tu_lap_dao', player)).toBe(true)
    expect(gameManager.purchaseNode('lap_dao_thuan_fire', player)).toBe(true)
    expect(gameManager.purchaseNode('linh_ngo_nam_minh_liet_hoa', player)).toBe(true)

    expect(gameManager.getPhapTuThuanElement()).toBe('fire')

    gameManager.skillSystem.equipToSlot('nam_minh_liet_hoa', 1)

    gameManager.startBattleWithPlayer(player, PLAYER_STATS, makeEnemy())

    expect(gameManager.getPhapTuThuanElement()).toBe('fire')

    const battle = gameManager.getBattle()!

    // Chạy đủ lâu cho vài link: A phải là cast ĐẦU TIÊN, và B chỉ xuất
    // hiện sau A (gate chuỗi qua setChainDefinition glue).
    const castIds: string[] = []

    gameManager.eventBus.on<{ skillId: string }>('cast', (event) => {
      castIds.push(event.skillId)
    })

    for (let i = 0; i < 1200; i++) {
      gameManager.skillSystem.update(0.01, 0)
      gameManager.battleSystem.update(0.01)
    }

    expect(castIds.length).toBeGreaterThan(0)
    expect(castIds[0]).toBe('hoa_cau_thuat')

    const indexB = castIds.indexOf('nam_minh_liet_hoa')

    if (indexB !== -1) {
      expect(castIds.indexOf('hoa_cau_thuat')).toBeLessThan(indexB)
    }

    // Thế tích qua link chuỗi (glue advanceChainAndGainThe chạy).
    expect(battle.player.currentThe ?? 0).toBeGreaterThanOrEqual(10)
  })

  it('ult glue: Thế đầy + học ult → tryPlayerUltimate() trả "ult", tiêu Thế', () => {
    const { gameManager, player } = setup()

    expect(gameManager.purchaseNode('phap_tu_lap_dao', player)).toBe(true)
    expect(gameManager.purchaseNode('lap_dao_thuan_fire', player)).toBe(true)
    expect(gameManager.purchaseNode('linh_ngo_nam_minh_liet_hoa', player)).toBe(true)
    expect(gameManager.purchaseNode('linh_ngo_tat_phuong_giang_the', player)).toBe(true)

    gameManager.startBattleWithPlayer(player, PLAYER_STATS, makeEnemy())

    // Qua countdown 3s + telegraph spawn → state 'fighting' (ult chỉ nổ
    // trong fighting, xem tryPlayerUltimate gate).
    gameManager.battleSystem.update(3)

    const battle = gameManager.getBattle()!

    expect(battle.state).toBe('fighting')

    battle.player.currentThe = 100

    expect(gameManager.battleSystem.tryPlayerUltimate()).toBe('ult')
    expect(battle.player.currentThe).toBe(0)
  })

  it('ult glue: chưa Lập Đạo Thuần → tryPlayerUltimate null dù Thế đầy', () => {
    const { gameManager, player } = setup()

    gameManager.startBattleWithPlayer(player, PLAYER_STATS, makeEnemy())

    const battle = gameManager.getBattle()!

    battle.player.currentThe = 100

    expect(gameManager.battleSystem.tryPlayerUltimate()).toBeNull()
    expect(battle.player.currentThe).toBe(100)
  })

  it('chain definition là session-scoped: player không Thuần → trận sau không gate', () => {
    const { gameManager, player } = setup()

    expect(gameManager.purchaseNode('phap_tu_lap_dao', player)).toBe(true)
    expect(gameManager.purchaseNode('lap_dao_thuan_fire', player)).toBe(true)

    gameManager.startBattleWithPlayer(player, PLAYER_STATS, makeEnemy())
    gameManager.battleSystem.stop()

    // Player thứ hai (guest chưa lập đạo) — chain phải bị clear.
    const player2 = createDefaultPlayer()

    player2.realmLevel = 12

    expect(gameManager.chooseCultivationPath('phap_tu', player2)).toBe(true)
    player2.realmId = 'foundation_establishment'
    player2.realmLevel = 1
    gameManager.setActivePlayer(player2)

    gameManager.startBattleWithPlayer(player2, PLAYER_STATS, makeEnemy())

    expect(gameManager.getPhapTuThuanElement()).toBeUndefined()
  })
})
