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
import { ailments } from '../../data/ailment/ailments'
import { MAX_MOMENTUM } from '../combat/CombatTypes'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  // dexterity:0/evasionRate:0 — đảm bảo hit chance 100% xuyên suốt test,
  // xem ghi chú tương tự trong BattleSystem.kiemTu.test.ts.
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

// Impact test-only — CHƯA đưa vào data/skill/Skills.ts thật (Thể Tu
// path/CultivationPathKit còn để yên, xem ghi chú Combat Rework Phase
// 7) — test này chỉ xác nhận ENGINE (grantsMomentumPerHit/breakDamagePerHit)
// hoạt động đúng khi 1 skill khai 2 field này.
function createImpactSkill(): Skill {
  return {
    id: 'impact_test',
    name: 'Impact (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 1,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    loadoutSlot: 0,
    loadoutSlots: [0],
    resourceType: 'none',
    grantsMomentumPerHit: 40,
    breakDamagePerHit: 30,
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

  skillManager.add(createImpactSkill())

  // BattleSystem KHÔNG tự tick cooldown skill (đó là việc của
  // GameManager.update()'s skillSystem.update(), xem GameManager.ts) —
  // test phải tự giả lập đúng thứ tự update() thật mỗi tick, nếu không
  // remainingCooldown kẹt cứng sau phát cast đầu tiên, chặn hẳn phát 2.
  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick }
}

describe('BattleSystem — Thể Tu Momentum/Break engine (Combat Rework Phase 7)', () => {
  it('mỗi đòn Impact trúng tích Momentum, không vượt quá MAX_MOMENTUM', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay

    // start() luôn đặt lại x = HERO_HOME_X/ENEMY_SPAWN_X (400) — set lại
    // TRỰC TIẾP sau đó để quãng đường bay ngắn, dễ tính số tick cần.
    enemy.x = 2
    enemy.row = 4

    // ~4 phát Impact trong 3.2s (cooldown 1s, attackSpeed 1 -> cast mỗi
    // 1s, cộng ~0.1s bay) x 40 Momentum/đòn = 160 lý thuyết, phải chặn
    // ở MAX_MOMENTUM=100.
    for (let i = 0; i < 320; i++) {
      tick(0.01)
    }

    expect(system.getBattle()!.player.currentMomentum).toBe(MAX_MOMENTUM)
  })

  it('Break Gauge chạm 0 thì Stagger (áp choang) rồi reset về breakGaugeMax', () => {
    const { system, tick } = setup()

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const boss = createCombatant({ id: 'boss', breakGaugeMax: 50, currentBreakGauge: 50 })

    system.start(player, boss)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay

    boss.x = 5

    // 1 phát Impact (cast ~t=0, bay 50/500=0.1s) = 30 break damage —
    // CHƯA đủ hạ 50 -> 0. 30 tick x 0.01s = 0.3s, đủ dư cho phát 1 bay
    // tới nhưng CHƯA tới mốc cooldown 1s cho phát 2.
    for (let i = 0; i < 30; i++) {
      tick(0.01)
    }

    const bossAfterOneHit = system.getBattle()!.enemies[0]!

    expect(bossAfterOneHit.entity.currentBreakGauge).toBe(20)
    expect(bossAfterOneHit.ailments.has('choang')).toBe(false)

    // Phát 2 (cast lại ~t=1.0s sau khi qua mốc cooldown, bay 0.1s nữa)
    // — 20 - 30 <= 0 -> Stagger, reset breakGaugeMax. 80 tick x 0.01s =
    // thêm 0.8s (tổng 1.1s), đủ margin qua mốc ~1.1s phát 2 chạm đích.
    for (let i = 0; i < 80; i++) {
      tick(0.01)
    }

    const bossAfterStagger = system.getBattle()!.enemies[0]!

    expect(bossAfterStagger.entity.currentBreakGauge).toBe(50)
    expect(bossAfterStagger.ailments.has('choang')).toBe(true)
  })
})
