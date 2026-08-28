import { describe, expect, it } from 'vitest'
import { SkillManager } from './SkillManager'
import { SkillSystem, getHuyKiemFlatDamageBonus } from './SkillSystem'
import { SKILLS } from '@/data/skill/Skills'
import type { CombatEntity } from '../combat/CombatEntity'

function makeEntity(): CombatEntity {
  return {
    realmIndex: 0,
    currentMp: 0,
    currentRage: 0,
    currentSwordIntent: 0,
    currentMomentum: 0,
  } as CombatEntity
}

describe('Huy Kiếm — flat damage vĩnh viễn theo cast', () => {
  it('mỗi 10 cast +1 flat damage, không trần', () => {
    expect(getHuyKiemFlatDamageBonus(0)).toBe(0)
    expect(getHuyKiemFlatDamageBonus(9)).toBe(0)
    expect(getHuyKiemFlatDamageBonus(10)).toBe(1)
    expect(getHuyKiemFlatDamageBonus(9999)).toBe(999)
  })

  it('getEffectiveSkill cộng flat bonus vào effect damage của tram', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    system.learn(template)
    const skill = manager.get('tram')!
    skill.totalExperience = 150

    const effective = system.getEffectiveSkill(skill)

    const damage = effective.effects.find((effect) => effect.type === 'damage')
    expect(damage?.value).toBe(1 + 15)
  })

  it('skill khác KHÔNG nhận flat bonus', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'hoa_cau_thuat')!
    system.learn(template)
    const skill = manager.get('hoa_cau_thuat')!
    skill.totalExperience = 150

    const effective = system.getEffectiveSkill(skill)

    const damage = effective.effects.find((effect) => effect.type === 'damage')
    expect(damage?.value).toBe(1)
  })
})

describe('Huy Kiếm — 3 level mốc 1000/10000 cast', () => {
  it('Lv1→2 tại 1000 cast, Lv2→3 tại 10000 cast, không bao giờ Lv4', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    system.learn(template)
    system.equipToSlot('tram', 0)
    const entity = makeEntity()
    const skill = manager.get('tram')!

    for (let cast = 0; cast < 999; cast++) system.useInSlot('tram', 0, entity)
    expect(skill.level).toBe(1)

    system.useInSlot('tram', 0, entity)
    expect(skill.level).toBe(2)

    for (let cast = 0; cast < 9000; cast++) system.useInSlot('tram', 0, entity)
    expect(skill.level).toBe(3)

    for (let cast = 0; cast < 5000; cast++) system.useInSlot('tram', 0, entity)
    expect(skill.level).toBe(3)
    expect(skill.totalExperience).toBe(15000)
  })

  it('không thể nâng Huy Kiếm bằng Cảm Ngộ', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    system.learn(SKILLS.find((skill) => skill.id === 'tram')!)
    expect(system.upgradeSkill('tram', { skillInsight: 999 } as never)).toBe(false)
  })
})
