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
import { VISIBLE_MAX_COLUMN } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Basic-attack skill fixture tối thiểu — chỉ cần đúng field
// updatePlayerAttack()/castSkill() thật sự đọc, cùng quy ước
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
    isBasicAttack: true,
    resourceType: 'none',
    unlocked: true,
    equipped: true,
  }
}

// Attack range visibility gate (2026-08-22) — "100 là toàn màn hình,
// nhưng phải đảm bảo thấy quái rồi mới đánh, không đánh quái
// offscreen" — bổ sung TRÊN attackRange world-unit hiện có (không đổi
// đơn vị lưu trữ, xem BattleLane.ts's attackRangeVisiblePercent()),
// khoá cứng cả player (attackRange "vô hạn" 999999 theo thiết kế tower
// defense gốc, xem StatBlock.ts) lẫn mob/boss.
function createBattleSystem(eventBus = new EventBus()) {
  const skillManager = new SkillManager()

  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    new SkillSystem(skillManager),
    new SkillEffectSystem(),
    new BuffRegistry(),
    new AilmentRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
  )

  return { system, skillManager }
}

// evasionRate/dexterity=0 đảm bảo hit chance 100%, cùng quy ước các
// file BattleSystem.*.test.ts khác. movementSpeed=0 để x không trôi
// ngoài dự đoán — test này CỐ TÌNH đặt x thủ công sau start() để kiểm
// tra ĐÚNG biên giới visibility, không muốn resolveMovement() can thiệp.
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

describe('BattleSystem — Attack range visibility gate (2026-08-22)', () => {
  it('player attackRange world-unit "vô hạn" (999999, thiết kế tower defense gốc) nhưng quái đứng OFF-SCREEN (x > VISIBLE_MAX_COLUMN) → KHÔNG bắn được, dù đủ tầm world-unit', () => {
    const eventBus = new EventBus()
    const { system, skillManager } = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    skillManager.add(createBasicSkill())

    system.start(player, enemy)
    system.update(3) // Bỏ qua countdown trước trận.

    system.getBattle()!.enemies[0]!.entity.x = VISIBLE_MAX_COLUMN + 1

    for (let i = 0; i < 200; i++) {
      system.update(0.05)
    }

    expect(enemy.currentHp).toBe(enemy.maxHp)
  })

  it('quái đứng ĐÚNG biên giới nhìn thấy (x = VISIBLE_MAX_COLUMN) → player bắn được bình thường', () => {
    const eventBus = new EventBus()
    const { system, skillManager } = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    skillManager.add(createBasicSkill())

    system.start(player, enemy)
    system.update(3)

    system.getBattle()!.enemies[0]!.entity.x = VISIBLE_MAX_COLUMN

    for (let i = 0; i < 200; i++) {
      system.update(0.05)
    }

    expect(enemy.currentHp).toBeLessThan(enemy.maxHp)
  })

  it('mob/boss ở off-screen (x > VISIBLE_MAX_COLUMN) cũng KHÔNG tấn công lại player được — gate áp dụng cả 2 phía', () => {
    const eventBus = new EventBus()
    const { system } = createBattleSystem(eventBus)
    const player = createCombatant({ id: 'player', type: 'player' })
    const enemy = createCombatant({ id: 'enemy' })

    system.start(player, enemy)
    system.update(3)

    system.getBattle()!.enemies[0]!.entity.x = VISIBLE_MAX_COLUMN + 1

    for (let i = 0; i < 200; i++) {
      system.update(0.05)
    }

    expect(player.currentHp).toBe(player.maxHp)
  })
})
