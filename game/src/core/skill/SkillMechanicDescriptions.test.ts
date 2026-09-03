import { describe, expect, it } from 'vitest'
import { describeSkillMechanics } from './SkillMechanicDescriptions'
import { BuffRegistry } from '../buff/BuffRegistry'
import type { Skill } from './Skill'
import type { SkillEffect } from './SkillEffect'

// Task 12 (plan 2026-09-03-thuan-he) — tooltip mechanic lines: mỗi field
// engine mới (E-1..E-5) phải có dòng mô tả; skill cũ không field → [].
function skillWith(effects: SkillEffect[]): Skill {
  return {
    id: 'test_skill',
    name: 'Test Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 1,
    remainingCooldown: 0,
    target: 'enemy',
    effects,
    resourceType: 'none',
    unlocked: true,
    equipped: false,
  } as Skill
}

function registryWithBong(): BuffRegistry {
  const registry = new BuffRegistry()

  registry.register({
    id: 'bong',
    name: 'Bỏng',
    polarity: 'debuff',
    duration: 4,
    stackMode: 'stack',
    maxStacks: 5,
    effects: [],
  })

  return registry
}

describe('describeSkillMechanics (Task 12 tooltip)', () => {
  it('skill không có field mechanic → mảng rỗng (mọi skill cũ không đổi UI)', () => {
    const lines = describeSkillMechanics(skillWith([{ type: 'damage', value: 5 }]))

    expect(lines).toEqual([])
  })

  it('E-4 hitCount → dòng "Đánh trúng N lần"', () => {
    const lines = describeSkillMechanics(
      skillWith([{ type: 'damage', value: 5, hitCount: 8 }]),
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]!.text).toContain('8 lần')
  })

  it('E-1 spreadsAilmentId → dòng lan, percent mặc định toàn bộ; 0.5 → 50%', () => {
    const registry = registryWithBong()

    const full = describeSkillMechanics(
      skillWith([{ type: 'damage', value: 5, spreadsAilmentId: 'bong' }]),
      registry,
    )

    expect(full[0]!.text).toContain('toàn bộ tầng Bỏng')

    const half = describeSkillMechanics(
      skillWith([{ type: 'damage', value: 5, spreadsAilmentId: 'bong', spreadStackPercent: 0.5 }]),
      registry,
    )

    expect(half[0]!.text).toContain('50% tầng Bỏng')
  })

  it('E-5 grantsZone + zoneElement → dòng vùng theo hành; grantsSwordZone cũ → Kim', () => {
    const zone = describeSkillMechanics(
      skillWith([{ type: 'damage', value: 5, grantsZone: true, zoneElement: 'fire' }]),
    )

    expect(zone[0]!.text).toContain('vùng Hỏa')

    const sword = describeSkillMechanics(
      skillWith([{ type: 'damage', value: 5, grantsSwordZone: true }]),
    )

    expect(sword[0]!.text).toContain('vùng Kim')
  })

  it('E-3 add_stack/remove_buff → dòng cộng/gỡ theo buffId, count, scope', () => {
    const registry = registryWithBong()

    const add = describeSkillMechanics(
      skillWith([{ type: 'add_stack', buffId: 'bong', stacks: 2 }]),
      registry,
    )

    expect(add[0]!.text).toContain('Cộng 2 tầng Bỏng')

    const remove = describeSkillMechanics(
      skillWith([{ type: 'remove_buff', scope: 'source', polarity: 'debuff', count: 8 }]),
      registry,
    )

    expect(remove[0]!.text).toContain('Gỡ tối đa 8 debuff trên bản thân')
  })

  it('E-2 stacksPerAffectedTarget → dòng mỗi target trúng +1 tầng', () => {
    const registry = new BuffRegistry()

    registry.register({
      id: 'thanh_luy',
      name: 'Thành Lũy',
      polarity: 'buff',
      duration: 8,
      stackMode: 'stack',
      maxStacks: 8,
      effects: [],
    })

    const lines = describeSkillMechanics(
      skillWith([{ type: 'buff', buffId: 'thanh_luy', stacksPerAffectedTarget: true, scope: 'source' }]),
      registry,
    )

    expect(lines[0]!.text).toContain('Thành Lũy')
    expect(lines[0]!.text).toContain('1 tầng')
  })

  it('nhiều effect nhiều field → mỗi dòng riêng, key unique', () => {
    const lines = describeSkillMechanics(
      skillWith([
        { type: 'damage', value: 5, hitCount: 3 },
        { type: 'damage', value: 2, grantsZone: true, zoneElement: 'wood' },
      ]),
    )

    expect(lines).toHaveLength(2)
    expect(new Set(lines.map((l) => l.key)).size).toBe(2)
  })
})
