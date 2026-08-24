import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'


import { createBaseStats } from '../stats/StatBlock'
import { createSkillRuntimeStats } from '../skill/SkillRuntimeStats'
import { ailments } from '../../data/ailment/ailments'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Plans/magicpathgeneral Phase 13 (2026-08-21) — Huyết Phá: charge ĐỘC
// LẬP với Kim Thế (cùng điều kiện roll, xem BattleSystem.kimPath.test.ts's
// ghi chú), chạm MAX_HUYET_PHA thì consume/reset + burst damage.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0, evasionRate: 0, dexterity: 0, criticalRate: 0 }

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

function createDiemKimThuat(): Skill {
  return {
    id: 'diem_kim_thuat',
    name: 'Điểm Kim Thuật (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 1,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'ailment', ailmentId: 'chay_mau', ailmentChance: 1, grantsKimThePerProc: true, grantsHuyetPhaPerProc: true }],
    isBasicAttack: true,
    resourceType: 'none',
    unlocked: true,
    equipped: true,
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

  const diemKimThuat = createDiemKimThuat()

  skillManager.add(diemKimThuat)

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick, diemKimThuat }
}

describe('BattleSystem — Huyết Phá (Plans/magicpathgeneral Phase 13)', () => {
  it('chưa mua "Huyết Phá" (huyetPhaGainPerProc=0) — proc bao nhiêu cũng không tích charge', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', x: 50 })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay

    for (let i = 0; i < 320; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentHuyetPha ?? 0).toBe(0)
  })

  it('đã mua "Huyết Phá" — mỗi proc THÀNH CÔNG +1 charge, ĐỘC LẬP với currentKimThe', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    player.skillStats = { ...createSkillRuntimeStats(), huyetPhaGainPerProc: 1 }
    // kimTheGainPerProc CỐ TÌNH để 0 — chứng minh 2 counter tách biệt
    // hoàn toàn, không tăng chung.

    const enemy = createCombatant({ id: 'enemy', x: 50 })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 5 // start() ghi đè x=400 > SCREEN_VISIBLE_MAX_X(350) — đặt lại trong tầm nhìn.

    // remainingCooldown khởi tạo 0 -> cast NGAY ở t=0, rồi mỗi 1s tiếp
    // theo (attackSpeed mặc định 1) -> t=0,1,2 = 3 lần cast trong 2.5s
    // (dừng TRƯỚC lần cast thứ 4 ở t=3). ailmentChance=1 -> proc LUÔN
    // thành công. 3 < ngưỡng 5 -> chưa burst, còn tích.
    for (let i = 0; i < 250; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentHuyetPha).toBe(3)
    expect(system.getBattle()!.player.currentKimThe).toBe(0)
  })

  it('chạm đủ MAX_HUYET_PHA — consume về 0 + burst damage lên target qua DOT RES', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    player.skillStats = { ...createSkillRuntimeStats(), huyetPhaGainPerProc: 1, huyetPhaBurstDamage: 100 }

    const enemy = createCombatant({ id: 'enemy', x: 50, currentHp: 1000, maxHp: 1000 })

    enemy.stats.dotResistancePercent = 0.2

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 5 // start() ghi đè x=400 > SCREEN_VISIBLE_MAX_X(350) — đặt lại trong tầm nhìn.

    // t=0,1,2,3,4 = ĐÚNG 5 lần cast trong 4.5s (dừng TRƯỚC lần cast
    // thứ 6 ở t=5) — chạm MAX_HUYET_PHA đúng ở lần cast thứ 5, burst
    // kích hoạt NGAY trong lần cast đó rồi reset về 0.
    for (let i = 0; i < 450; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentHuyetPha).toBe(0)

    // 100 raw × (1 - 0.2 dotResistancePercent) = 80 — đi qua ĐÚNG
    // pipeline applyDotDamage(), KHÔNG bỏ qua DOT RES như true damage.
    // Dùng khoảng thay vì toBeCloseTo chặt — harness dùng chung attack
    // range/attackSpeed mặc định của createBaseStats() nên có thể có
    // thêm vài damage vặt KHÔNG liên quan Huyết Phá (đòn đánh thường
    // nền, tối thiểu 1 damage/đòn) trong 4.5s test chạy; điều quan
    // trọng cần chứng minh là: có mất máu (burst thật sự nổ) VÀ mất ít
    // hơn 100 (chứng minh DOT RES CÓ áp dụng, không bỏ qua như true
    // damage).
    const enemyHp = system.getBattle()!.enemies[0]!.entity.currentHp

    expect(enemyHp).toBeLessThan(1000 - 80 + 5)
    expect(enemyHp).toBeGreaterThan(1000 - 100)
  })

  it('huyetPhaBurstDamage=0 (chưa mua node cấp burst) — charge vẫn reset về 0 khi chạm ngưỡng, nhưng KHÔNG damage', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    player.skillStats = { ...createSkillRuntimeStats(), huyetPhaGainPerProc: 1 }
    // huyetPhaBurstDamage nền 0 — node "Huyết Phá" cấp CẢ HAI stat cùng
    // lúc trong data thật, nhưng engine phải xử lý đúng dù 1 trong 2
    // stat vẫn 0 (test riêng phần logic, không phụ thuộc data node).

    const enemy = createCombatant({ id: 'enemy', x: 50, currentHp: 1000, maxHp: 1000 })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 5 // start() ghi đè x=400 > SCREEN_VISIBLE_MAX_X(350) — đặt lại trong tầm nhìn.

    // Cùng timing 4.5s/5 lần cast như test trên.
    for (let i = 0; i < 450; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentHuyetPha).toBe(0)

    // Không dùng toBe(1000) chặt — cùng lý do damage vặt KHÔNG liên
    // quan Huyết Phá đã ghi chú ở test trên. Quan trọng là KHÔNG mất
    // gần 100 HP (burst KHÔNG xảy ra vì huyetPhaBurstDamage=0).
    expect(system.getBattle()!.enemies[0]!.entity.currentHp).toBeGreaterThan(990)
  })
})
