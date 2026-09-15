// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { StageWaveSystem } from './StageWaveSystem'

// Auto-farm spec Task 4 — cycle reward roll (online tick, KHÔNG chạy trận
// thật KHÔNG hoạt ảnh). Seed perfectClear* trực tiếp (record flow là việc
// Task 3 đang treo — độc lập với cơ chế roll).

const DUMMY = defineEnemy({
  id: 'farm_dummy', name: 'Farm Dummy', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 10, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueInsight: 0, spiritStone: 5 },
})

const FARM_STAGE: Stage = {
  id: 'farm_stage',
  name: 'Farm Stage',
  description: '',
  floor: 1,
  enemyPool: [{ enemyId: DUMMY.id, weight: 1 }],
  totalEnemyCount: 2, waves: [2],
  spawnIntervalSeconds: 0,
}

// Spec v3 D5 (2026-09-11) — same farm stage shape but the pool entry
// carries eliteChance: without the allowTags:false gate a forced hit
// would tag the idle spawn.
const TAGGED_FARM_STAGE: Stage = {
  id: 'farm_tagged_stage',
  name: 'Farm Tagged Stage',
  description: '',
  floor: 1,
  enemyPool: [{ enemyId: DUMMY.id, weight: 1, eliteChance: 0.1 }],
  totalEnemyCount: 2, waves: [2],
  spawnIntervalSeconds: 0,
}

function harness(stage: Stage = FARM_STAGE) {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()

  // Seed perfect-clear state trực tiếp (bypass Task 3 record).
  player.perfectClearStageIds.push(stage.id)
  player.perfectClearSeconds[stage.id] = 100 // cycleSeconds = 50

  gameManager.catalogOps.registerEnemyTemplates([DUMMY])
  gameManager.catalogOps.registerStages([stage])
  gameManager.setActivePlayer(player)

  return { gameManager, player }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('GameManager — auto-farm start/stop exclusivity', () => {
  it('startAutoFarm fail với stage chưa Hoàn Mỹ', () => {
    const { gameManager, player } = harness()

    player.perfectClearStageIds.length = 0

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, 'farm_stage')).toBe(false)
    expect(player.autoFarmStage).toBeNull()
  })

  it('startAutoFarm thành công với stage đã Hoàn Mỹ + đặt autoFarmStage', () => {
    const { gameManager, player } = harness()

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)).toBe(true)
    expect(player.autoFarmStage?.stageId).toBe(FARM_STAGE.id)
    expect(typeof player.autoFarmStage?.lastCheckedMs).toBe('number')
  })

  it('startAutoFarm fail khi StageManager đang có stage active', () => {
    const { gameManager, player } = harness()
    player.baseStats = asBaseStats({ ...player.baseStats,  })

    gameManager.turnBattleOps.startStage(player, FARM_STAGE, false)

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)).toBe(false)
  })

  it('stopAutoFarm clear autoFarmStage + giải phóng StageManager slot', () => {
    const { gameManager, player } = harness()

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)).toBe(true)

    gameManager.turnBattleOps.autoFarmOps.stopAutoFarm(player)

    expect(player.autoFarmStage).toBeNull()
    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)).toBe(true)
  })
})

describe('GameManager — auto-farm cycle reward rolling', () => {
  it('roll reward khi cycleSeconds/2 trôi qua; leftover carry-over (lastCheckedMs cộng đúng phần đã roll)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))

    const { gameManager, player } = harness()

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)).toBe(true)

    // Trôi 60s = 1 full cycle (cycleSeconds 50 → half 50s? KHÔNG —
    // spec: cycle = perfectClearSeconds/2 = 50s → 60s = 1 cycle + 10s dư).
    vi.setSystemTime(new Date('2026-09-04T10:01:00Z'))

    gameManager.tickOps.update(0.1)

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

    gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, FARM_STAGE.id)

    vi.setSystemTime(new Date('2026-09-04T10:05:00Z'))

    gameManager.tickOps.update(0.1)

    expect(gameManager.getTurnBattle()).toBeNull()
  })

  // Spec v3 D5 — the idle channel passes allowTags:false: a forced
  // eliteChance hit must NOT tag the spawn (no 'Tinh Anh ' prefix, no
  // isElite flag). Spied on the prototype to observe the picked
  // templates rollAutoFarmCycleReward consumed.
  it('idle auto-farm spawn never carries the tinh_anh tag even when the roll would hit', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T10:00:00Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const pickSpy = vi.spyOn(StageWaveSystem.prototype, 'pickEnemyForTurnSpawn')

    const { gameManager, player } = harness(TAGGED_FARM_STAGE)

    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, TAGGED_FARM_STAGE.id)).toBe(true)

    // 60s elapsed = 1 full cycle (cycle = perfectClearSeconds/2 = 50s).
    vi.setSystemTime(new Date('2026-09-04T10:01:00Z'))
    gameManager.tickOps.update(0.1)

    expect(pickSpy).toHaveBeenCalled()
    for (const result of pickSpy.mock.results) {
      const template = result.value
      if (!template) continue
      expect(template.name.startsWith('Tinh Anh')).toBe(false)
      expect(template.isElite).toBeFalsy()
    }
  })
})
