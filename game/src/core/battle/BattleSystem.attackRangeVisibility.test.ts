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
import { HERO_LANE_INDEX, VISIBLE_MAX_COLUMN } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Skill fixture 'attack_speed' tối thiểu — scheduler thống nhất đọc
// execution + loadout slot (plan §8), cùng quy ước
// BattleSystem.earthPath.test.ts's createThoCauThuat().
function createBasicSkill(): Skill {
  return {
    id: 'basic_test',
    name: 'Basic (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    loadoutSlot: 0,
    loadoutSlots: [0],
    resourceType: 'none',
    unlocked: true,
    equipped: true,
  }
}

// Attack range rework (plan §2.3) — tầm đánh của Player là Chebyshev
// quanh avatar với `player.stats.attackRange`; enemy giữ visible-gate
// khi tấn công cổng (không đánh từ off-screen).
function createBattleSystem(eventBus = new EventBus()) {
  const skillManager = new SkillManager()

  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    new SkillSystem(skillManager),
    new SkillEffectSystem(),
    new BuffRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  return { system, skillManager }
}

// evasionRate/dexterity=0 đảm bảo hit chance 100%, cùng quy ước các
// file BattleSystem.*.test.ts khác. movementSpeed=0 để x không trôi
// ngoài dự đoán — test này CỐ TÌNH đặt x thủ công sau start() để kiểm
// tra ĐÚNG biên giới range/visibility, không muốn resolveMovement() can thiệp.
function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    evasionRate: 0,
    dexterity: 0,
    attackSpeed: 1,
    attackRange: 999999,
    movementSpeed: 0,
    attack: 100,
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
    timeSinceLastHitTaken: Infinity,
    currentWard: 0,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

/** Ghi đè stat qua CẢ stats/baseStats — updateStatsFromModifiers()
 * recompute từ baseStats mỗi tick nên patch stats-only sẽ bị revert. */
function withStats(entity: CombatEntity, patch: Partial<typeof entity.stats>): CombatEntity {
  entity.stats = { ...entity.stats, ...patch }
  entity.baseStats = { ...entity.baseStats, ...patch }

  return entity
}

describe('BattleSystem — Player attack range là Chebyshev quanh avatar (plan §2.3)', () => {
  it('range 1 (patch fixture): quái cách 2 cột KHÔNG bị đánh dù cùng hàng — teleport chỉ đổi ROW nên cũng không cứu được', () => {
    const eventBus = new EventBus()
    const { system, skillManager } = createBattleSystem(eventBus)
    const player = withStats(createCombatant({ id: 'player', type: 'player' }), {
      attackRange: 1,
    })
    const enemy = createCombatant({ id: 'enemy' })

    skillManager.add(createBasicSkill())

    system.start(player, enemy)
    system.update(3) // Bỏ qua countdown trước trận.

    system.getBattle()!.enemies[0]!.entity.x = 3 // col 3 — cách cổng col 1 đúng 2.
    system.getBattle()!.enemies[0]!.entity.row = HERO_LANE_INDEX

    for (let i = 0; i < 200; i++) {
      system.update(0.05)
    }

    expect(enemy.currentHp).toBe(enemy.maxHp)
  })

  it('quái trong Chebyshev range (col 2, cùng hàng avatar) → player đánh bình thường', () => {
    const eventBus = new EventBus()
    const { system, skillManager } = createBattleSystem(eventBus)
    const player = withStats(createCombatant({ id: 'player', type: 'player' }), {
      attackRange: 1,
    })
    const enemy = createCombatant({ id: 'enemy' })

    skillManager.add(createBasicSkill())

    system.start(player, enemy)
    system.update(3)

    system.getBattle()!.enemies[0]!.entity.x = 2
    system.getBattle()!.enemies[0]!.entity.row = HERO_LANE_INDEX

    for (let i = 0; i < 200; i++) {
      system.update(0.05)
    }

    expect(enemy.currentHp).toBeLessThan(enemy.maxHp)
  })
})

describe('BattleSystem — Enemy visible gate khi tấn công cổng (giữ từ 2026-08-22)', () => {
  it('mob/boss ở off-screen (x > VISIBLE_MAX_COLUMN) KHÔNG tấn công player được dù đủ range', () => {
    const eventBus = new EventBus()
    const { system } = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player', currentHp: 1000, maxHp: 1000 })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3)

    system.getBattle()!.enemies[0]!.entity.x = VISIBLE_MAX_COLUMN + 1

    for (let i = 0; i < 200; i++) {
      system.update(0.05)
    }

    expect(player.currentHp).toBe(player.maxHp)
  })

  it('quái ĐÃ vào màn hình và đủ range tới cổng → tấn công player bình thường', () => {
    const eventBus = new EventBus()
    const { system } = createBattleSystem(eventBus)
    const player = createCombatant({
      id: 'player',
      type: 'player',
      currentHp: 1000,
      maxHp: 1000,
    })
    const enemy = withStats(createCombatant({ id: 'enemy' }), { attack: 10 })

    system.start(player, enemy)
    system.update(3)

    system.getBattle()!.enemies[0]!.entity.x = Math.min(VISIBLE_MAX_COLUMN, 3)

    for (let i = 0; i < 200; i++) {
      system.update(0.05)
    }

    expect(player.currentHp).toBeLessThan(player.maxHp)
  })
})
