import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { MissileSystem } from '../combat/missile/MissileSystem'
import { MissileManager } from '../combat/missile/MissileManager'
import { createBaseStats } from '../stats/StatBlock'
import { ailments } from '../../data/ailment/ailments'
import type { CombatEntity } from '../combat/CombatEntity'

// Plans/magicpathgeneral Phase 12 (2026-08-21) — Lava Zone: vùng sát
// thương tồn tại ĐỘC LẬP theo vị trí (x), KHÔNG gắn với entity nào.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    defense: 0,
    evasionRate: 0,
    dexterity: 0,
    criticalRate: 0,
    // Loại bỏ HOÀN TOÀN đòn đánh thường tự động (player mặc định
    // attackRange "vô hạn" qua createBaseStats(), enemy dùng chung
    // stats này ở test file — cả 2 phía đều có thể tự bắn nhau nếu
    // không chặn hẳn) — test này CHỈ muốn đo riêng Lava Zone.
    attackRange: 0,
    attackSpeed: 0,
    // Vitality-derived hpRegenPerSecond gây nhiễu số HP chính xác qua
    // nhiều tick (test này cần toBe() chặt, không phải toBeCloseTo()).
    vitality: 0,
    // Bug phát hiện 2026-08-21 — thiếu dòng này khiến resolveMovement()
    // tự đi (movementSpeed mặc định 60 từ createBaseStats()) vì
    // attackRange=0 khiến enemy nghĩ mình luôn "ngoài tầm", đi ra khỏi
    // bán kính Lava Zone TRƯỚC lần tick đầu tiên — false negative im
    // lặng, không liên quan gì tới Lava Zone thật. Zero hẳn movement,
    // đúng tinh thần "test này CHỈ muốn đo riêng Lava Zone" ở trên.
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
    lane: 'ground',
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
    new MissileSystem(new MissileManager(), eventBus),
  )

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick }
}

describe('BattleSystem — Lava Zone (Plans/magicpathgeneral Phase 12)', () => {
  it('spawnLavaZone thêm 1 zone vào battle.lavaZones với đúng field', () => {
    const { system } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', x: 50 })

    system.start(player, enemy)

    system.spawnLavaZone(system.getBattle()!, {
      ownerId: 'player',
      x: 50,
      radius: 20,
      duration: 3,
      tickInterval: 1,
      damagePerTick: 10,
      element: 'fire',
    })

    const zones = system.getBattle()!.lavaZones

    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({ ownerId: 'player', x: 50, radius: 20, remainingTime: 3, damagePerTick: 10 })
  })

  it('gây damage cho enemy TRONG bán kính đúng mỗi tickInterval, KHÔNG damage entity ngoài bán kính', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemyInRange = createCombatant({ id: 'enemy_in', currentHp: 1000, maxHp: 1000 })
    const enemyOutOfRange = createCombatant({ id: 'enemy_out', currentHp: 1000, maxHp: 1000 })

    system.start(player, enemyInRange)
    enemyInRange.x = 55

    system.spawnEnemyInto(system.getBattle()!, enemyOutOfRange)
    enemyOutOfRange.x = 500

    system.spawnLavaZone(system.getBattle()!, {
      ownerId: 'player',
      x: 50,
      radius: 20,
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
    expect(enemyOutOfRange.currentHp).toBe(1000)
  })

  it('zone tự xoá khỏi battle.lavaZones sau khi hết duration', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', x: 50 })

    system.start(player, enemy)

    system.spawnLavaZone(system.getBattle()!, {
      ownerId: 'player',
      x: 50,
      radius: 20,
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

  it('zone của player KHÔNG bao giờ damage player, kể cả nếu player đứng trong bán kính', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 50, currentHp: 1000, maxHp: 1000 })
    const enemy = createCombatant({ id: 'enemy', x: 500 })

    system.start(player, enemy)
    player.x = 50

    system.spawnLavaZone(system.getBattle()!, {
      ownerId: 'player',
      x: 50,
      radius: 20,
      duration: 3,
      tickInterval: 1,
      damagePerTick: 999,
      element: 'fire',
    })

    tick(1.5)

    expect(player.currentHp).toBe(1000)
  })
})
