import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from '../battle/ActionImpactSystem'


import { createBaseStats } from '../stats/StatBlock'
import { buffs } from '../../data/buff/buffs'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Thổ Tu (Thạch Hóa, Plans/magicpathgeneral, 2026-08-21) — "50% Choáng
// mỗi đòn đánh trúng trong lúc Thạch Hóa active" đi qua BattleSystem.
// resolveMissiles() thật (missile bay + trúng), khác
// BuffSystem.test.ts's on-hit proc / Thạch Hóa describe (chỉ test
// rollOnHitEffects() đơn lẻ). onHitChance ép về 1 (registry test-only)
// để tất định — bản thân roll xác suất đã test riêng ở file kia bằng
// biên 0/1.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = { ...createBaseStats(), attack: 100, defense: 0, evasionRate: 0, dexterity: 0, criticalRate: 0 }

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

function createThoCauThuat(): Skill {
  return {
    id: 'tho_cau_thuat_test',
    name: 'Thổ Cầu Thuật (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 1,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [
      { type: 'damage', value: 1, damageType: 'physical' },
      { type: 'debuff', buffId: 'thach_hoa', ailmentChance: 1 },
    ],
    execution: { kind: 'attack_speed' },
    loadoutSlot: 0,
    loadoutSlots: [0],
    resourceType: 'none',
    unlocked: true,
    equipped: true,
  }
}

function setup(onHitChanceOverride: number) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const buffRegistry = new BuffRegistry()

  for (const definition of buffs) {
    buffRegistry.register(
      definition.id === 'thach_hoa'
        ? {
            ...definition,
            effects: definition.effects.map((effect) =>
              effect.type === 'onHitProc' ? { ...effect, chance: onHitChanceOverride } : effect,
            ),
          }
        : definition,
    )
  }

  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    buffRegistry,
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  skillManager.add(createThoCauThuat())

  function tick(deltaSeconds: number) {
    skillSystem.update(deltaSeconds, 0)
    system.update(deltaSeconds)
  }

  return { system, tick }
}

describe('BattleSystem — Thạch Hóa on-hit Choáng (Plans/magicpathgeneral)', () => {
  it('onHitChance=1 — lần đánh trúng THỨ 2 trở đi (sau khi Thạch Hóa đã tồn tại từ lần trúng đầu) áp Choáng lên target', () => {
    const { system, tick } = setup(1)

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', x: 50, currentHp: 1000000, maxHp: 1000000 })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 2
    enemy.row = 4

    // Đủ thời gian cho ÍT NHẤT 2 lần cast trúng đích thật (missile bay
    // 0.1s + cooldown 1s) — lần 1 tự áp Thạch Hóa, lần 2 mới có cơ hội
    // roll onHitChance (ailment phải ĐANG active TRƯỚC đòn mới tính).
    for (let i = 0; i < 250; i++) {
      tick(0.01)
    }

    const battleEnemy = system.getBattle()!.enemies[0]!

    expect(battleEnemy.buffs.hasAny('thach_hoa')).toBe(true)
    expect(battleEnemy.buffs.hasAny('choang')).toBe(true)
  })

  it('onHitChance=0 — dù trúng nhiều lần, KHÔNG BAO GIỜ Choáng', () => {
    const { system, tick } = setup(0)

    const player = createCombatant({ id: 'player', type: 'player', x: 0 })
    const enemy = createCombatant({ id: 'enemy', x: 50, currentHp: 1000000, maxHp: 1000000 })

    system.start(player, enemy)
    system.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay
    enemy.x = 2
    enemy.row = 4

    for (let i = 0; i < 250; i++) {
      tick(0.01)
    }

    const battleEnemy = system.getBattle()!.enemies[0]!

    expect(battleEnemy.buffs.hasAny('thach_hoa')).toBe(true)
    expect(battleEnemy.buffs.hasAny('choang')).toBe(false)
  })
})
