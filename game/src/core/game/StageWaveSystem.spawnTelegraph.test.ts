// StageWaveSystem × spawn telegraph (plan §5.2):
// - "Còn trên sân" = active enemies + pending spawns → pending chặn
//   victory sớm VÀ chặn wave sau đặt lịch ồ ạt khi telegraph đang chạy.
// - Overlap hợp lệ → queueEnemySpawn LUÔN thành công (void), không còn
//   nhánh "hết chỗ → hoãn".
import { describe, expect, it, vi } from 'vitest'
import { StageWaveSystem, type StageWaveSystemDeps } from './StageWaveSystem'
import type { Battle, PendingEnemySpawn } from '../battle/Battle'
import type { Stage } from '../stage/Stage'
import type { CombatEntity } from '../combat/CombatEntity'

// enemyToCombatEntity cần Enemy đầy đủ — test này chỉ quan tâm luồng
// đặt lịch, mock identity pass-through.
vi.mock('../enemy/Enemy', () => ({
  enemyToCombatEntity: (enemy: unknown) => enemy,
  createEliteVariant: (enemy: unknown) => enemy,
  createBossVariant: (enemy: unknown) => enemy,
}))

function createPending(id: string): PendingEnemySpawn {
  return {
    entity: { id, alive: true } as unknown as CombatEntity,
    position: { row: 4, column: 8 },
    remainingSeconds: 0.5,
    totalSeconds: 0.75,
    presetId: 'enemy_spawn',
  }
}

function createDeps(battle: Battle) {
  const active = { stageId: 'stage_1', spawnedCount: 0, spawnCountdown: 0 }
  const stage: Stage = {
    id: 'stage_1',
    name: 'Stage',
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: 'mob', weight: 1 }],
    totalEnemyCount: 2,
    spawnIntervalSeconds: 1,
  }

  const queueEnemySpawn = vi.fn(() => undefined)

  const deps: StageWaveSystemDeps = {
    eventBus: {
      emit: vi.fn(),
    } as unknown as StageWaveSystemDeps['eventBus'],
    battleSystem: {
      getBattle: () => battle,
      queueEnemySpawn,
    } as unknown as StageWaveSystemDeps['battleSystem'],
    enemySystem: {
      spawn: vi.fn(() => ({ id: 'spawned' })),
    } as unknown as StageWaveSystemDeps['enemySystem'],
    stageManager: {
      get: () => active,
      stop: vi.fn(),
      restartCycle: vi.fn(() => false),
    } as unknown as StageWaveSystemDeps['stageManager'],
    stageSystem: {
      pickNextEnemyEntry: vi.fn(() => ({ enemyId: 'mob', weight: 1, eliteChance: 0 })),
    } as unknown as StageWaveSystemDeps['stageSystem'],
    stageTemplates: {
      get: () => stage,
    } as unknown as StageWaveSystemDeps['stageTemplates'],
    enemyTemplates: {
      get: () => ({ id: 'mob' }),
    } as unknown as StageWaveSystemDeps['enemyTemplates'],
    isStageUnlocked: () => true,
    launchBattle: vi.fn(),
    hiddenBeast: {
      isWindowOpen: () => false,
      maybeReplaceSpawn: vi.fn(() => undefined),
      onEnemyDefeated: vi.fn(),
    } as unknown as StageWaveSystemDeps['hiddenBeast'],
  }

  return { deps, active, stage, queueEnemySpawn }
}

