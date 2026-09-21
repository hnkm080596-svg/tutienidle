import { describe, expect, it } from 'vitest'
import { describeSkillMechanics } from './SkillMechanicDescriptions'
import type { BuffDefinition } from '../buff2/BuffDefinition'
import type { BuffRegistry } from '../buff2/BuffRegistry'
import type { BuffDefinitionId } from '../battle/contracts/ids'
import type { Skill } from './Skill'
import type { SkillEffect } from './SkillEffect'
import { makeTestBuffRegistry } from '../battle/turn/testing/TurnRuntimeFixtures'

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
    target: 'enemy',
    effects,
    resourceType: 'none',
  } as Skill
}

function tooltipDef(
  id: string,
  name: string,
  polarity: 'buff' | 'debuff',
  maxStacks: number,
): BuffDefinition {
  return {
    id: id as BuffDefinitionId,
    name,
    kind: polarity === 'debuff' ? 'debuff' : 'buff',
    polarity,
    instanceScope: 'per_target',
    stacking: {
      maxStacks,
      onReapplyStacks: 'add',
      onReapplyDuration: 'refresh',
    },
    lifetime: { clock: 'holder_turns', duration: 4, scaling: 'fixed' },
    dispellable: true,
  }
}

function registryWithBong(): BuffRegistry {
  return makeTestBuffRegistry([tooltipDef('bong', 'Bỏng', 'debuff', 5)])
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

  it('E-5 grantsZone + zoneElement → dòng vùng theo hành; không khai → Kim', () => {
    const zone = describeSkillMechanics(
      skillWith([{ type: 'damage', value: 5, grantsZone: true, zoneElement: 'fire' }]),
    )

    expect(zone[0]!.text).toContain('vùng Hỏa')

    const sword = describeSkillMechanics(
      skillWith([{ type: 'damage', value: 5, grantsZone: true }]),
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
    const registry = makeTestBuffRegistry([tooltipDef('thanh_luy', 'Thành Lũy', 'buff', 8)])

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
