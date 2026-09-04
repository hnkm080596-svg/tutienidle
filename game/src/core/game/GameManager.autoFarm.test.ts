// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'

// Auto-farm spec Task 4 — cycle reward roll (online tick, KHÔNG chạy trận
// thật KHÔNG hoạt ảnh). Seed perfectClear* trực tiếp (record flow là việc
// Task 3 đang treo — độc lập với cơ chế roll).

const DUMMY = defineEnemy({
  id: 'farm_dummy', name: 'Farm Dummy', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 10, attack: 0, attackSpeed: 1, attackRangeRanks: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 0, spiritStone: 5 },
})

const FARM_STAGE: Stage = {
  id: 'farm_stage',
  name: 'Farm Stage',
  description: '',
  floor: 1,
  enemyPool: [{ enemyId: DUMMY.id, weight: 1 }],
  totalEnemyCount: 2,
  spawnIntervalSeconds: 0,
}

function harness() {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()

  // Seed perfect-clear state trực tiếp (bypass Task 3 record).
  player.perfectClearStageIds.push(FARM_STAGE.id)
  player.perfectClearSeconds[FARM_STAGE.id] = 100 // cycleSeconds = 50

  gameManager.registerEnemyTemplates([DUMMY])
  gameManager.registerStages([FARM_STAGE])
  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('GameManager — auto-farm start/stop exclusivity', () => {
  it('startAutoFarm fail với stage chưa Hoàn Mỹ', () => {
    const { gameManager, player } = harness()

    player.perfectClearStageIds.length = 0

    expect(gameManager.startAutoFarm(player, 'farm_stage')).toBe(false)
    expect(player.autoFarmStage).toBeNull()
  })

  it('startAutoFarm thành công với stage đã Hoàn Mỹ + đặt autoFarmStage', () => {
    const { gameManager, player } = harness()

    expect(gameManager.startAutoFarm(player, FARM_STAGE.id)).toBe(true)
    expect(player.autoFarmStage?.stageId).toBe(FARM_STAGE.id)
    expect(typeof player.autoFarmStage?.lastCheckedMs).toBe('number')
  })

  it('startAutoFarm fail khi StageManager đang có stage active', () => {
    const { gameManager, player } = harness()
    const stats = calculateStats({ ...player.baseStats }, [])

    gameManager.startStage(player, stats, FARM_STAGE, false)

    expect(gameManager.startAutoFarm(player, FARM_STAGE.id)).toBe(false)
  })

  it('stopAutoFarm clear autoFarmStage + giải phóng StageManager slot', () => {
    const { gameManager, player } = harness()

    expect(gameManager.startAutoFarm(player, FARM_STAGE.id)).toBe(true)

    gameManager.stopAutoFarm(player)

    expect(player.autoFarmStage).toBeNull()
    expect(gameManager.startAutoFarm(player, FARM_STAGE.id)).toBe(true)
  })
})

describe('GameManager — auto-farm cycle reward rolling', () => {
  it('roll reward khi cycleSeconds/2 trôi qua; leftover carry-over (lastCheckedMs cộng đúng phần đã roll)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { gameManager, player } = harness()

    expect(gameManager.startAutoFarm(player, FARM_STAGE.id)).toBe(true)

    // Trôi 60s = 1 full cycle (cycleSeconds 50 → half 50s? KHÔNG —
    // spec: cycle = perfectClearSeconds/2 = 50s → 60s = 1 cycle + 10s dư).
    vi.setSystemTime(new Date('2026-09-04T10:01:00Z'))

    gameManager.update(0.1)

    // 1 cycle hoàn thành → reward roll cho totalEnemyCount quái × spiritStone 5.
    const summary = gameManager.getBattleRewardSummary()

    expect(summary.spiritStone).toBeGreaterThan(0)
    // Leftover carry-over: lastCheckedMs tiến ĐÚNG 50_000ms (không reset).
    expect(player.autoFarmStage?.lastCheckedMs).toBe(Date.parse('2026-09-04T10:00:50Z'))
  })

  it('KHÔNG chạy TurnBattleSystem/spawn trận visible khi auto-farm', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { gameManager, player } = harness()

    gameManager.startAutoFarm(player, FARM_STAGE.id)

    vi.setSystemTime(new Date('2026-09-04T10:05:00Z'))

    gameManager.update(0.1)

    expect(gameManager.getTurnBattle()).toBeNull()
  })
})
