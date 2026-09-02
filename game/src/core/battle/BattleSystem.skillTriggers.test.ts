import { describe, expect, it } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { EventBus } from '../events/EventBus'
import { ActionImpactSystem } from './ActionImpactSystem'
import { createBaseStats } from '../stats/StatBlock'
import { HERO_COLUMN } from './BattleLane'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

function createCombatant(overrides: Partial<CombatEntity>): CombatEntity {
  const stats = {
    ...createBaseStats(),
    attack: 0, defense: 0, evasionRate: 0, criticalRate: 0, blockChance: 0,
    dexterity: 0, attackRange: 0, attackSpeed: 0, movementSpeed: 0,
  }

  return {
    id: 'id', name: 'name', type: 'enemy', baseStats: stats, stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentSwordIntent: 0, currentKiemThe: 0, currentKiemYTemp: 0,
    currentMomentum: 0, currentHoaThe: 0, currentThoThe: 0, currentKimThe: 0,
    timeSinceLastBleedProc: 0, tuLucActive: false, tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0, currentWard: 0, timeSinceLastHitTaken: Infinity,
    realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
  }
}

function makeTriggerSkill(): Skill {
  return {
    id: 'test_trigger_skill',
    name: 'Test Trigger Skill',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 1,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    resourceType: 'none',
    target: 'enemy',
    effects: [],
    triggers: [
      { trigger: 'onCast', actions: [{ type: 'dealDamage', value: 5, damageType: 'physical' }] },
    ],
    execution: { kind: 'attack_speed', attackSpeedMultiplier: 1 },
    loadoutSlot: 0,
    loadoutSlots: [0],
    unlocked: true,
    equipped: true,
  }
}

function setup(skill: Skill) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const system = new BattleSystem(
    new CombatSystem(eventBus),
    skillManager,
    skillSystem,
    new SkillEffectSystem(),
    new BuffRegistry(),
    eventBus,
    new ActionImpactSystem({ eventBus, rollCritical: () => false }),
    undefined,
    undefined,
    undefined,
    () => 'kiem_tran',
    () => 0,
    () => 0,
  )

  skillManager.add(skill)

  return { system, skillSystem }
}

describe('BattleSystem — onCast trigger wiring', () => {
  it('a skill defined with triggers deals damage through the new engine', () => {
    const skill = makeTriggerSkill()
    const { system } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player' })
    player.stats.attackSpeed = 10
    player.stats.attackRange = 999999
    const enemy = createCombatant({ id: 'enemy' })
    enemy.stats.maxHp = 100000
    enemy.maxHp = 100000
    enemy.currentHp = 100000

    system.start(player, enemy)
    system.flushPendingSpawns()
    enemy.x = HERO_COLUMN

    system.update(3) // clear the opening countdown
    const hpBefore = enemy.currentHp
    system.update(0.2) // let the attack_speed cadence fire one cast

    expect(enemy.currentHp).toBeLessThan(hpBefore)
  })
})
