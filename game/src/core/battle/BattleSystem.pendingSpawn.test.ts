// Spawn telegraph là TRẠNG THÁI GAMEPLAY THẬT (2026-08-24): quái pending
// chưa nằm trong battle.enemies → không target/đỡ đòn/đánh được; hết
// telegraph mới materialize; snapshot positions có spawningEnemies.
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { BattlePositionsEvent } from './BattleEvents'
import type { BattleEnemy } from './Battle'
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT } from './BattleGrid'
import { HERO_GATE_COLUMNS } from './BattleLane'

function createBattleSystem(eventBus = new EventBus()) {
  const skillManager = new SkillManager()

  return new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    new SkillSystem(skillManager),
    new SkillEffectSystem(),
    new BuffRegistry(),
    new AilmentRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )
}

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    evasionRate: 0,
    dexterity: 0,
    attackSpeed: 1,
    attackRange: 60,
    movementSpeed: 60,
    attack: 0,
  }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
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
    row: 2,
    alive: true,
    ...overrides,
  }
}

describe('BattleSystem — spawn telegraph (2026-08-24)', () => {
  it('queueEnemySpawn: entity vào pendingEnemySpawns, KHÔNG vào battle.enemies (không target được)', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.flushPendingSpawns()

    const battle = system.getBattle()!
    const latecomer = createCombatant({ id: 'latecomer' })

    expect(system.queueEnemySpawn(battle, latecomer)).toBe(true)

    // Trạng thái gameplay thật: chưa nằm trong enemies → targeting/AOE/
    // enemy attack (tất cả đọc battle.enemies) không thể chạm tới nó.
    expect(battle.enemies.map((entry) => entry.entity.id)).not.toContain('latecomer')
    expect(battle.pendingEnemySpawns).toHaveLength(1)
    expect(battle.pendingEnemySpawns[0]!.entity.id).toBe('latecomer')
    expect(battle.pendingEnemySpawns[0]!.totalSeconds).toBeCloseTo(0.75, 5)
  })

  it('hết telegraph mới materialize: gán row/column, chuyển sang enemies, emit enemy_spawned', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.flushPendingSpawns()

    const battle = system.getBattle()!
    const latecomer = createCombatant({ id: 'latecomer' })

    let spawnedId = ''

    eventBus.on<{ type: string; targetId: string }>('enemy_spawned', (event) => {
      spawnedId = event.targetId
    })

    expect(system.queueEnemySpawn(battle, latecomer)).toBe(true)

    // 0.5s — chưa đủ telegraph 0.75s.
    system.update(0.5)
    expect(battle.enemies.map((entry) => entry.entity.id)).not.toContain('latecomer')
    expect(spawnedId).toBe('')

    // Đủ nốt 0.3s (tổng 0.8 > 0.75) — materialize.
    system.update(0.3)

    expect(spawnedId).toBe('latecomer')
    expect(battle.enemies).toHaveLength(2)
    expect(battle.pendingEnemySpawns).toHaveLength(0)

    const materialized = battle.enemies.find((entry) => entry.entity.id === 'latecomer')!

    // Row/column gán TỪ ô đã resolve — trong grid, bên phải cổng.
    expect(materialized.entity.row).toBeGreaterThanOrEqual(0)
    expect(materialized.entity.row).toBeLessThan(GRID_ROW_COUNT)
    expect(materialized.entity.x).toBeGreaterThanOrEqual(HERO_GATE_COLUMNS)
    expect(materialized.entity.x).toBeLessThanOrEqual(GRID_COLUMN_COUNT - 1)
  })

  it('snapshot positions chứa spawningEnemies với progress ∈ [0,1] và row/column hợp lệ', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    const snapshots: BattlePositionsEvent[] = []

    eventBus.on<BattlePositionsEvent>('positions', (event) => snapshots.push(event))

    system.start(player, enemy)

    const spawning = snapshots.at(-1)?.spawningEnemies ?? []

    expect(spawning).toHaveLength(1)
    expect(spawning[0]!.id).toBe('enemy')
    expect(spawning[0]!.progress).toBe(0)
    expect(spawning[0]!.row).toBeGreaterThanOrEqual(0)
    expect(spawning[0]!.row).toBeLessThan(GRID_ROW_COUNT)
    expect(spawning[0]!.column).toBeGreaterThanOrEqual(HERO_GATE_COLUMNS)
    expect(spawning[0]!.column).toBeLessThan(GRID_COLUMN_COUNT)

    system.update(0.4)

    const midProgress = snapshots.at(-1)?.spawningEnemies?.[0]?.progress ?? -1

    expect(midProgress).toBeGreaterThan(0.3)
    expect(midProgress).toBeLessThan(1)
  })

  it('flushPendingSpawns: materialize toàn bộ ngay (test tiện ích)', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)

    const battle = system.getBattle()!
    const second = createCombatant({ id: 'second' })

    system.queueEnemySpawn(battle, second)
    system.flushPendingSpawns()

    expect(battle.pendingEnemySpawns).toHaveLength(0)
    expect(battle.enemies.map((entry) => entry.entity.id).sort()).toEqual(['enemy', 'second'])
  })

  it('hết chỗ trống → queueEnemySpawn trả false (caller hoãn), không đè ô đã có', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.flushPendingSpawns()

    const battle = system.getBattle()!

    // Lấp MỌI ô hợp lệ (cột ≥ HERO_GATE_COLUMNS, mọi hàng) bằng "quái".
    for (let row = 0; row < GRID_ROW_COUNT; row++) {
      for (let column = HERO_GATE_COLUMNS; column < GRID_COLUMN_COUNT; column++) {
        battle.enemies.push(createBattleEnemyStub(`filler_${row}_${column}`, row, column))
      }
    }

    const latecomer = createCombatant({ id: 'latecomer' })

    expect(system.queueEnemySpawn(battle, latecomer)).toBe(false)
    expect(battle.pendingEnemySpawns).toHaveLength(0)
    expect(battle.enemies.map((entry) => entry.entity.id)).not.toContain('latecomer')
  })
})

// Stub BattleEnemy tối thiểu — queueEnemySpawn chỉ đọc entity.id/row/x/
// alive để tính occupied cells.
function createBattleEnemyStub(id: string, row: number, column: number): BattleEnemy {
  const entity = { id, row, x: column, alive: true } as unknown as CombatEntity

  return { entity, attackTimer: 0 } as unknown as BattleEnemy
}
