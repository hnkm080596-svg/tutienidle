import { describe, expect, it } from 'vitest'
import { SKILLS } from '../../data/skill/Skills'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'
import { targetingForSkill } from '../battle/CombatAction'

// Engine 22c8007 (Task 10 follow-up, spec sec.2 variants) -
// SkillSpecialization.targeting override: a specialization swaps the
// AoE shape (single <-> square/line/all_lanes). getEffectiveSkill returns
// `targeting` = specialization.targeting ?? skill.targeting;
// BattleSystem.resolveSkillEffects resolves the shape via
// targetingForSkill(effective). Both layers pinned here.
//
// Phap Tu Reimagined: the chain-era Thuan C/D variants retired; the
// surviving override surface is the basic-lane `*_tan_diem` capstone
// specs (square radius 1) on the five element basics.

function findSkill(id: string) {
  const skill = SKILLS.find((candidate) => candidate.id === id)

  if (!skill) {
    throw new Error(`missing skill ${id} in data`)
  }

  return skill
}

function setupFor(skillId: string) {
  const manager = new SkillManager()
  const system = new SkillSystem(manager)

  manager.add(structuredClone(findSkill(skillId)))

  return { manager, system }
}

describe('SkillSystem.getEffectiveSkill — specialization targeting override (22c8007)', () => {
  it('no specialization selected → effective.targeting = the skill base targeting', () => {
    const { system, manager } = setupFor('hoa_cau_thuat')
    const skill = manager.get('hoa_cau_thuat')!

    const effective = system.getEffectiveSkill(skill)

    // The base def authors no targeting → undefined (single default).
    expect(skill.targeting).toBeUndefined()
    expect(effective.targeting).toBeUndefined()
  })

  it('hoa_tan_diem: specialization targeting replaces the (absent) base with square radius 1', () => {
    const { system, manager } = setupFor('hoa_cau_thuat')
    const skill = manager.get('hoa_cau_thuat')!

    expect(system.selectSpecialization(skill.id, 'hoa_tan_diem')).toBe(true)

    const effective = system.getEffectiveSkill(skill)

    expect(effective.targeting).toEqual({ shape: 'square', laneRadius: 1 })
    // The BattleSystem lane: resolveSkillEffects infers the shape via
    // targetingForSkill(effective) — 'square', not the single default.
    expect(targetingForSkill({ ...skill, targeting: effective.targeting }).shape).toBe('square')
  })

  it('hoa_tu_diem: specialization without targeting falls back to the base targeting', () => {
    const { system, manager } = setupFor('hoa_cau_thuat')
    const skill = manager.get('hoa_cau_thuat')!

    expect(system.selectSpecialization(skill.id, 'hoa_tu_diem')).toBe(true)

    const effective = system.getEffectiveSkill(skill)

    // No override = keep the base shape — `specialization?.targeting ??
    // skill.targeting`; the basic authors none, so undefined.
    expect(effective.targeting).toBeUndefined()
  })

  it('every specialization targeting override in the shipped data is a valid ActionTargeting', () => {
    const shapes = new Set(['single', 'square', 'cross', 'line', 'row', 'column', 'all_lanes'])
    let overrideCount = 0

    for (const skill of SKILLS) {
      for (const spec of skill.specializations ?? []) {
        if (spec.targeting) {
          overrideCount += 1
          expect(shapes.has(spec.targeting.shape), `${skill.id}/${spec.id} shape`).toBe(true)
        }
      }
    }

    // The five element basics each carry the Tán Diễm spread override —
    // 5 targeting overrides total (reimagined tree's only spec-level
    // targeting surface).
    expect(overrideCount).toBe(5)
  })
})
