import { describe, expect, it } from 'vitest'
import { SkillManager } from './SkillManager'
import { SkillSystem, getHuyKiemFlatDamageBonus } from './SkillSystem'
import { SKILLS } from '@/data/skill/Skills'
import type { CombatEntity } from '../combat/CombatEntity'

function makeEntity(): CombatEntity {
  return {
    realmIndex: 0,
    currentMp: 0,
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

  // Important #3 review fix — dead `skillExperienceRatio: 1/18` từ
  // maxLevel 18 cũ vẫn còn trên effect damage của tram, cộng thêm 1 lớp
  // % (skillExperienceRatio * totalExperience / attack, xem
  // SkillEffectSystem.ts's apply()) ĐÈ LÊN flat bonus trên — double-scale
  // ngoài spec §2 ("Huy Kiếm là skill DUY NHẤT đi bằng flat, không %").
  it('effect damage của tram KHÔNG còn skillExperienceRatio (flat-only, spec §2)', () => {
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    const damage = template.effects.find((effect) => effect.type === 'damage')

    expect(damage?.skillExperienceRatio).toBeUndefined()
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

describe('Huy Kiếm — flat bonus applies through triggers too (Task 4, engine not yet wired to data)', () => {
  it('getEffectiveSkill maps a dealDamage action.value the same way it maps effect.value', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    system.learn(template)
    const skill = manager.get('tram')!
    skill.totalExperience = 150
    skill.triggers = [{ trigger: 'onCast', actions: [{ type: 'dealDamage', value: 1, damageType: 'physical' }] }]

    const effective = system.getEffectiveSkill(skill)

    const action = effective.triggers?.[0]?.actions[0]
    expect(action?.type).toBe('dealDamage')
    expect((action as { value?: number }).value).toBe(1 + 15)
  })
})
