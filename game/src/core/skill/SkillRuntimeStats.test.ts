import { describe, expect, it } from 'vitest'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'
import { createSkillRuntimeStats } from './SkillRuntimeStats'
import { createBaseStats } from '../stats/StatBlock'
import type { Skill } from './Skill'

function skill(overrides: Partial<Skill>): Skill {
  return {
    id: 'test_skill', name: 'Test', description: '', type: 'active',
    level: 1, maxLevel: 1,  
    cooldown: 1, remainingCooldown: 0, cost: 0, target: 'enemy', effects: [],
    unlocked: true, equipped: true,
    ...overrides,
  }
}

describe('SkillRuntimeStats', () => {
  it('không còn nằm trong character Stats', () => {
    expect(createBaseStats()).not.toHaveProperty('hoaTheGainPerCast')
    expect(createBaseStats()).not.toHaveProperty('earthAoeRadius')
  })

  it('tổng hợp field từ Skill vào runtime container riêng', () => {
    const manager = new SkillManager()
    manager.add(skill({ id: 'fire', hoaTheGainPerCast: 1 }))
    manager.add(skill({ id: 'fire_passive', hoaTheGainPerCast: 0.5, earthAoeRadius: 20 }))

    const runtime = new SkillSystem(manager).getSkillRuntimeStats()
    expect(runtime.hoaTheGainPerCast).toBe(1.5)
    expect(runtime.earthAoeRadius).toBe(20)
  })

  it('factory luôn cấp đủ key với nền 0', () => {
    expect(Object.values(createSkillRuntimeStats()).every(value => value === 0)).toBe(true)
  })
})
