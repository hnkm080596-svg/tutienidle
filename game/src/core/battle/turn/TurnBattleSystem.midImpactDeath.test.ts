import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant, type TurnDeclaredAction } from './TurnBattleSystem'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'

// Mission C Task 7 (audit T3-22b) — a reflect/proc kill on the actor
// mid-AoE must stop the rest of the action: the dead cannot finish
// their swing. Every per-target loop in applyActionImpact (charged
// branch, composite picks, scaledDamage, non-damaging lane) and
// applyExtraImpact must bail once actor.entity.alive flips false.

// Lethal reflect: any landed hit returns enough damage to kill the
// fragile actor outright.
const LETHAL_REFLECT: BuffDefinition = {
  id: 'lethal_reflect',
  name: 'Lethal Reflect',
  polarity: 'buff',
  duration: 99,
  stackMode: 'refresh',
  effects: [{
    type: 'reactiveTrigger',
    trigger: 'onImpactLanded',
    chance: 1,
    reflectsDamage: { maxHpRatio: 0, takenRatio: 100 },
  }],
}

// Non-lethal reflect: fires but cannot kill.
const SOFT_REFLECT: BuffDefinition = {
  id: 'soft_reflect',
  name: 'Soft Reflect',
  polarity: 'buff',
  duration: 99,
  stackMode: 'refresh',
  effects: [{
    type: 'reactiveTrigger',
    trigger: 'onImpactLanded',
    chance: 1,
    reflectsDamage: { maxHpRatio: 0, takenRatio: 0.01 },
  }],
}

class Registry implements BuffDefinitionCatalog {
  private readonly defs = new Map<string, BuffDefinition>()
  constructor(defs: BuffDefinition[]) {
    for (const d of defs) this.defs.set(d.id, d)
  }
  get(id: string): BuffDefinition {
    const d = this.defs.get(id)
    if (!d) throw new Error(`missing buff: ${id}`)
    return d
  }
}

const REGISTRY = new Registry([LETHAL_REFLECT, SOFT_REFLECT])

const AOE_SKILL: TurnSkillDefinition = {
  id: 'aoe_test',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'all_lanes', columnRadius: 99 },
}

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })
  return {
    id, name: id, type: 'enemy', stats,
    currentHp: stats.maxHp, maxHp: stats.maxHp, currentMp: stats.maxMp,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
    baseStats: overrides.baseStats ?? overrides.stats ?? stats,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity): TurnBattleParticipant {
  return {
    id, entity, speed: 10, priority: 0, actionGauge: 0, alive: entity.alive,
    buffs: new BuffPool(), consecutiveHardCcTurns: 0,
  }
}

function fixture() {
  // Fragile actor: any lethal reflect kills it on the FIRST landed hit.
  // maxHp goes inside the stats — refreshParticipantStats clamps vitals
  // to the EFFECTIVE maxHp, so a hand-set field is wiped by the refresh.
  const actorEntity = createCombatant('player', {
    type: 'player', row: 4,
    stats: createBaseStats({ might: 100, speed: 100, criticalRate: 0, evasionRate: 0, dexterity: 0, maxHp: 50 }),
  })
  actorEntity.baseStats = actorEntity.stats

  // Sturdy targets: survive the hit, reflect back.
  const enemy1 = createCombatant('enemy1', {
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0, maxHp: 1_000_000 }),
  })
  const enemy2 = createCombatant('enemy2', {
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0, maxHp: 1_000_000 }),
  })
  enemy1.baseStats = enemy1.stats
  enemy2.baseStats = enemy2.stats

  const actor = makeParticipant('player', actorEntity)
  const target1 = makeParticipant('enemy1', enemy1)
  const target2 = makeParticipant('enemy2', enemy2)

  const battle: TurnBattle = {
    players: [actor],
    enemies: [target1, target2],
    state: 'fighting',
  }

  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, REGISTRY)

  return { battle, system, actor, target1, target2 }
}

function applyReflect(target: TurnBattleParticipant, def: BuffDefinition) {
  new BuffSystem(target.buffs).apply(def, target.entity, target.entity, REGISTRY)
}

