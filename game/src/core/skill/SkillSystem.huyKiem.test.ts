import { describe, expect, it, vi } from 'vitest'
import { SkillManager } from './SkillManager'
import { SkillSystem, getHuyKiemFlatDamageBonus } from './SkillSystem'
import { SKILLS } from '@/data/skill/Skills'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { createDefaultPlayer } from '../player/Player'
import { canUpgradeNode } from '../progression/NodeSystem'

describe('Huy Kiếm — flat damage vĩnh viễn theo cast', () => {
  it('mỗi 10 cast +1 flat damage, không trần', () => {
    expect(getHuyKiemFlatDamageBonus(0)).toBe(0)
    expect(getHuyKiemFlatDamageBonus(9)).toBe(0)
    expect(getHuyKiemFlatDamageBonus(10)).toBe(1)
    expect(getHuyKiemFlatDamageBonus(9999)).toBe(999)
  })

  it('getEffectiveSkill cộng flat bonus vào action dealDamage của tram', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    system.learn(template)
    const skill = manager.get('tram')!
    skill.totalExperience = 150

    const effective = system.getEffectiveSkill(skill)

    const action = effective.triggers?.[0]?.actions[0]
    expect(action?.type).toBe('dealDamage')
    expect((action as { value?: number }).value).toBe(1 + 15)
  })

  // Important #3 review fix - the dead `skillExperienceRatio: 1/18` from
  // the old maxLevel 18 still sat on tram's damage effect, adding a %
  // layer (skillExperienceRatio * totalExperience / might - the legacy
  // executor formula) ON TOP of the flat bonus - a double-scale outside
  // spec sec.2 ("Huy Kiem is the ONLY skill that runs flat, no %").
  it('action dealDamage của tram KHÔNG còn skillExperienceRatio (flat-only, spec §2)', () => {
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    const action = template.triggers?.[0]?.actions[0]

    expect((action as { skillExperienceRatio?: number })?.skillExperienceRatio).toBeUndefined()
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

// M-QI-05 - Skill.level is frozen authored data; the cast-channel
// TARGET level rides the sink (canonical write: nodeLevels[core_tram],
// covered end-to-end in SkillSystem.castCount.test.ts).
describe('Huy Kiếm — cast-channel target levels (sink contract)', () => {
  it('Lv2 target tại 1000 cast, Lv3 tại 10000, không bao giờ Lv4 (Skill.level frozen)', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    const sink = vi.fn()
    system.setCastCountSink(sink)
    const template = SKILLS.find((skill) => skill.id === 'tram')!
    system.learn(template)
    const skill = manager.get('tram')!

    for (let cast = 0; cast < 999; cast++) system.recordCast('tram')
    expect(sink).toHaveBeenLastCalledWith('tram', 999, 1)
    expect(skill.level).toBe(1)

    system.recordCast('tram')
    expect(sink).toHaveBeenLastCalledWith('tram', 1000, 2)

    for (let cast = 0; cast < 9000; cast++) system.recordCast('tram')
    expect(sink).toHaveBeenLastCalledWith('tram', 10000, 3)

    for (let cast = 0; cast < 5000; cast++) system.recordCast('tram')
    expect(sink).toHaveBeenLastCalledWith('tram', 15000, 3)
    expect(skill.level).toBe(1)
    expect(skill.totalExperience).toBe(15000)
  })

  it('không thể nâng Huy Kiếm bằng Cảm Ngộ', () => {
    const manager = new SkillManager()
    const system = new SkillSystem(manager)
    system.learn(SKILLS.find((skill) => skill.id === 'tram')!)
    // M-QI-05 - the cast-channel pin now lives at the node gate:
    // core_tram rejects Insight upgrades outright (INV-9 unchanged).
    const tramCore = SKILL_CORE_NODES.find((node) => node.levelsSkillId === 'tram')!
    const player = createDefaultPlayer()
    player.skillInsight = 999
    player.nodeLevels[tramCore.id] = 1
    player.purchasedNodeIds.push(tramCore.id)
    expect(canUpgradeNode(player, tramCore)).toBe(false)
  })
})
