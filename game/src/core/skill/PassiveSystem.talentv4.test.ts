import { describe, expect, it } from 'vitest'
import { PassiveSystem, PLAYER_ID } from './PassiveSystem'
import type { CombatEventPayload } from './PassiveSystem'
import { EventBus } from '../events/EventBus'
import type { SkillManager } from './SkillManager'
import type { SkillSystem } from './SkillSystem'
import type { Skill } from './Skill'
import type { StatModifier } from '../stats/StatCalculator'

// E2 (spec talent v4 2026-09-03 §3.3) — PassiveSystem mở 2 nhánh cho
// talent combat v4: passiveCondition (chỉ tích stack khi điều kiện HP
// của player đúng — đọc qua hpReader closure) và passiveConvertsTo
// (modifier chạm maxStacks → apply buff lên player qua buffApplier,
// reset stack về 0 — nhịp "tích → ngưỡng → bùng nổ → tích lại").
//
// Fixture pattern: PassiveSystem nhận (eventBus, skillManager,
// skillSystem) thật — eventBus thật để emit event, 2 manager còn lại
// stub tối giản vì PassiveSystem chỉ gọi getPassiveSkills() +
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
    remainingCooldown: 0,
    target: 'self',
    effects: [],
    unlocked: true,
    equipped: false,
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

    // Chưa từng addStack → field stacks chưa được gán (undefined ≠ 0 là
    // đúng ngữ nghĩa "không có stack nào được tích").
    expect(mod.stacks).toBeUndefined()

    // hpRatio là closure — hạ HP bằng cách dựng harness thứ 2 với cùng
    // modifier object (stacks vẫn 0 từ lần đầu).
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

    // Lần thứ 3 — chạm maxStacks 3 → bùng nổ.
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

    // Điều kiện chặn trước khi tích — stacks chưa được gán lần nào.
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
      remainingCooldown: 0,
      target: 'self',
      effects: [],
      unlocked: true,
      equipped: false,
      passiveTrigger: 'critical',
      passiveModifiers: [mod],
      passiveConvertsTo: { buffId: 'kiem_vuc' },
    }

    const bus = new EventBus()
    const legacy = new PassiveSystem(
      bus,
      { getPassiveSkills: () => [skill] } as unknown as SkillManager,
      { getEffectiveSkill: (input: Skill) => input } as unknown as SkillSystem,
    )

    expect(() => {
      bus.emit('critical', { type: 'critical', sourceId: PLAYER_ID } satisfies CombatEventPayload)
    }).not.toThrow()

    // Stack vẫn reset theo nhịp dù không có applier (kế hoạch: applier
    // là đường apply buff thật; vắng applier thì bùng nổ bị bỏ qua nhưng
    // stack reset — tránh tích kẹt vô hạn ở maxStacks).
    expect(mod.stacks).toBe(0)
  })
})