function aoeDeclared(actor: TurnBattleParticipant, battle: TurnBattle): TurnDeclaredAction {
  return {
    actorId: actor.id,
    skillId: AOE_SKILL.id,
    ccBlocked: false,
    isCharging: false,
    chargeResolved: false,
    chargeTargetIds: [],
    chargedSkill: null,
    action: {
      skillId: AOE_SKILL.id,
      skill: AOE_SKILL,
      damage: AOE_SKILL.damage,
      targeting: AOE_SKILL.targeting,
      slot: null,
    },
    opposingSide: battle.enemies,
    affected: battle.enemies,
    scaledDamage: AOE_SKILL.damage ?? null,
    suddenDeathMultiplier: 1,
    compositePickedSkills: null,
    isFollowUpBypass: false,
    actionSource: 'normal',
  }
}

describe('mid-impact actor death stops the rest of the action (audit T3-22b)', () => {
  it('AoE into two lethal reflectors: target 1 kills the actor, target 2 takes no damage', () => {
    const { battle, system, actor, target1, target2 } = fixture()
    applyReflect(target1, LETHAL_REFLECT)
    applyReflect(target2, LETHAL_REFLECT)

    const result = system.applyActionImpact(battle, aoeDeclared(actor, battle))

    expect(actor.entity.alive).toBe(false)
    expect(target1.entity.currentHp).toBeLessThan(target1.entity.maxHp)
    expect(target2.entity.currentHp).toBe(target2.entity.maxHp)
    expect(result.targetIds).toEqual(['enemy1'])
  })

  it('non-lethal reflection still lets the AoE finish (no over-guard)', () => {
    const { battle, system, actor, target1, target2 } = fixture()
    applyReflect(target1, SOFT_REFLECT)
    applyReflect(target2, SOFT_REFLECT)

    const result = system.applyActionImpact(battle, aoeDeclared(actor, battle))

    expect(actor.entity.alive).toBe(true)
    expect(target1.entity.currentHp).toBeLessThan(target1.entity.maxHp)
    expect(target2.entity.currentHp).toBeLessThan(target2.entity.maxHp)
    expect(result.targetIds).toEqual(['enemy1', 'enemy2'])
  })

  it('charge-resolve branch: lethal reflect on target 1 skips remaining charge targets', () => {
    const { battle, system, actor, target1, target2 } = fixture()
    applyReflect(target1, LETHAL_REFLECT)
    applyReflect(target2, LETHAL_REFLECT)

    const declared = aoeDeclared(actor, battle)
    declared.isCharging = true
    declared.chargeResolved = true
    declared.chargeTargetIds = ['enemy1', 'enemy2']
    declared.chargedSkill = AOE_SKILL

    system.applyActionImpact(battle, declared)

    expect(actor.entity.alive).toBe(false)
    expect(target1.entity.currentHp).toBeLessThan(target1.entity.maxHp)
    expect(target2.entity.currentHp).toBe(target2.entity.maxHp)
  })

  it('applyExtraImpact (dynamicBasic provider impact): lethal reflect stops the extra payload', () => {
    const { battle, system, actor, target1, target2 } = fixture()
    applyReflect(target1, LETHAL_REFLECT)
    applyReflect(target2, LETHAL_REFLECT)

    // Non-damaging primary (self buff): actor survives its own cast, then
    // the provider's extra impact is the lethal-reflect lane.
    const extraImpactDef: TurnSkillDefinition = {
      id: 'extra_impact_test',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'all_lanes', columnRadius: 99 },
    }
    actor.dynamicBasic = {
      resolveBasic: () => AOE_SKILL,
      onCastResolved: () => [extraImpactDef],
    }

    // The provider hook lives inside the `affected.length > 0` action
    // block, so the primary lane needs a target; a non-damaging payload
    // leaves enemy1 unharmed — the extra impact is the only damage lane.
    const declared = aoeDeclared(actor, battle)
    declared.action = {
      skillId: 'self_ping', skill: null, targeting: { shape: 'single' }, slot: null,
    }
    declared.scaledDamage = null
    declared.affected = [target1]

    const result = system.applyActionImpact(battle, declared)

    expect(actor.entity.alive).toBe(false)
    expect(target1.entity.currentHp).toBeLessThan(target1.entity.maxHp)
    expect(target2.entity.currentHp).toBe(target2.entity.maxHp)
    expect(result.extraImpacts).toHaveLength(1)
  })
})
