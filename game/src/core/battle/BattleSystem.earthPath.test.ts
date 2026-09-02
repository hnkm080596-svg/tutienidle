import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { BuffSystem } from '../buff/BuffSystem'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'

import { createBaseStats } from '../stats/StatBlock'
import { createSkillRuntimeStats } from '../skill/SkillRuntimeStats'
import { buffs } from '../../data/buff/buffs'
import { MAX_THO_THE } from '../combat/CombatTypes'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Plans/EarthPath (2026-08-21) — Thổ Thế tích theo LƯỢT CAST giống Hỏa
// Thế (xem BattleSystem.hoaThe.test.ts), KHÔNG có decay (doc không
// nhắc). Root/AOE/Knockback là 3 mảng THẬT khác cần test riêng ở tầng
// BattleSystem vì đụng resolveMovement()/resolveMissiles(), không chỉ
// đơn thuần stat cộng dồn.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0,
    defense: 0,
    evasionRate: 0,
    dexterity: 0,
    criticalRate: 0,
    // Vô hiệu hoá Endurance (giảm sát thương nhỏ phi tuyến tính) — cần
    // damage scale TUYẾN TÍNH đúng theo multiplier cho test AOE
    // secondary-damage-% (xem BattleSystem.earthPath.test.ts's "AOE +
    // Knockback" describe).
    enduranceThreshold: 0,
    endurancePercent: 0,
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

// tho_cau_thuat (test-only fixture) — chỉ cần đúng field engine thật
// sự đọc: earthPureAreaBehavior (case 'damage' trong
// SkillEffectSystem.ts) + grantsThoThePerCast + execution 'attack_speed'
// (nhịp cast theo Attack Speed qua scheduler thống nhất).
function createThoCauThuat(): Skill {
  return {
    id: 'tho_cau_thuat',
    name: 'Thổ Cầu Thuật (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 1,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical', earthPureAreaBehavior: true }],
    execution: { kind: 'attack_speed' },
    loadoutSlot: 0,
    loadoutSlots: [0],
    resourceType: 'none',
    grantsThoThePerCast: true,
    unlocked: true,
    equipped: true,
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

  const thoCauThuat = createThoCauThuat()

  skillManager.add(thoCauThuat)

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick, thoCauThuat }
}

describe('BattleSystem — Thổ Thế (Plans/EarthPath mục XV, Thổ Thế major)', () => {
  it('chưa mua "Thổ Thế" (thoTheGainPerCast=0, nền createBaseStats()) — cast bao nhiêu cũng không tích Thổ Thế', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    // Đưa quái vào tầm avatar để scheduler thực sự cast (gain nền 0 vẫn
    // phải giữ currentThoThe = 0).
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 320; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentThoThe).toBe(0)
  })

  it('đã mua "Thổ Thế" (thoTheGainPerCast=1) — mỗi lần cast +1, chặn ở MAX_THO_THE, KHÔNG tự giảm', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    player.skillStats = { ...createSkillRuntimeStats(), thoTheGainPerCast: 1 }

    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    // Materialize gán vị trí từ resolver — đưa quái vào tầm avatar
    // (Chebyshev ≤ 1 quanh (4,1)) để scheduler cast mỗi nhịp Attack Speed.
    enemy.x = 2
    enemy.row = 4

    // attackSpeed mặc định 1 -> cast mỗi 1s (+1 Thổ Thế/cast), KHÔNG có
    // decay đối ứng (khác Hỏa Thế) nên PHẢI neo cứng đúng MAX_THO_THE
    // sau đủ lâu, không dao động.
    for (let i = 0; i < 600; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentThoThe).toBe(MAX_THO_THE)
  })
})

function applyRoot(source: CombatEntity, target: CombatEntity, targetBuffs: BuffSystem) {
  const registry = new BuffRegistry()

  for (const definition of buffs) {
    registry.register(definition)
  }

  targetBuffs.apply(registry.get('troi_chan'), source, target, registry)
}

