import { describe, expect, it } from 'vitest'
import { SkillSystem } from './SkillSystem'
import { SkillManager } from './SkillManager'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from './Skill'

function createEntity(currentMomentum: number): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentRage: 0,
    currentSwordIntent: 0,
    currentMomentum,
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
  }
}

function createHeavyImpactSkill(): Skill {
  return {
    id: 'heavy_impact_test',
    name: 'Heavy Impact (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    remainingCooldown: 0,
    cost: 100,
    target: 'enemy',
    effects: [],
    resourceType: 'momentum',
    unlocked: true,
    equipped: true,
  }
}

describe('SkillSystem — resourceType "momentum" (Thể Tu, Combat Rework Phase 7)', () => {
  it('canUse() false khi Momentum chưa đủ cost', () => {
    const skillManager = new SkillManager()
    const skillSystem = new SkillSystem(skillManager)

    skillManager.add(createHeavyImpactSkill())

    expect(skillSystem.canUse('heavy_impact_test', createEntity(99))).toBe(false)
  })

  it('canUse() true khi Momentum đủ cost, useInSlot() trừ đúng lượng', () => {
    const skillManager = new SkillManager()
    const skillSystem = new SkillSystem(skillManager)

    skillManager.add(createHeavyImpactSkill())

    const entity = createEntity(100)

    expect(skillSystem.canUse('heavy_impact_test', entity)).toBe(true)

    // Combat Balance Pass (2026-08-29) — use() legacy đã gộp vào
    // useInSlot() (plan §3.7): begin + commit cooldown cùng lúc.
    skillSystem.useInSlot('heavy_impact_test', 0, entity)

    expect(entity.currentMomentum).toBe(0)
  })
})
