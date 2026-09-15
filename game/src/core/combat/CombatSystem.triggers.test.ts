import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { SkillManager } from '../skill/SkillManager'
import { BuffRegistry } from '../buff/BuffRegistry'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'
import type { Skill } from '../skill/Skill'

function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, criticalRate: 0, blockChance: 0 })
  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

// Deliberately binds BOTH onKill and onDeath so the "onDeath does not fire"
// test (2026-09-01 review ruling) can prove the onKill grant lands while
// the onDeath grant never does.
function makeKillSkill(): Skill {
  return {
    id: 'test_kill_skill',
    name: 'Test Kill Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 1,
    cooldown: 0,
    target: 'enemy',
    effects: [],
    triggers: [
      { trigger: 'onKill', actions: [{ type: 'consumeResource', pool: 'breakGauge', amount: 1 }] },
      { trigger: 'onDeath', actions: [{ type: 'consumeResource', pool: 'breakGauge', amount: 1 }] },
    ],
    unlocked: true,
    equipped: true,
  }
}

// buffRegistry is a shared, non-battle-specific
// dependency (2026-09-01 review ruling) — CombatSystem now takes it
// as an optional final constructor param alongside skillManager, and
// fireKillTriggers() only fires when ALL of them are provided (an empty
// throwaway registry would THROW on a `.get()` miss, so the fix is to
// skip firing entirely, not to construct one).
function makeFullyWiredCombat(skillManager: SkillManager, eventBus: EventBus): CombatSystem {
  return new CombatSystem(eventBus, skillManager, new BuffRegistry())
}

describe('CombatSystem — onKill trigger wiring', () => {
  it('killIfDead() fires onKill on the killer when killer + skillId are passed and all deps are wired', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    skillManager.add(makeKillSkill())
    const combat = makeFullyWiredCombat(skillManager, eventBus)

    const killer = makeEntity({ id: 'killer',})
    const victim = makeEntity({ id: 'victim', currentHp: 0, currentBreakGauge: 5, breakGaugeMax: 100 })

    // killIfDead's 3rd param bundles killer entity + skillId into one
    // options object — only fires onKill when BOTH are supplied (callers
    // with only a killerId string, or no skillId, skip firing).
    combat.killIfDead(victim, 'killer', { killer, skillId: 'test_kill_skill' })

    expect(victim.currentBreakGauge).toBe(4)
  })

  it('killIfDead() does not fire onDeath (deferred — see fireKillTriggers doc)', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    skillManager.add(makeKillSkill())
    const combat = makeFullyWiredCombat(skillManager, eventBus)

    const killer = makeEntity({ id: 'killer',})
    const victim = makeEntity({ id: 'victim', currentHp: 0, currentBreakGauge: 5, breakGaugeMax: 100 })

    combat.killIfDead(victim, 'killer', { killer, skillId: 'test_kill_skill' })

    // onKill (killer's own skill) fires once; onDeath (would require
    // looking up the VICTIM's own skills, which CombatSystem cannot do
    // today) does not — the breakGauge drops exactly once.
    expect(victim.currentBreakGauge).toBe(4)
  })

  it('killIfDead() does not fire onKill when skillContext is omitted', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    skillManager.add(makeKillSkill())
    const combat = makeFullyWiredCombat(skillManager, eventBus)

    const killer = makeEntity({ id: 'killer',})
    const victim = makeEntity({ id: 'victim', currentHp: 0, currentBreakGauge: 5, breakGaugeMax: 100 })

    combat.killIfDead(victim, 'killer')

    expect(victim.currentBreakGauge).toBe(5)
  })

  it('killIfDead() does not fire onKill (or throw) when buffRegistry was not constructed', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    skillManager.add(makeKillSkill())
    // Only skillManager wired — buffRegistry omitted,
    // same as most existing call sites today.
    const combat = new CombatSystem(eventBus, skillManager)

    const killer = makeEntity({ id: 'killer',})
    const victim = makeEntity({ id: 'victim', currentHp: 0, currentBreakGauge: 5, breakGaugeMax: 100 })

    expect(() =>
      combat.killIfDead(victim, 'killer', { killer, skillId: 'test_kill_skill' }),
    ).not.toThrow()

    expect(victim.currentBreakGauge).toBe(5)
  })

  it('killIfDead() does not throw when no skillManager was constructed', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const killer = makeEntity({ id: 'killer' })
    const victim = makeEntity({ id: 'victim', currentHp: 0 })

    expect(() =>
      combat.killIfDead(victim, 'killer', { killer, skillId: 'test_kill_skill' }),
    ).not.toThrow()
  })
})
