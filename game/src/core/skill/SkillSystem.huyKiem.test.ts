import { describe, expect, it } from 'vitest'
import { SkillManager } from './SkillManager'
import { SkillSystem, getHuyKiemExperienceToNextLevel } from './SkillSystem'
import { SKILLS } from '@/data/skill/Skills'
import type { CombatEntity } from '../combat/CombatEntity'

describe('Huy Kiếm experience', () => {
  it('dùng đúng công thức và tự lên cấp khi cast đủ lần', () => {
    expect(getHuyKiemExperienceToNextLevel(1)).toBe(10)
    expect(getHuyKiemExperienceToNextLevel(2)).toBe(29)

    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find(skill => skill.id === 'tram')!
    system.learn(template)
    system.equipToSlot('tram', 0)
    const entity = { realmIndex: 0, currentMp: 0, currentRage: 0, currentSwordIntent: 0, currentMomentum: 0 } as CombatEntity

    for (let cast = 0; cast < 10; cast++) system.useInSlot('tram', 0, entity)
    const learned = manager.get('tram')!
    expect(learned.level).toBe(2)
    expect(learned.experience).toBe(0)
    expect(learned.totalExperience).toBe(10)
  })

  it('không thể nâng Huy Kiếm bằng Cảm Ngộ', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    system.learn(SKILLS.find(skill => skill.id === 'tram')!)
    expect(system.upgradeSkill('tram', { skillInsight: 999 } as never)).toBe(false)
  })
})
