import { describe, expect, it } from 'vitest'
import { PassiveSystem } from './PassiveSystem'
import { EventBus } from '../events/EventBus'
import type { SkillManager } from './SkillManager'
import type { SkillSystem } from './SkillSystem'
import type { Skill } from './Skill'
import type { StatModifier } from '../stats/StatCalculator'

// Novel-attack probes for the conditioned-band fix (pr51 merge gate).
// These challenge schedules the round-1 tests did not: repeated threshold
// crossings within one battle, and re-arming after a release.

function bandHarness(initialHp: number) {
  const mod: StatModifier = {
    id: 'novel_band',
    sourceId: 'test',
    sourceType: 'skill',
    stat: 'finalDamageReductionPercent',
    flat: 0.1,
    maxStacks: 1,
  }
  const skill: Skill = {
    id: 'novel_band_skill',
    name: 'novel',
    description: '',
    type: 'passive',
    level: 1,
    maxLevel: 1,
    cooldown: 0,
    target: 'self',
    effects: [],
    passiveTrigger: 'per_second',
    passiveModifiers: [mod],
    passiveCondition: { kind: 'hpBelow', percent: 0.35 },
  }
  let hp = initialHp
  const system = new PassiveSystem(
    new EventBus(),
    { getPassiveSkills: () => [skill] } as unknown as SkillManager,
    { getEffectiveSkill: (input: Skill) => input } as unknown as SkillSystem,
    undefined,
    () => hp,
  )
  return { system, mod, setHp: (v: number) => { hp = v } }
}

describe('conditioned band - oscillation probes', () => {
  it('ten HP oscillations: band toggles every crossing, never accumulates past 1', () => {
    const { system, mod, setHp } = bandHarness(0.2)
    for (let i = 0; i < 10; i += 1) {
      system.tick(1)
      expect(mod.stacks).toBe(i % 2 === 0 ? 1 : 0)
      setHp(i % 2 === 0 ? 0.9 : 0.2)
    }
  })

  it('partial second while below then recover: accumulator kept, band arms on re-entry', () => {
    const { system, mod, setHp } = bandHarness(0.2)
    system.tick(0.5)
    expect(mod.stacks ?? 0).toBe(0)
    setHp(0.9)
    system.tick(0.5)
    expect(mod.stacks ?? 0).toBe(0)
    setHp(0.2)
    system.tick(1)
    expect(mod.stacks).toBe(1)
  })
})
