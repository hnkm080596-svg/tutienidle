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
import { MAX_KIM_THE, KIM_THE_DECAY_INTERVAL_SECONDS } from '../combat/CombatTypes'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Kim Tu Trúc Cơ Pure (Plans/KimPath mục 9/11/12, 2026-08-21) — Kim Thế
// tích theo ROLL THÀNH CÔNG (khác Momentum/Kiếm Ý/Hỏa Thế/Thổ Thế —
// tất cả tích theo ĐÒN TRÚNG hoặc CAST, không phải theo 1 roll ngẫu
// nhiên bên trong effect 'ailment'), nên test dùng ailmentChance: 1 để
// khử tính ngẫu nhiên (gain LUÔN xảy ra khi kimTheGainPerProc > 0).
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0, evasionRate: 0, dexterity: 0 }

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

// diem_kim_thuat (test-only fixture) — chỉ effect 'ailment' (không cần
// 'damage' cho test này), ailmentChance 1 để proc LUÔN thành công.
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
    effects: [{ type: 'ailment', ailmentId: 'chay_mau', ailmentChance: 1, grantsKimThePerProc: true }],
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

describe('BattleSystem — Kim Thế (Plans/KimPath mục 9/11, Kim Thế major)', () => {
  it('chưa mua "Kim Thế" (kimTheGainPerProc=0, nền createBaseStats()) — proc bao nhiêu cũng không tích Kim Thế', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', x: 50 })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay

    for (let i = 0; i < 320; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentKimThe).toBe(0)
  })

  it('đã mua "Kim Thế" (kimTheGainPerProc=1) — mỗi lần proc THÀNH CÔNG +1, chặn ở MAX_KIM_THE', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    player.skillStats = { ...createSkillRuntimeStats(), kimTheGainPerProc: 1 }

    const enemy = createCombatant({ id: 'enemy', x: 50 })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 5 // start() ghi đè x=400 > SCREEN_VISIBLE_MAX_X(350) — đặt lại trong tầm nhìn.

    // attackSpeed mặc định 1 -> cast mỗi 1s, ailmentChance=1 nên proc
    // LUÔN thành công -> +1 Kim Thế/giây, chạm trần sau 5 giây.
    for (let i = 0; i < 600; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentKimThe).toBe(MAX_KIM_THE)
  })

  it('"Kim Uyên" (kimTheMaxStacksBonus=1) nâng trần lên MAX_KIM_THE + 1', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })

    player.skillStats = { ...createSkillRuntimeStats(), kimTheGainPerProc: 1, kimTheMaxStacksBonus: 1 }

    const enemy = createCombatant({ id: 'enemy', x: 50 })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 5 // start() ghi đè x=400 > SCREEN_VISIBLE_MAX_X(350) — đặt lại trong tầm nhìn.

    for (let i = 0; i < 700; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentKimThe).toBe(MAX_KIM_THE + 1)
  })

  it('Kim Thế decay CHẬM RỜI RẠC — mất 1 tầng mỗi KIM_THE_DECAY_INTERVAL_SECONDS giây KHÔNG proc mới', () => {
    const { system, tick } = setup()

    // kimTheGainPerProc=0 — dù skill vẫn cast đều (attackSpeed mặc
    // định), KHÔNG proc thêm Kim Thế nào, chỉ decay từ giá trị khởi
    // điểm currentKimThe=5.
    const player = createCombatant({ id: 'player', type: 'player', x: 0, currentKimThe: 5 })
    const enemy = createCombatant({ id: 'enemy', x: 50 })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay

    // Đúng 1 interval (5s) -> mất đúng 1 tầng. +1 tick dư để tránh lỗi
    // làm tròn số thực (500 × 0.01 có thể ra 4.999999... < 5 đúng
    // ngưỡng), không ảnh hưởng ý nghĩa test (vẫn CHỈ mất đúng 1 tầng,
    // không phải 2).
    for (let i = 0; i < Math.round(KIM_THE_DECAY_INTERVAL_SECONDS / 0.01) + 1; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentKimThe).toBe(4)
  })
})
