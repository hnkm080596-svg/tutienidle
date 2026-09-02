import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'

// Combat Grid Rework (2026-08-24) — Lava Zone là GRID AREA
// {row, column, laneRadius, columnRadius}, tick mọi entity phe đối lập
// đang chiếm ô trong vùng. Vẫn tồn tại ĐỘC LẬP với entity (ownerId chỉ
// xác định "phe"), damage đi qua applyDotDamage như cũ.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    defense: 0,
    evasionRate: 0,
    dexterity: 0,
    criticalRate: 0,
    // Chặn đòn thường tự động 2 phía — test này CHỈ đo Lava Zone.
    attackRange: 0,
    attackSpeed: 0,
    vitality: 0,
    movementSpeed: 0,
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

function setup() {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick }
}

describe('BattleSystem — Lava Zone trên grid (Combat Grid Rework)', () => {
  it('spawnLavaZone thêm 1 zone vào battle.lavaZones với đúng field', () => {
    const { system } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', x: 8 })

    system.start(player, enemy)
    system.update(3)

    system.spawnLavaZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      duration: 3,
      tickInterval: 1,
      damagePerTick: 10,
      element: 'fire',
    })

    const zones = system.getBattle()!.lavaZones

    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      remainingTime: 3,
      damagePerTick: 10,
    })
  })

  it('gây damage cho enemy TRONG vùng đúng mỗi tickInterval, KHÔNG trúng entity ngoài vùng', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemyInRange = createCombatant({ id: 'enemy_in', x: 8, currentHp: 1000, maxHp: 1000 })
    const enemyOutOfRange = createCombatant({
      id: 'enemy_out',
      x: 12,
      row: 3,
      currentHp: 1000,
      maxHp: 1000,
    })

    system.start(player, enemyInRange)
    system.update(3)
    enemyInRange.x = 8
    // Spawn telegraph (2026-08-24): materialize gán row từ resolver —
    // khôi phục row tác giả (zone row 2, laneRadius 1 cần row 1..3).
    enemyInRange.row = 2
    system.spawnEnemyInto(system.getBattle()!, enemyOutOfRange)

    system.spawnLavaZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      duration: 5,
      tickInterval: 1,
      damagePerTick: 30,
      element: 'fire',
    })

    // Chưa tới tickInterval đầu tiên — chưa damage gì cả.
    tick(0.5)
    expect(enemyInRange.currentHp).toBe(1000)

    // Vừa chạm tickInterval (1s) — tick 1 lần.
    tick(0.5)
    expect(enemyInRange.currentHp).toBeLessThan(1000)
    // Ngoài laneRadius (row 3 vs zone row 2 ±1 vẫn trong...) — dùng row ngoài: đặt lại bằng cách kiểm tra cột xa.
    expect(enemyOutOfRange.currentHp).toBe(1000)
  })

  it('zone tự xoá khỏi battle.lavaZones sau khi hết duration', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', x: 8 })

    system.start(player, enemy)
    system.update(3)

    system.spawnLavaZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      duration: 2,
      tickInterval: 1,
      damagePerTick: 10,
      element: 'fire',
    })

    tick(1)
    expect(system.getBattle()!.lavaZones).toHaveLength(1)

    tick(1.5)
    expect(system.getBattle()!.lavaZones).toHaveLength(0)
  })

  it('zone của player KHÔNG bao giờ damage player, kể cả nếu player đứng trong vùng', () => {
    const { system, tick } = setup()

    const player = createCombatant({
      id: 'player',
      type: 'player',
      x: 8,
      currentHp: 1000,
      maxHp: 1000,
    })
    const enemy = createCombatant({ id: 'enemy', x: 9 })

    system.start(player, enemy)
    system.update(3)

    system.spawnLavaZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      duration: 3,
      tickInterval: 1,
      damagePerTick: 999,
      element: 'fire',
    })

    tick(1.5)

    expect(player.currentHp).toBe(1000)
  })

  it('tickInterval = 0 — không vòng lặp vô hạn, zone vẫn hết hạn bình thường', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', x: 8, currentHp: 1000, maxHp: 1000 })

    system.start(player, enemy)
    system.update(3)

    system.spawnLavaZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      duration: 2,
      tickInterval: 0,
      damagePerTick: 10,
      element: 'fire',
    })

    tick(1)
    expect(system.getBattle()!.lavaZones).toHaveLength(1)

    tick(1.5)
    expect(system.getBattle()!.lavaZones).toHaveLength(0)
  })
})
