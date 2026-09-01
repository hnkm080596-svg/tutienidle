import { describe, expect, it, vi } from 'vitest'
import { BattleSystem } from './BattleSystem'
import { CombatSystem } from '../combat/CombatSystem'
import { SkillManager } from '../skill/SkillManager'
import { SkillSystem } from '../skill/SkillSystem'
import { SkillEffectSystem } from '../skill/SkillEffectSystem'
import { BuffRegistry } from '../buff/BuffRegistry'
import { AilmentRegistry } from '../ailment/AilmentRegistry'
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

function makeOnHitSkill(): Skill {
  return {
    id: 'test_onhit_skill', name: 'Test onHit Skill', description: '',
    type: 'active', level: 1, maxLevel: 1, cooldown: 0, remainingCooldown: 0,
    cost: 0, resourceType: 'none', target: 'enemy', effects: [],
    triggers: [
      { trigger: 'onCast', actions: [{ type: 'dealDamage', value: 5, damageType: 'physical' }] },
      { trigger: 'onHit', actions: [{ type: 'grantResource', pool: 'kimThe', amount: 1 }] },
    ],
    execution: { kind: 'attack_speed', attackSpeedMultiplier: 1 },
    loadoutSlot: 0, loadoutSlots: [0], unlocked: true, equipped: true,
  }
}

function makeOnHitCritSkill(): Skill {
  return {
    id: 'test_onhit_crit_skill', name: 'Test onHit/onCrit Skill', description: '',
    type: 'active', level: 1, maxLevel: 1, cooldown: 0, remainingCooldown: 0,
    cost: 0, resourceType: 'none', target: 'enemy', effects: [],
    triggers: [
      { trigger: 'onCast', actions: [{ type: 'dealDamage', value: 5, damageType: 'physical' }] },
      { trigger: 'onHit', actions: [{ type: 'grantResource', pool: 'kimThe', amount: 1 }] },
      { trigger: 'onCrit', actions: [{ type: 'grantResource', pool: 'hoaThe', amount: 1 }] },
    ],
    execution: { kind: 'attack_speed', attackSpeedMultiplier: 1 },
    loadoutSlot: 0, loadoutSlots: [0], unlocked: true, equipped: true,
  }
}

function setup(skill: Skill, rollCritical: () => boolean = () => false) {
  const eventBus = new EventBus()
  const skillManager = new SkillManager()
  const skillSystem = new SkillSystem(skillManager)
  const system = new BattleSystem(
    new CombatSystem(eventBus), skillManager, skillSystem, new SkillEffectSystem(),
    new BuffRegistry(), new AilmentRegistry(), eventBus,
    new ActionImpactSystem({ eventBus, rollCritical }),
    undefined, undefined, undefined,
    () => 'kiem_tran', () => 0, () => 0,
  )
  skillManager.add(skill)
  return { system }
}

describe('BattleSystem — onHit/onCrit/onEvade trigger wiring', () => {
  it('a skill with an onHit-bound action runs it after a landed hit', () => {
    const skill = makeOnHitSkill()
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

    system.update(3)
    system.update(0.2)

    expect(player.currentKimThe).toBeGreaterThan(0)
  })

  it('a landed critical hit fires BOTH onHit-bound and onCrit-bound actions', () => {
    const skill = makeOnHitCritSkill()
    const { system } = setup(skill, () => true)

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

    system.update(3)
    system.update(0.2)

    expect(player.currentKimThe).toBeGreaterThan(0)
    expect(player.currentHoaThe).toBeGreaterThan(0)
  })

  it('an evaded attack does NOT fire the attacker skill\'s onHit-bound action', () => {
    const skill = makeOnHitSkill()
    const { system } = setup(skill)

    const player = createCombatant({ id: 'player', type: 'player' })
    player.stats.attackSpeed = 10
    player.stats.attackRange = 999999
    player.stats.accuracyRating = 0
    const enemy = createCombatant({ id: 'enemy' })
    enemy.stats.maxHp = 100000
    enemy.maxHp = 100000
    enemy.currentHp = 100000
    enemy.stats.evasionRate = 1_000_000

    // getHitChance floors at a 5% minimum hit chance, so evasion alone
    // can't guarantee a miss deterministically — force the dodge roll
    // (CombatSystem.resolveActionHit reads Math.random() directly, no
    // injectable seam) so this assertion doesn't flake.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999999)

    try {
      system.start(player, enemy)
      system.flushPendingSpawns()
      enemy.x = HERO_COLUMN

      system.update(3)
      system.update(0.2)

      expect(player.currentKimThe).toBe(0)
    } finally {
      randomSpy.mockRestore()
    }
  })
})
