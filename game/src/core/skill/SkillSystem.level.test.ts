import { describe, expect, it, vi } from 'vitest'
import type { Skill } from './Skill'
import { SkillManager } from './SkillManager'
import { getSkillExperiencePercent, SkillSystem } from './SkillSystem'

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test_skill',
    name: 'Test Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    experience: 0,
    experienceRequired: 100,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 100, damageType: 'physical' }],
    unlocked: false,
    equipped: false,
    ...overrides,
  }
}

function setup(template = skill(), onLevelUp = vi.fn()) {
  const manager = new SkillManager()
  const system = new SkillSystem(manager, onLevelUp)
  expect(system.learn(template)).toBe(true)
  return { manager, system, learned: manager.get(template.id)!, onLevelUp }
}

describe('SkillSystem level progression', () => {
  it('tăng nhiều level, giữ XP dư và phát một callback tổng hợp', () => {
    const { system, learned, onLevelUp } = setup()

    expect(system.gainExperience(learned.id, 260)).toBe(true)
    expect(learned.level).toBe(3)
    expect(learned.experience).toBe(10)
    expect(learned.experienceRequired).toBe(225)
    expect(onLevelUp).toHaveBeenCalledWith(learned, 2)
  })

  it('cap đúng maxLevel và xóa XP dư', () => {
    const { system, learned } = setup(skill({ level: 9, maxLevel: 10, experienceRequired: 10 }))

    expect(system.gainExperience(learned.id, 999)).toBe(true)
    expect(learned.level).toBe(10)
    expect(learned.experience).toBe(0)
    expect(system.gainExperience(learned.id, 1)).toBe(false)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('từ chối XP không hợp lệ: %s', amount => {
    const { system, learned } = setup()
    expect(system.gainExperience(learned.id, amount)).toBe(false)
    expect(learned.experience).toBe(0)
  })

  it('không lặp vô hạn khi experienceRequired không hợp lệ', () => {
    const { system, learned } = setup(skill({ experienceRequired: 0 }))
    expect(system.gainExperience(learned.id, 100)).toBe(false)
    expect(learned.level).toBe(1)
  })

  it('không mutate template dùng để đăng ký khi learned skill tăng level', () => {
    const template = skill({ experienceRequired: 10 })
    const { system } = setup(template)
    system.gainExperience(template.id, 10)
    expect(template.level).toBe(1)
    expect(template.experience).toBe(0)
  })

  it('scale active damage đúng 5% mỗi level', () => {
    const { system, learned } = setup(skill({ level: 3 }))
    expect(system.getEffectiveSkill(learned).effects[0]!.value).toBeCloseTo(110)
  })

  it('cho phép combat dùng level snapshot thay vì level progression vừa đổi', () => {
    const { system, learned } = setup(skill({ level: 5 }))
    expect(system.getEffectiveSkill(learned, 1).effects[0]!.value).toBe(100)
    expect(system.getEffectiveSkill(learned).effects[0]!.value).toBe(120)
  })

  it('scale passive flat và percent đúng một lần theo level', () => {
    const { system } = setup(skill({
      type: 'passive',
      level: 3,
      passiveTrigger: 'hit',
      passiveModifiers: [{
        id: 'passive-test',
        sourceId: 'test_skill',
        sourceType: 'skill',
        stat: 'attack',
        flat: 10,
        percent: 0.1,
        perLevelFlat: 2,
        perLevelPercent: 0.05,
      }],
    }))
    system.equipWithoutSlot('test_skill')

    expect(system.getScaledPassiveModifiers()[0]).toMatchObject({ flat: 14, percent: 0.2 })
  })

  it('tính thanh XP theo tiến độ tới level kế và hiển thị 100% ở cap', () => {
    expect(getSkillExperiencePercent(skill({ experience: 25, experienceRequired: 100 }))).toBe(25)
    expect(getSkillExperiencePercent(skill({ level: 10, maxLevel: 10 }))).toBe(100)
    expect(getSkillExperiencePercent(skill({ experienceRequired: 0 }))).toBe(0)
  })
})
