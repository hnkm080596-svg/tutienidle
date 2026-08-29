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
import { ailments } from '../../data/ailment/ailments'
import type { CombatEntity } from '../combat/CombatEntity'

// Task 8 (2026-08-28) — SwordZone là bản clone LavaZone nhưng CHARGE-BASED
// (remainingCharges) thay vì time-based (remainingTime): zone hết hạn sau
// N lần tick THẬT SỰ trúng đích, không phải sau N giây. Xem SwordZone.ts.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    defense: 0,
    evasionRate: 0,
    dexterity: 0,
    criticalRate: 0,
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
  const ailmentRegistry = new AilmentRegistry()

  for (const template of ailments) {
    ailmentRegistry.register(template)
  }

  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    ailmentRegistry,
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick }
}

describe('BattleSystem — Sword Zone (Kiếm Trận keystone, charge-based)', () => {
  it('spawnSwordZone thêm 1 zone vào battle.swordZones với đúng field', () => {
    const { system } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', x: 8 })

    system.start(player, enemy)
    system.update(3)

    system.spawnSwordZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      charges: 3,
      tickInterval: 1,
      damagePerTick: 10,
    })

    const zones = system.getBattle()!.swordZones

    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      remainingCharges: 3,
      damagePerTick: 10,
      element: 'metal',
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
    enemyInRange.row = 2
    system.spawnEnemyInto(system.getBattle()!, enemyOutOfRange)

    system.spawnSwordZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      charges: 5,
      tickInterval: 1,
      damagePerTick: 30,
    })

    // Chưa tới tickInterval đầu tiên — chưa damage gì cả.
    tick(0.5)
    expect(enemyInRange.currentHp).toBe(1000)

    // Vừa chạm tickInterval (1s) — tick 1 lần.
    tick(0.5)
    expect(enemyInRange.currentHp).toBeLessThan(1000)
    expect(enemyOutOfRange.currentHp).toBe(1000)
  })

  it('zone tự xoá khỏi battle.swordZones sau khi hết SỐ CHARGE (không phải hết thời gian)', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', x: 8 })

    system.start(player, enemy)
    system.update(3)

    system.spawnSwordZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      charges: 2,
      tickInterval: 1,
      damagePerTick: 10,
    })

    tick(1)
    expect(system.getBattle()!.swordZones).toHaveLength(1)
    expect(system.getBattle()!.swordZones[0]!.remainingCharges).toBe(1)

    tick(1)
    expect(system.getBattle()!.swordZones).toHaveLength(0)
  })

  it('overshoot deltaSeconds lớn vẫn bắt kịp nhiều tick trong 1 update, tiêu hết charge tương ứng', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', x: 8, currentHp: 1000, maxHp: 1000 })

    system.start(player, enemy)
    system.update(3)
    // Spawn telegraph materialize gán lại row/x từ resolver — khôi phục
    // vị trí tác giả (zone row 2 column 8) cùng gotcha ở test trên.
    enemy.x = 8
    enemy.row = 2

    system.spawnSwordZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      charges: 3,
      tickInterval: 1,
      damagePerTick: 10,
    })

    // deltaSeconds = 5 >> tickInterval 1 — while loop phải bắt kịp và
    // tiêu hết cả 3 charge trong đúng 1 lần update(), zone biến mất.
    tick(5)

    expect(system.getBattle()!.swordZones).toHaveLength(0)
    expect(enemy.currentHp).toBeLessThanOrEqual(970)
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

    system.spawnSwordZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      charges: 3,
      tickInterval: 1,
      damagePerTick: 999,
    })

    tick(1.5)

    expect(player.currentHp).toBe(1000)
  })

  it('tickInterval = 0 — không vòng lặp vô hạn, zone vẫn hết charge dần chỉ khi có tick thật (không tick vô hạn)', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy', x: 8, currentHp: 1000, maxHp: 1000 })

    system.start(player, enemy)
    system.update(3)

    system.spawnSwordZone(system.getBattle()!, {
      ownerId: 'player',
      row: 2,
      column: 8,
      laneRadius: 1,
      columnRadius: 1,
      charges: 2,
      tickInterval: 0,
      damagePerTick: 10,
    })

    tick(1)
    // tickInterval 0 bị guard chặn — không tick, zone vẫn còn nguyên charge.
    expect(system.getBattle()!.swordZones).toHaveLength(1)
    expect(system.getBattle()!.swordZones[0]!.remainingCharges).toBe(2)
  })
})
