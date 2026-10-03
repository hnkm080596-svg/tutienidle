import { describe, expect, it } from 'vitest'
import { PassiveSystem, PLAYER_ID } from './PassiveSystem'
import type { CombatEventPayload } from './PassiveSystem'
import { EventBus } from '../events/EventBus'
import type { SkillManager } from './SkillManager'
import type { SkillSystem } from './SkillSystem'
import type { Skill } from './Skill'
import type { StatModifier } from '../stats/StatCalculator'

// E2 (spec talent v4 2026-09-03 sec3.3) - PassiveSystem mo 2 nhanh cho
// talent combat v4: passiveCondition (chi tich stack khi dieu kien HP
// cua player dung - doc qua hpReader closure) va passiveConvertsTo
// (modifier cham maxStacks -> apply buff len player qua buffApplier,
// reset stack ve 0 - nhip "tich -> nguong -> bung no -> tich lai").
//
// Fixture pattern: PassiveSystem nhan (eventBus, skillManager,
// skillSystem) that - eventBus that de emit event, 2 manager con lai
// stub toi gian vi PassiveSystem chi goi getPassiveSkills() +
// getEffectiveSkill().

interface Harness {
  system: PassiveSystem
  bus: EventBus
  appliedBuffs: string[]
  hpRatio: number | undefined
}

function makeHarness(options: {
  skill: Partial<Skill>
  hpRatio?: number
}): Harness {
  const skill: Skill = {
    id: 'test_passive',
    name: 'Test Passive',
    description: '',
    type: 'passive',
    level: 1,
    maxLevel: 1,
    cooldown: 0,
    target: 'self',
    effects: [],
    ...options.skill,
  }

  const bus = new EventBus()
  const skillManager = {
    getPassiveSkills: () => [skill],
  } as unknown as SkillManager

  const skillSystem = {
    getEffectiveSkill: (input: Skill) => input,
  } as unknown as SkillSystem

  const appliedBuffs: string[] = []
  const hpRatio = options.hpRatio

  const system = new PassiveSystem(
    bus,
    skillManager,
    skillSystem,
    (buffId: string) => {
      appliedBuffs.push(buffId)
    },
    hpRatio === undefined ? undefined : () => hpRatio,
  )

  return { system, bus, appliedBuffs, hpRatio: options.hpRatio }
}

function modifier(overrides: Partial<StatModifier> = {}): StatModifier {
  return {
    id: 'test_mod',
    sourceId: 'test_passive',
    sourceType: 'skill',
    stat: 'defense',
    percent: 0.02,
    ...overrides,
  }
}

describe('PassiveSystem — E2 passiveCondition + passiveConvertsTo (spec talent v4 §3.3)', () => {
  it('passiveCondition hpBelow — HP trên ngưỡng KHÔNG tích stack, dưới ngưỡng tích', () => {
    const mod = modifier({ maxStacks: 10 })
    const { bus, hpRatio } = makeHarness({
      skill: {
        passiveTrigger: 'damage_taken',
        passiveModifiers: [mod],
        passiveCondition: { kind: 'hpBelow', percent: 0.35 },
      },
      hpRatio: 0.5,
    })

    const event: CombatEventPayload = { type: 'damage', targetId: PLAYER_ID }
    bus.emit('damage', event)

    // Chua tung addStack -> field stacks chua duoc gan (undefined != 0 la
    // dung ngu nghia "khong co stack nao duoc tich").
    expect(mod.stacks).toBeUndefined()

    // hpRatio la closure - ha HP bang cach dung harness thu 2 voi cung
    // modifier object (stacks van 0 tu lan dau).
    const mod2 = modifier({ maxStacks: 10 })
    const low = makeHarness({
      skill: {
        passiveTrigger: 'damage_taken',
        passiveModifiers: [mod2],
        passiveCondition: { kind: 'hpBelow', percent: 0.35 },
      },
      hpRatio: 0.2,
    })

    low.bus.emit('damage', { type: 'damage', targetId: PLAYER_ID } satisfies CombatEventPayload)

    expect(mod2.stacks).toBe(1)
    expect(hpRatio).toBe(0.5)
  })

  it('passiveConvertsTo — modifier chạm maxStacks → apply buff đúng 1 lần, stack reset về 0', () => {
    const mod = modifier({ maxStacks: 3 })
    const { bus, appliedBuffs } = makeHarness({
      skill: {
        passiveTrigger: 'critical',
        passiveModifiers: [mod],
        passiveConvertsTo: { buffId: 'kiem_vuc' },
      },
    })

    const event: CombatEventPayload = { type: 'critical', sourceId: PLAYER_ID }
    bus.emit('critical', event)
    bus.emit('critical', event)
    expect(mod.stacks).toBe(2)
    expect(appliedBuffs).toEqual([])

    // Lan thu 3 - cham maxStacks 3 -> bung no.
    bus.emit('critical', event)

    expect(appliedBuffs).toEqual(['kiem_vuc'])
    expect(mod.stacks).toBe(0)
  })

  it('KHÔNG có passiveConvertsTo — chạm maxStacks stack giữ nguyên (hành vi cũ)', () => {
    const mod = modifier({ maxStacks: 2 })
    const { bus, appliedBuffs } = makeHarness({
      skill: {
        passiveTrigger: 'critical',
        passiveModifiers: [mod],
      },
    })

    const event: CombatEventPayload = { type: 'critical', sourceId: PLAYER_ID }
    bus.emit('critical', event)
    bus.emit('critical', event)
    bus.emit('critical', event)

    expect(mod.stacks).toBe(2)
    expect(appliedBuffs).toEqual([])
  })

  it('tick per_second + passiveCondition — giây trôi qua nhưng HP cao → không tích', () => {
    const mod = modifier({ maxStacks: 10 })
    const { system } = makeHarness({
      skill: {
        passiveTrigger: 'per_second',
        passiveModifiers: [mod],
        passiveCondition: { kind: 'hpBelow', percent: 0.35 },
      },
      hpRatio: 0.9,
    })

    system.tick(3)

    // Dieu kien chan truoc khi tich - stacks chua duoc gan lan nao.
    expect(mod.stacks).toBeUndefined()
  })

  it('buffApplier undefined (PassiveSystem dựng kiểu cũ) — convert tự no-op, không crash', () => {
    const mod = modifier({ maxStacks: 1 })
    const skill: Skill = {
      id: 'test_passive',
      name: 'Test Passive',
      description: '',
      type: 'passive',
      level: 1,
      maxLevel: 1,
      cooldown: 0,
      target: 'self',
      effects: [],
          passiveTrigger: 'critical',
      passiveModifiers: [mod],
      passiveConvertsTo: { buffId: 'kiem_vuc' },
    }

    const bus = new EventBus()
    const _legacy = new PassiveSystem(
      bus,
      { getPassiveSkills: () => [skill] } as unknown as SkillManager,
      { getEffectiveSkill: (input: Skill) => input } as unknown as SkillSystem,
    )

    expect(() => {
      bus.emit('critical', { type: 'critical', sourceId: PLAYER_ID } satisfies CombatEventPayload)
    }).not.toThrow()

    // Stack van reset theo nhip du khong co applier (ke hoach: applier
    // la duong apply buff that; vang applier thi bung no bi bo qua nhung
    // stack reset - tranh tich ket vo han o maxStacks).
    expect(mod.stacks).toBe(0)
  })
})
