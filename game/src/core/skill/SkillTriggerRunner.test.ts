import { describe, expect, it, vi } from 'vitest'
import { SkillTriggerRunner } from './SkillTriggerRunner'
import type { Skill } from './Skill'
import type { CombatEntity } from '../combat/CombatEntity'
import type { SkillEffectContext } from './SkillEffectSystem'

function makeSkill(triggers: Skill['triggers']): Skill {
  return { id: 's', name: 's', description: '', type: 'active', level: 1, maxLevel: 1, cooldown: 0, remainingCooldown: 0, target: 'enemy', effects: [], unlocked: true, equipped: true, triggers } as Skill
}

function makeEntity(): CombatEntity {
  return { id: 'e', alive: true, realmIndex: 0, stats: { skillDamagePercent: 0, maxMp: 0, attack: 1 } as CombatEntity['stats'] } as CombatEntity
}

describe('SkillTriggerRunner', () => {
  it('runs actions bound to the firing trigger, in order', () => {
    const fireHit = vi.fn(() => ({ landed: true }))
    const ctx = { fireHit } as unknown as SkillEffectContext
    const source = makeEntity()
    const target = makeEntity()
    const skill = makeSkill([
      { trigger: 'onCast', actions: [{ type: 'dealDamage', value: 1 }, { type: 'dealDamage', value: 2 }] },
    ])

    new SkillTriggerRunner().fire('onCast', { source, skill }, skill.triggers, source, target, ctx)

    expect(fireHit).toHaveBeenCalledTimes(2)
    expect(fireHit).toHaveBeenNthCalledWith(1, target, { kind: 'physical', multiplier: 1 })
    expect(fireHit).toHaveBeenNthCalledWith(2, target, { kind: 'physical', multiplier: 2 })
  })

  it('ignores bindings for a different trigger', () => {
    const fireHit = vi.fn(() => ({ landed: true }))
    const ctx = { fireHit } as unknown as SkillEffectContext
    const source = makeEntity()
    const target = makeEntity()
    const skill = makeSkill([{ trigger: 'onHit', actions: [{ type: 'dealDamage', value: 1 }] }])

    new SkillTriggerRunner().fire('onCast', { source, skill }, skill.triggers, source, target, ctx)

    expect(fireHit).not.toHaveBeenCalled()
  })

  it('is a no-op when there are no triggers', () => {
    const fireHit = vi.fn()
    const ctx = { fireHit } as unknown as SkillEffectContext
    const source = makeEntity()
    const target = makeEntity()
    const skill = makeSkill(undefined)

    expect(() => new SkillTriggerRunner().fire('onCast', { source, skill }, undefined, source, target, ctx)).not.toThrow()
    expect(fireHit).not.toHaveBeenCalled()
  })
})
