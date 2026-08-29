import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy, createBossVariant } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import { GRID_ROW_COUNT, CENTER_LANE_INDEX } from '../battle/BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'

// Top-down 5-spawnedLane (2026-08-22) — Boss LUÔN đứng spawnedLane giữa (CENTER_LANE_INDEX),
// quái thường random mỗi lần spawn. Gán spawnedLane xảy ra ở GameManager.startBattle()/
// updateStageProgress() (SAU enemyToCombatEntity(), ghi đè placeholder spawnedLane:0 —
// xem Enemy.ts's enemyToCombatEntity()), không phải ở core Enemy/EnemyDefinition.
const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  attack: 0,
  attackSpeed: 1,
  movementSpeed: 60,
  attackRangeRanks: 8,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayer(): CombatEntity {
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
    row: CENTER_LANE_INDEX,
    alive: true,
  }
}

describe('GameManager — spawnedLane assignment (top-down 5-spawnedLane, 2026-08-22)', () => {
  it('quái Boss (isBoss:true) LUÔN nhận spawnedLane === CENTER_LANE_INDEX, bất kể EnemyLane authored trong data', () => {
    const gameManager = new GameManager()

    const bossTemplate = defineEnemy({
      id: 'lane_test_boss',
      name: 'Boss',
      level: 1,
      realmId: 'qi_refining',
      // EnemyLane authored 'air' — CỐ TÌNH khác CENTER_LANE_INDEX, chứng
      // minh field authored này không còn quyết định vị trí hiển thị.
      lane: 'air',
      statsInput: MINIMAL_STATS_INPUT,
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    for (let i = 0; i < 30; i++) {
      const boss = createBossVariant(bossTemplate)

      gameManager.startBattle(createPlayer(), boss)

      // Spawn telegraph (2026-08-24): row gán lúc materialize — đọc row ĐÃ RESOLVE từ pending position (cùng giá trị sẽ gán cho entity).
      expect(gameManager.getBattle()!.pendingEnemySpawns[0]!.position.row).toBe(CENTER_LANE_INDEX)
    }
  })

  it('quái thường (không Boss) nhận spawnedLane random hợp lệ trong [0, GRID_ROW_COUNT) — không cố định 1 giá trị qua nhiều lần spawn', () => {
    const gameManager = new GameManager()

    const mobTemplate = defineEnemy({
      id: 'lane_test_mob',
      name: 'Mob',
      level: 1,
      realmId: 'qi_refining',
      lane: 'ground',
      statsInput: MINIMAL_STATS_INPUT,
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    const seenLanes = new Set<number>()

    for (let i = 0; i < 100; i++) {
      gameManager.startBattle(createPlayer(), mobTemplate)

      const row = gameManager.getBattle()!.pendingEnemySpawns[0]!.position.row

      expect(row).toBeGreaterThanOrEqual(0)
      expect(row).toBeLessThan(GRID_ROW_COUNT)

      seenLanes.add(row)
    }

    // 100 lần random trên 5 spawnedLane — xác suất TOÀN BỘ đều trùng 1 giá trị
    // gần như bằng 0, nên >1 giá trị khác nhau chứng minh THẬT SỰ random
    // (không phải luôn trả về 1 hằng số cố định).
    expect(seenLanes.size).toBeGreaterThan(1)
  })
})
