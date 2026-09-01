import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { SkillManager } from '../skill/SkillManager'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'
import type { Skill } from '../skill/Skill'

function makeEntity(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, criticalRate: 0, blockChance: 0 }
  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

function makeKillSkill(): Skill {
  return {
    id: 'test_kill_skill',
    name: 'Test Kill Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 1,
    cooldown: 0,
    remainingCooldown: 0,
    target: 'enemy',
    effects: [],
    triggers: [{ trigger: 'onKill', actions: [{ type: 'grantResource', pool: 'kimThe', amount: 1 }] }],
    unlocked: true,
    equipped: true,
  }
}

describe('CombatSystem — onKill/onDeath trigger wiring', () => {
  it('killIfDead() fires onKill on the killer when killer + skillId are passed', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    skillManager.add(makeKillSkill())
    // skillManager is threaded through as the one new optional final
    // constructor parameter (see Step 2/3 investigation in the task
    // report) — CombatSystem otherwise only required `eventBus`.
    const combat = new CombatSystem(eventBus, skillManager)

    const killer = makeEntity({ id: 'killer', currentKimThe: 0 })
    const victim = makeEntity({ id: 'victim', currentHp: 0 })

    // killIfDead's 3rd param bundles killer entity + skillId into one
    // options object — only fires onKill/onDeath when BOTH are supplied
    // (callers with only a killerId string, or no skillId, skip firing).
    combat.killIfDead(victim, 'killer', { killer, skillId: 'test_kill_skill' })

    expect(killer.currentKimThe).toBe(1)
  })

  it('killIfDead() does not fire onKill when skillContext is omitted', () => {
    const eventBus = new EventBus()
    const skillManager = new SkillManager()
    skillManager.add(makeKillSkill())
    const combat = new CombatSystem(eventBus, skillManager)

    const killer = makeEntity({ id: 'killer', currentKimThe: 0 })
    const victim = makeEntity({ id: 'victim', currentHp: 0 })

    combat.killIfDead(victim, 'killer')

    expect(killer.currentKimThe).toBe(0)
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
