import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { EnemyDefinition } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'

// Kiếm Tu tự lực (2026-08-28, task-6-brief.md) — slot 4 dành riêng chiêu
// trận Kiếm Trận (auto-thay chiêu trận cũ khi mua node kế tiếp) +
// setKiemTuRoute() đổi giữa 2 nhánh song song (Kiếm Trận mặc định / Bạt
// Kiếm sau khi đại thành bat_kiem_thuc), chặn trong combat y hệt
// setArtifactPath.

const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  attack: 0,
  attackSpeed: 1,
  movementSpeed: 60,
  attackRangeRanks: 999999,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayerEntity(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0 }

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentRage: 0,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  }
}

function enemyDefinition(): EnemyDefinition {
  return {
    id: 'target_dummy',
    name: 'Bia Tập',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: MINIMAL_STATS_INPUT,
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  }
}

function setup() {
  const gameManager = new GameManager()

  gameManager.registerSkillTemplates(SKILLS)
  gameManager.registerProgressionNodes(KIEM_TU_NODES)

  return gameManager
}

describe('GameManager — Kiếm Tu tự lực: slot Kiếm Trận + route đổi đường', () => {
  it('mở Tam Tài tự thay Lưỡng Nghi ở slot Kiếm Trận (slot 4)', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.realmId = 'qi_refining'

    expect(gameManager.purchaseNode('kiem_tran_luong_nghi', player)).toBe(true)
    expect(gameManager.skillManager.getEquippedInSlot(4)?.id).toBe('kiem_tran_luong_nghi')

    player.realmId = 'foundation_establishment'

    expect(gameManager.purchaseNode('kiem_tran_tam_tai', player)).toBe(true)
    expect(gameManager.skillManager.getEquippedInSlot(4)?.id).toBe('kiem_tran_tam_tai')
    expect(gameManager.skillManager.get('kiem_tran_luong_nghi')!.equipped).toBe(false)
  })

  it('setKiemTuRoute("bat_kiem") false khi chưa mua bat_kiem_thuc', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()

    expect(gameManager.setKiemTuRoute(player, 'bat_kiem')).toBe(false)
    expect(player.kiemTuRoute).toBeUndefined()
  })

  it('setKiemTuRoute("bat_kiem") true sau khi mua đủ bat_kiem_an + bat_kiem_thuc, equip slot 1', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.skillCastCounts = { tram: 9999 }
    player.skillLevels = { tram: 3 }

    gameManager.skillSystem.learn(SKILLS.find(skill => skill.id === 'kiem_khai_thien_mon')!)
    gameManager.skillSystem.equipToSlot('kiem_khai_thien_mon', 1)

    expect(gameManager.purchaseNode('bat_kiem_an', player)).toBe(true)
    expect(gameManager.purchaseNode('minor_bat_kiem_uy', player)).toBe(true)
    expect(gameManager.purchaseNode('bat_kiem_thuc', player)).toBe(true)

    expect(gameManager.setKiemTuRoute(player, 'bat_kiem')).toBe(true)
    expect(player.kiemTuRoute).toBe('bat_kiem')
    expect(gameManager.skillManager.getEquippedInSlot(1)?.id).toBe('bat_kiem_thuat')
    expect(gameManager.skillManager.get('kiem_khai_thien_mon')!.equipped).toBe(false)
    expect(gameManager.skillManager.get('kiem_khai_thien_mon')!.unlocked).toBe(true)
  })

  it('setKiemTuRoute chặn trong combat', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()
    player.skillInsight = 100
    player.skillCastCounts = { tram: 9999 }
    player.skillLevels = { tram: 3 }

    gameManager.purchaseNode('bat_kiem_an', player)
    gameManager.purchaseNode('minor_bat_kiem_uy', player)
    gameManager.purchaseNode('bat_kiem_thuc', player)

    gameManager.registerEnemyTemplates([defineEnemy(enemyDefinition())])
    gameManager.startBattle(createPlayerEntity(), defineEnemy(enemyDefinition()))

    expect(gameManager.getBattle()?.state).toBe('countdown')
    expect(gameManager.setKiemTuRoute(player, 'bat_kiem')).toBe(false)
    expect(player.kiemTuRoute).toBeUndefined()
  })
})
