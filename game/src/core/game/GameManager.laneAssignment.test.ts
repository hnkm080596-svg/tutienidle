import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy, createBossVariant } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import { LANE_COUNT, HERO_LANE_INDEX } from '../battle/BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'

// Top-down 5-lane (2026-08-22) — Boss LUÔN đứng lane giữa (HERO_LANE_INDEX),
// quái thường random mỗi lần spawn. Gán lane xảy ra ở GameManager.startBattle()/
// updateStageProgress() (SAU enemyToCombatEntity(), ghi đè placeholder lane:0 —
// xem Enemy.ts's enemyToCombatEntity()), không phải ở core Enemy/EnemyDefinition.
const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  attack: 0,
  attackSpeed: 1,
  movementSpeed: 60,
  attackRange: 90,
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
    currentRage: 0,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    lane: HERO_LANE_INDEX,
    alive: true,
  }
}

describe('GameManager — lane assignment (top-down 5-lane, 2026-08-22)', () => {
  it('quái Boss (isBoss:true) LUÔN nhận lane === HERO_LANE_INDEX, bất kể EnemyLane authored trong data', () => {
    const gameManager = new GameManager()

    const bossTemplate = defineEnemy({
      id: 'lane_test_boss',
      name: 'Boss',
      level: 1,
      realmId: 'qi_refining',
      // EnemyLane authored 'air' — CỐ TÌNH khác HERO_LANE_INDEX, chứng
      // minh field authored này không còn quyết định vị trí hiển thị.
      lane: 'air',
      statsInput: MINIMAL_STATS_INPUT,
      rewards: { experience: 0, cultivation: 0, spiritStone: 0 },
    })

    for (let i = 0; i < 30; i++) {
      const boss = createBossVariant(bossTemplate)

      gameManager.startBattle(createPlayer(), boss)

      expect(gameManager.getBattle()!.enemies[0]!.entity.lane).toBe(HERO_LANE_INDEX)
    }
  })

  it('quái thường (không Boss) nhận lane random hợp lệ trong [0, LANE_COUNT) — không cố định 1 giá trị qua nhiều lần spawn', () => {
    const gameManager = new GameManager()

    const mobTemplate = defineEnemy({
      id: 'lane_test_mob',
      name: 'Mob',
      level: 1,
      realmId: 'qi_refining',
      lane: 'ground',
      statsInput: MINIMAL_STATS_INPUT,
      rewards: { experience: 0, cultivation: 0, spiritStone: 0 },
    })

    const seenLanes = new Set<number>()

    for (let i = 0; i < 100; i++) {
      gameManager.startBattle(createPlayer(), mobTemplate)

      const lane = gameManager.getBattle()!.enemies[0]!.entity.lane

      expect(lane).toBeGreaterThanOrEqual(0)
      expect(lane).toBeLessThan(LANE_COUNT)

      seenLanes.add(lane)
    }

    // 100 lần random trên 5 lane — xác suất TOÀN BỘ đều trùng 1 giá trị
    // gần như bằng 0, nên >1 giá trị khác nhau chứng minh THẬT SỰ random
    // (không phải luôn trả về 1 hằng số cố định).
    expect(seenLanes.size).toBeGreaterThan(1)
  })
})