describe('BattleSystem — Trói Chân (Plans/EarthPath mục VI, Root)', () => {
  it('Root chặn resolveMovement() hoàn toàn, kể cả khi ngoài tầm đánh', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy' })

    enemy.stats.attackRange = 10
    enemy.stats.movementSpeed = 1000

    // start() TỰ SET x = ENEMY_SPAWN_X (400) bất kể fixture truyền vào
    // — ghi đè lại SAU start() để mô phỏng "ngoài tầm, lẽ ra phải tiến".
    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 200

    const battleEnemy = system.getBattle()!.enemies[0]!

    applyRoot(player, battleEnemy.entity, new BuffSystem(battleEnemy.buffs))

    for (let i = 0; i < 100; i++) {
      tick(0.01)
    }

    // Ngoài tầm (distance 200 > range 10) LẼ RA phải tiến lại gần —
    // Root chặn hẳn, x giữ nguyên.
    expect(battleEnemy.entity.x).toBe(200)
  })

  it('Root KHÔNG chặn attack — enemy ĐÃ trong tầm vẫn đánh trúng player bình thường', () => {
    const { system, tick } = setup()

    const player = createCombatant({
      id: 'player',
      type: 'player',
      x: 0,
      currentHp: 1000,
      maxHp: 1000,
    })
    const enemy = createCombatant({ id: 'enemy' })

    enemy.stats.attackRange = 10
    enemy.stats.attack = 10

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 2
    enemy.row = 4

    const battleEnemy = system.getBattle()!.enemies[0]!

    applyRoot(player, battleEnemy.entity, new BuffSystem(battleEnemy.buffs))

    for (let i = 0; i < 200; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentHp).toBeLessThan(1000)
  })
})

describe('BattleSystem — AOE + Knockback (Plans/EarthPath mục XVI, Thổ Thế Pure)', () => {
  it('sau khi mua "Thổ Thế": mục tiêu chính 100% damage + đẩy lùi, mục tiêu phụ (trong bán kính) ăn % damage giảm + cũng bị đẩy lùi', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    player.stats.attack = 100
    player.skillStats = {
      ...createSkillRuntimeStats(),
      earthAoeRadius: 2,
      earthAoeSecondaryDamagePercent: 0.5,
      earthKnockbackDistance: 2,
    }

    // enemy2 nằm trong bán kính 50 quanh điểm trúng của enemy1 (gần
    // nhất, mục tiêu chính) — |60 - 50| = 10 <= 50.
    const enemy1 = createCombatant({ id: 'enemy1', currentHp: 100000, maxHp: 100000 })
    const enemy2 = createCombatant({ id: 'enemy2', currentHp: 100000, maxHp: 100000 })

    // start()/spawnEnemyInto() đặt vị trí qua telegraph resolver — ghi
    // đè lại SAU mỗi lệnh để dựng đúng hàng/cột cho AOE (enemy2 cách
    // enemy1 2 cột, cùng row 2, trong bán kính columnRadius 2).
    // movementSpeed=0 (CẢ baseStats — recompute mỗi tick) để knockback
    // là thay đổi vị trí DUY NHẤT, đo đếm được chính xác.
    system.start(player, enemy1)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy1.baseStats = { ...enemy1.baseStats, movementSpeed: 0 }
    enemy1.stats = { ...enemy1.stats, movementSpeed: 0 }
    enemy1.x = 2
    enemy1.row = 2

    system.spawnEnemyInto(system.getBattle()!, enemy2)
    enemy2.baseStats = { ...enemy2.baseStats, movementSpeed: 0 }
    enemy2.stats = { ...enemy2.stats, movementSpeed: 0 }
    enemy2.x = 4

    // (MISSILE_SPEED=500 -> 0.1s) rồi trúng cả 2.
    for (let i = 0; i < 30; i++) {
      tick(0.01)
    }

    const enemy1Damage = 100000 - enemy1.currentHp
    const enemy2Damage = 100000 - enemy2.currentHp

    expect(enemy1Damage).toBeGreaterThan(0)
    // Mục tiêu phụ ăn ĐÚNG 50% damage của mục tiêu chính (defense=0 cả
    // 2 bên nên mitigation=0, tỉ lệ tuyến tính đúng theo multiplier).
    expect(enemy2Damage).toBeCloseTo(enemy1Damage * 0.5, 1)

    // Cả 2 đều bị đẩy lùi xa player (x tăng, vì x ban đầu > player.x=1).
    expect(enemy1.x).toBeCloseTo(4, 5)
    expect(enemy2.x).toBeCloseTo(6, 5)
  })

  it('chưa mua "Thổ Thế" (earthAoeRadius=0) — Thổ Cầu Thuật vẫn bắn đơn mục tiêu như cũ, không AOE/Knockback', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    player.stats.attack = 100

    const enemy1 = createCombatant({ id: 'enemy1', currentHp: 100000, maxHp: 100000 })
    const enemy2 = createCombatant({ id: 'enemy2', currentHp: 100000, maxHp: 100000 })

    system.start(player, enemy1)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy1.x = 2
    enemy1.row = 4

    system.spawnEnemyInto(system.getBattle()!, enemy2)
    enemy2.x = 60

    for (let i = 0; i < 30; i++) {
      tick(0.01)
    }

    expect(enemy1.currentHp).toBeLessThan(100000)
    expect(enemy2.currentHp).toBe(100000)
    expect(enemy1.x).toBe(2)
  })
})