describe('StageWaveSystem — pending spawn telegraph', () => {
  it('pending chặn victory sớm: spawnedCount đủ + enemies rỗng nhưng còn telegraph → chưa victory', () => {
    const battle = {
      state: 'fighting',
      enemies: [],
      pendingEnemySpawns: [createPending('incoming')],
      pendingSummons: [],
    } as unknown as Battle

    const { deps, active } = createDeps(battle)

    active.spawnedCount = 2 // đã đặt lịch đủ 2/2

    const system = new StageWaveSystem(deps)

    system.update(0.1)

    expect(battle.state).toBe('fighting')
    expect(deps.eventBus.emit).not.toHaveBeenCalledWith(
      'battle_end',
      expect.objectContaining({ state: 'victory' }),
    )
  })

  it('spawn mới chỉ đặt lịch KHI telegraph trước đó xong (pending chặn fast-spawn sân "trống" giả)', () => {
    const battle = {
      state: 'fighting',
      enemies: [],
      pendingEnemySpawns: [createPending('incoming')],
      pendingSummons: [],
    } as unknown as Battle

    const { deps, active, queueEnemySpawn } = createDeps(battle)

    active.spawnedCount = 0
    active.spawnCountdown = 0.5 // giữa nhịp — nhịp spawn CHƯA tới

    const system = new StageWaveSystem(deps)

    system.update(0.1)

    // Sân "trống" giả (0 active) nhưng telegraph pending đang chạy →
    // KHÔNG được fast-spawn thêm (aliveCount gồm pending).
    expect(queueEnemySpawn).not.toHaveBeenCalled()
    expect(active.spawnedCount).toBe(0)
  })

  it('nhịp spawn tới khi telegraph trước còn chạy → vẫn đặt lịch 1 lượt (overlap hợp lệ, plan §5.2)', () => {
    const battle = {
      state: 'fighting',
      enemies: [],
      pendingEnemySpawns: [createPending('incoming')],
      pendingSummons: [],
    } as unknown as Battle

    const { deps, active } = createDeps(battle)

    deps.battleSystem.queueEnemySpawn = vi.fn(() => {
      battle.pendingEnemySpawns.push(createPending(`spawned_${battle.pendingEnemySpawns.length}`))

      return undefined
    }) as unknown as StageWaveSystemDeps['battleSystem']['queueEnemySpawn']

    active.spawnedCount = 0
    active.spawnCountdown = 0 // nhịp spawn đã tới

    const system = new StageWaveSystem(deps)

    system.update(0.1)

    // Đúng MỘT lượt đặt lịch/tick — lượt kế chờ nhịp mới.
    expect(deps.battleSystem.queueEnemySpawn).toHaveBeenCalledTimes(1)
    expect(active.spawnedCount).toBe(1)
    expect(active.spawnCountdown).toBe(1)

    system.update(0.1)

    expect(deps.battleSystem.queueEnemySpawn).toHaveBeenCalledTimes(1)
  })

  it('đặt lịch luôn thành công (overlap hợp lệ) → spawnedCount tăng đúng 1 lượt/tick, reset nhịp spawn', () => {
    const battle = {
      state: 'fighting',
      enemies: [],
      pendingEnemySpawns: [],
      pendingSummons: [],
    } as unknown as Battle

    const { deps, active } = createDeps(battle)

    // Mock có side-effect thật: push vào pendingEnemySpawns (giống
    // BattleSystem.queueEnemySpawn) để aliveCount tick kế phản ánh đúng.
    deps.battleSystem.queueEnemySpawn = vi.fn(() => {
      battle.pendingEnemySpawns.push(createPending(`spawned_${battle.pendingEnemySpawns.length}`))

      return undefined
    }) as unknown as StageWaveSystemDeps['battleSystem']['queueEnemySpawn']

    active.spawnedCount = 0
    active.spawnCountdown = 0

    const system = new StageWaveSystem(deps)

    system.update(0.1)

    expect(deps.battleSystem.queueEnemySpawn).toHaveBeenCalledTimes(1)
    expect(active.spawnedCount).toBe(1)
    expect(active.spawnCountdown).toBe(1)

    // Nhịp mới chưa tới → không spawn thêm.
    system.update(0.1)

    expect(deps.battleSystem.queueEnemySpawn).toHaveBeenCalledTimes(1)
    expect(active.spawnedCount).toBe(1)
  })

  it('boss summon: mọi id được đặt lịch (overlap hợp lệ), pendingSummons dọn sạch', () => {
    const battle = {
      state: 'fighting',
      enemies: [],
      pendingEnemySpawns: [],
      pendingSummons: ['wolf_1', 'wolf_2'],
    } as unknown as Battle

    const { deps, queueEnemySpawn } = createDeps(battle)

    const system = new StageWaveSystem(deps)

    system.resolveBossSummons()

    expect(queueEnemySpawn).toHaveBeenCalledTimes(2)
    expect(battle.pendingSummons).toEqual([])
  })
})
