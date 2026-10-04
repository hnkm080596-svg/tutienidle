import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy, createBossVariant } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import { CENTER_LANE_INDEX } from '../battle/BattleLane'
import { ENEMY_SIDE_REGION, centerOfRegion } from '../battle/BattlefieldRegions'
import type { CombatEntity } from '../combat/CombatEntity'

// Top-down 5-spawnedLane (2026-08-22) - Boss LUON dung spawnedLane giua (CENTER_LANE_INDEX),
// quai thuong random moi lan spawn. Gan spawnedLane xay ra o GameManager.startBattle()/
// updateStageProgress() (SAU enemyToCombatEntity(), ghi de placeholder spawnedLane:0 -
// xem Enemy.ts's enemyToCombatEntity()), khong phai o core Enemy/EnemyDefinition.
const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 0 })

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
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
      // EnemyLane authored 'air' - CO TINH khac trung tam vung dich, chung
      // minh field authored nay khong con quyet dinh vi tri hien thi.
      lane: 'air',
      statsInput: MINIMAL_STATS_INPUT,
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })

    // Battlefield region redesign (spec sec6, 2026-09-05) - Boss khong con
    // dung cung hang player (CENTER_LANE_INDEX/HERO_LANE_INDEX) ma LUON o
    // trung tam ENEMY_SIDE_REGION (xem BattlefieldRegions.ts).
    const expectedBossPosition = centerOfRegion(ENEMY_SIDE_REGION)

    for (let i = 0; i < 30; i++) {
      const boss = createBossVariant(bossTemplate)

      gameManager.startBattle(createPlayer(), boss)

      // Slice 6 cutover: spawn TUC THOI trong TurnBattle (khong con telegraph
      // pendingSpawns cua he real-time) - doc row tu enemy participant.
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
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })

    const seenLanes = new Set<number>()

    for (let i = 0; i < 100; i++) {
      gameManager.startBattle(createPlayer(), mobTemplate)

      const row = gameManager.getTurnBattle()!.enemies[0]!.entity.row

      expect(row).toBeGreaterThanOrEqual(ENEMY_SIDE_REGION.rowMin)
      expect(row).toBeLessThanOrEqual(ENEMY_SIDE_REGION.rowMax)

      seenLanes.add(row)
    }

    // 100 lan random tren cac hang cua ENEMY_SIDE_REGION - xac suat TOAN BO
    // deu trung 1 gia tri gan nhu bang 0, nen >1 gia tri khac nhau chung
    // minh THAT SU random (khong phai luon tra ve 1 hang so co dinh).
    expect(seenLanes.size).toBeGreaterThan(1)
  })
})
