// Spawn telegraph là TRẠNG THÁI GAMEPLAY THẬT: quái pending chưa nằm
// trong battle.enemies → không target/đỡ đòn/đánh được; hết telegraph mới
// materialize; snapshot positions có spawningEnemies. Player CŨNG đi qua
// telegraph riêng (plan §5.3) — overlap hợp lệ, queue luôn thành công.
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
import { GRID_COLUMN_COUNT, GRID_ROW_COUNT } from './BattleGrid'

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
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

describe('BattleSystem — spawn telegraph', () => {
  it('queueEnemySpawn: entity vào pendingEnemySpawns, KHÔNG vào battle.enemies (không target được)', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.flushPendingSpawns()

    const battle = system.getBattle()!
    const latecomer = createCombatant({ id: 'latecomer' })

    // Plan §5.2 — luôn schedule thành công (void), overlap hợp lệ.
    system.queueEnemySpawn(battle, latecomer)

    // Trạng thái gameplay thật: chưa nằm trong enemies → targeting/AOE/
    // enemy attack (tất cả đọc battle.enemies) không thể chạm tới nó.
    expect(battle.enemies.map((entry) => entry.entity.id)).not.toContain('latecomer')
    expect(battle.pendingEnemySpawns).toHaveLength(1)
    expect(battle.pendingEnemySpawns[0]!.entity.id).toBe('latecomer')
    expect(battle.pendingEnemySpawns[0]!.totalSeconds).toBeCloseTo(0.75, 5)
  })

  it('hết telegraph mới materialize: gán row/column từ ô đã resolve, emit enemy_spawned', () => {
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

    system.queueEnemySpawn(battle, latecomer)

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

    // Row/column gán TỪ ô đã resolve — đúng miền spawn plan §5.1.
    expect(materialized.entity.row).toBeGreaterThanOrEqual(0)
    expect(materialized.entity.row).toBeLessThanOrEqual(GRID_ROW_COUNT - 1)
    expect(materialized.entity.x).toBeGreaterThanOrEqual(7)
    expect(materialized.entity.x).toBeLessThanOrEqual(GRID_COLUMN_COUNT - 1)
  })

  it('hai quái có thể cùng vị trí — queue không fail do overlap (plan §5.2)', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.flushPendingSpawns()

    const battle = system.getBattle()!

    for (let i = 0; i < 50; i++) {
      system.queueEnemySpawn(battle, createCombatant({ id: `mob_${i}` }))
    }

    expect(battle.pendingEnemySpawns).toHaveLength(50)
  })

  it('snapshot positions chứa spawningEnemies + playerSpawn với progress ∈ [0,1]', () => {
    const eventBus = new EventBus()
    const system = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    const snapshots: BattlePositionsEvent[] = []

    eventBus.on<BattlePositionsEvent>('positions', (event) => snapshots.push(event))

    system.start(player, enemy)

    const firstSnapshot = snapshots.at(-1)!

    const spawning = firstSnapshot.spawningEnemies ?? []

    expect(spawning).toHaveLength(1)
    expect(spawning[0]!.id).toBe('enemy')
    expect(spawning[0]!.progress).toBe(0)
    expect(spawning[0]!.row).toBeGreaterThanOrEqual(0)
    expect(spawning[0]!.column).toBeGreaterThanOrEqual(7)

    // Telegraph Player tại projected cell (4,1), preset riêng.
    expect(firstSnapshot.playerMaterialized).toBe(false)
    expect(firstSnapshot.playerSpawn?.row).toBe(4)
    expect(firstSnapshot.playerSpawn?.column).toBe(1)
    expect(firstSnapshot.playerSpawn?.presetId).toBe('player_spawn')

    system.update(0.4)

    const midProgress = snapshots.at(-1)?.spawningEnemies?.[0]?.progress ?? -1

    expect(midProgress).toBeGreaterThan(0.3)
    expect(midProgress).toBeLessThan(1)
  })

  it('flushPendingSpawns: materialize toàn bộ ngay kể cả Player (test tiện ích)', () => {
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
    expect(battle.pendingPlayerSpawn).toBeUndefined()
    expect(battle.playerMaterialized).toBe(true)
  })

  it('countdown chỉ chuyển fighting khi countdown về 0 VÀ cả hai phía materialize (plan §5.3)', () => {
    const system = createBattleSystem()
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)

    const battle = system.getBattle()!

    // Đếm 2.5s (< countdown 3s): telegraph đã chạy xong nhưng còn đếm ngược.
    system.update(2.5)

    expect(battle.state).toBe('countdown')

    // Nốt 0.6s (tổng 3.1 > 3): hai telegraph (1.0s/0.75s) đã xong từ trước.
    system.update(0.6)

    expect(battle.state).toBe('fighting')
    expect(battle.playerMaterialized).toBe(true)
  })
})
