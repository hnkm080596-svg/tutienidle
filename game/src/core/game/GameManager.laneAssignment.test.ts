import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy, createBossVariant } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import { CENTER_LANE_INDEX } from '../battle/BattleLane'
import { ENEMY_SIDE_REGION, centerOfRegion } from '../battle/BattlefieldRegions'
import type { CombatEntity } from '../combat/CombatEntity'

// Top-down 5-spawnedLane (2026-08-22) — Boss LUÔN đứng spawnedLane giữa (CENTER_LANE_INDEX),
// quái thường random mỗi lần spawn. Gán spawnedLane xảy ra ở GameManager.startBattle()/
// updateStageProgress() (SAU enemyToCombatEntity(), ghi đè placeholder spawnedLane:0 —
// xem Enemy.ts's enemyToCombatEntity()), không phải ở core Enemy/EnemyDefinition.
const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  attack: 0,
  attackSpeed: 1,
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
  it('quái Boss (isBoss:true) LUÔN nhận spawnedLane === trung tâm ENEMY_SIDE_REGION, bất kể EnemyLane authored trong data', () => {
    const gameManager = new GameManager()

    const bossTemplate = defineEnemy({
      id: 'lane_test_boss',
      name: 'Boss',
      level: 1,
      realmId: 'qi_refining',
      // EnemyLane authored 'air' — CỐ TÌNH khác trung tâm vùng địch, chứng
      // minh field authored này không còn quyết định vị trí hiển thị.
      lane: 'air',
      statsInput: MINIMAL_STATS_INPUT,
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    // Battlefield region redesign (spec §6, 2026-09-05) — Boss không còn
    // đứng cùng hàng player (CENTER_LANE_INDEX/HERO_LANE_INDEX) mà LUÔN ở
    // trung tâm ENEMY_SIDE_REGION (xem BattlefieldRegions.ts).
    const expectedBossPosition = centerOfRegion(ENEMY_SIDE_REGION)

    for (let i = 0; i < 30; i++) {
      const boss = createBossVariant(bossTemplate)

      gameManager.startBattle(createPlayer(), boss)

      // Slice 6 cutover: spawn TỨC THỜI trong TurnBattle (không còn telegraph
      // pendingSpawns của hệ real-time) — đọc row từ enemy participant.
      expect(gameManager.getTurnBattle()!.enemies[0]!.entity.row).toBe(expectedBossPosition.row)
      expect(gameManager.getTurnBattle()!.enemies[0]!.entity.x).toBe(expectedBossPosition.column)
    }
  })

  it('quái thường (không Boss) nhận spawnedLane random hợp lệ trong ENEMY_SIDE_REGION — không cố định 1 giá trị qua nhiều lần spawn', () => {
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

      const row = gameManager.getTurnBattle()!.enemies[0]!.entity.row

      expect(row).toBeGreaterThanOrEqual(ENEMY_SIDE_REGION.rowMin)
      expect(row).toBeLessThanOrEqual(ENEMY_SIDE_REGION.rowMax)

      seenLanes.add(row)
    }

    // 100 lần random trên các hàng của ENEMY_SIDE_REGION — xác suất TOÀN BỘ
    // đều trùng 1 giá trị gần như bằng 0, nên >1 giá trị khác nhau chứng
    // minh THẬT SỰ random (không phải luôn trả về 1 hằng số cố định).
    expect(seenLanes.size).toBeGreaterThan(1)
  })
})
