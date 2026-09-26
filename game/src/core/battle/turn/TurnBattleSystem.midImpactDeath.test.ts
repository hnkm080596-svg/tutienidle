import { describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant, type TurnDeclaredAction } from './TurnBattleSystem'
import type { TurnSkillDefinition } from './TurnSkillAction'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import type { BuffDefinitionId } from '../contracts/ids'
import { makeTestBuffRegistry, makeTurnRuntime } from './testing/TurnRuntimeFixtures'

// Mission C Task 7 (audit T3-22b) - REFRAMED for the The Tu beta
// reflect redesign: a reflect can no longer kill the actor MID-impact
// (design authority: max ONE reflect per hostile ACTION, the action's
// hits settle first). These tests now pin the new contract instead:
// the hostile action resolves fully (every target, every instance),
// then each reflect-holder emits exactly ONE 'reflection' op at the
// action-end flush - a lethal reflect still kills the actor, just
// after its swing, not during it.

function reflectDef(id: string, maxHpRatio: number): BuffDefinition {
  return {
    id: id as BuffDefinitionId,
    name: id,
    kind: 'buff',
    instanceScope: 'per_target',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 99, scaling: 'fixed' },
    capabilities: [
      {
        id: `${id}.reflect`,
        type: 'reactive_trigger',
        payload: {
          trigger: 'onImpactLanded',
          chance: 1,
          reflectsDamage: { maxHpRatio },
        },
      },
    ],
    dispellable: true,
  }
}

// Lethal reflect: holder maxHp 1e6 x ratio 1 kills the 50-hp actor.
const LETHAL_REFLECT = reflectDef('qa_lethal_reflect', 1)

// Non-lethal reflect: fires but cannot kill (1e6 x 1e-7 = 0.1).
const SOFT_REFLECT = reflectDef('qa_soft_reflect', 0.0000001)

const REGISTRY = makeTestBuffRegistry([LETHAL_REFLECT, SOFT_REFLECT])

const AOE_SKILL: TurnSkillDefinition = {
  id: 'aoe_test',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'all_lanes', columnRadius: 99 },
}

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })
  const vitalsStats = overrides.stats ?? stats
  return {
    id, name: id, type: 'enemy', stats: vitalsStats,
    currentHp: vitalsStats.maxHp, maxHp: vitalsStats.maxHp, currentMp: vitalsStats.maxMp,
    currentWard: 0, turnsSinceLastHitLanded: Infinity, realmIndex: 0, x: 0, row: 2, alive: true,
    ...overrides,
    baseStats: overrides.baseStats ?? overrides.stats ?? stats,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity): TurnBattleParticipant {
  return {
    id, entity, speed: 10, priority: 0, actionGauge: 0, alive: entity.alive,
    consecutiveHardCcTurns: 0,
  }
}

function fixture() {
  // Fragile actor: any lethal reflect kills it on the FIRST landed hit.
  // maxHp goes inside the stats - refreshParticipantStats clamps vitals
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

  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: REGISTRY,
    participants: () => [actor, target1, target2],
    combatSystem: combat,
  })

  const battle: TurnBattle = {
    players: [actor],
    enemies: [target1, target2],
    state: 'fighting',
  }

  const system = new TurnBattleSystem(combat, 10_000, REGISTRY, undefined, runtime)

  return { battle, system, actor, target1, target2, combat, runtime }
}

function applyReflect(
  runtime: ReturnType<typeof makeTurnRuntime>,
  target: TurnBattleParticipant,
  def: BuffDefinition,
) {
  runtime.applyBuff(def.id, target)
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

describe('reflect settles once per hostile action after the action completes (T3-22b, beta reframed)', () => {
  it('AoE into two lethal reflectors: both targets are hit, then one reflect each kills the actor', () => {
    const { battle, system, actor, target1, target2, combat, runtime } = fixture()
    applyReflect(runtime, target1, LETHAL_REFLECT)
    applyReflect(runtime, target2, LETHAL_REFLECT)

    const damageSpy = vi.spyOn(combat, 'applyModifiedDirectDamage')
    const result = system.applyActionImpact(battle, aoeDeclared(actor, battle))

    // The action settled fully - both targets damaged before any reflect.
    expect(target1.entity.currentHp).toBeLessThan(target1.entity.maxHp)
    expect(target2.entity.currentHp).toBeLessThan(target2.entity.maxHp)
    expect(result.targetIds).toEqual(['enemy1', 'enemy2'])
    // One reflect lands (the first kills the actor; a dead attacker's
    // remaining pending entries skip at flush). Actor dies post-action.
    expect(damageSpy.mock.calls.filter((c) => c[3] === 'reflection')).toHaveLength(1)
    expect(actor.entity.alive).toBe(false)
  })

  it('non-lethal reflection still lets the AoE finish (no over-guard)', () => {
    const { battle, system, actor, target1, target2, runtime } = fixture()
    applyReflect(runtime, target1, SOFT_REFLECT)
    applyReflect(runtime, target2, SOFT_REFLECT)

    const result = system.applyActionImpact(battle, aoeDeclared(actor, battle))

    expect(actor.entity.alive).toBe(true)
    expect(target1.entity.currentHp).toBeLessThan(target1.entity.maxHp)
    expect(target2.entity.currentHp).toBeLessThan(target2.entity.maxHp)
    expect(result.targetIds).toEqual(['enemy1', 'enemy2'])
  })

  it('charge-resolve branch: lethal reflectors damage both targets, then the reflect kills the actor at flush', () => {
    const { battle, system, actor, target1, target2, runtime } = fixture()
    applyReflect(runtime, target1, LETHAL_REFLECT)
    applyReflect(runtime, target2, LETHAL_REFLECT)

    const declared = aoeDeclared(actor, battle)
    declared.isCharging = true
    declared.chargeResolved = true
    declared.chargeTargetIds = ['enemy1', 'enemy2']
    declared.chargedSkill = AOE_SKILL

    system.applyActionImpact(battle, declared)

    expect(target1.entity.currentHp).toBeLessThan(target1.entity.maxHp)
    expect(target2.entity.currentHp).toBeLessThan(target2.entity.maxHp)
    expect(actor.entity.alive).toBe(false)
  })

  it('applyExtraImpact (dynamicBasic provider impact): the extra settles fully, then the reflect kills the actor', () => {
    const { battle, system, actor, target1, target2, runtime } = fixture()
    applyReflect(runtime, target1, LETHAL_REFLECT)
    applyReflect(runtime, target2, LETHAL_REFLECT)

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
    // leaves enemy1 unharmed - the extra impact is the only damage lane.
    const declared = aoeDeclared(actor, battle)
    declared.action = {
      skillId: 'self_ping', skill: null, targeting: { shape: 'single' }, slot: null,
    }
    declared.scaledDamage = null
    declared.affected = [target1]

    const result = system.applyActionImpact(battle, declared)

    expect(target1.entity.currentHp).toBeLessThan(target1.entity.maxHp)
    expect(target2.entity.currentHp).toBeLessThan(target2.entity.maxHp)
    expect(actor.entity.alive).toBe(false)
    expect(result.extraImpacts).toHaveLength(1)
  })

  it('multi-instance lane: all instances settle, then the single reflect kills the actor', () => {
    // The Tu beta - the once-per-action reflect waits for the action's
    // multi-hit payload to settle: a lethal reflect can no longer stop
    // instances 2..N mid-swing; it lands once at the action end.
    const { battle, system, actor, target1, combat, runtime } = fixture()
    applyReflect(runtime, target1, LETHAL_REFLECT)

    const hitSpy = vi.spyOn(combat, 'resolveActionHit')

    const multiInstance: TurnSkillDefinition = {
      id: 'phi_kiem_x3',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      instances: { count: 3 },
    }
    const declared = aoeDeclared(actor, battle)
    declared.affected = [target1]
    declared.action = {
      skillId: multiInstance.id,
      skill: multiInstance,
      damage: multiInstance.damage,
      targeting: multiInstance.targeting,
      slot: null,
    }
    declared.scaledDamage = multiInstance.damage ?? null

    const damageSpy = vi.spyOn(combat, 'applyModifiedDirectDamage')
    const result = system.applyActionImpact(battle, declared)

    // 3 hits land, ONE reflect (merge across hits), actor dies at flush.
    expect(hitSpy).toHaveBeenCalledTimes(3)
    expect(damageSpy.mock.calls.filter((c) => c[3] === 'reflection')).toHaveLength(1)
    expect(target1.entity.currentHp).toBeLessThan(target1.entity.maxHp)
    expect(result.targetIds).toEqual(['enemy1'])
    expect(actor.entity.alive).toBe(false)
  })
})

describe('post-mortem retaliation (spec 2.5: dead holder still reflects)', () => {
  it('a reflect holder killed by the triggering hit still emits ONE reflection at flush', () => {
    // Enemy actor: lethal might so the triggering hit kills the holder.
    const attackerEntity = createCombatant('enemy', {
      stats: createBaseStats({ might: 999_999, speed: 100, criticalRate: 0, evasionRate: 0, dexterity: 0, maxHp: 1_000_000 }),
    })
    attackerEntity.baseStats = attackerEntity.stats

    // Fragile holder: dies to the hit, but its reflect is maxHp-derived.
    const holderEntity = createCombatant('player', {
      type: 'player', row: 4,
      stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0, maxHp: 100 }),
    })
    holderEntity.baseStats = holderEntity.stats

    const attacker = makeParticipant('enemy', attackerEntity)
    const holder = makeParticipant('player', holderEntity)

    const combat = new CombatSystem(new EventBus())
    const runtime = makeTurnRuntime({
      registry: REGISTRY,
      participants: () => [attacker, holder],
      combatSystem: combat,
    })
    const battle: TurnBattle = { players: [holder], enemies: [attacker], state: 'fighting' }
    const system = new TurnBattleSystem(combat, 10_000, REGISTRY, undefined, runtime)

    applyReflect(runtime, holder, SOFT_REFLECT)

    const declared = aoeDeclared(attacker, battle)
    declared.opposingSide = battle.players
    declared.affected = [holder]

    const damageSpy = vi.spyOn(combat, 'applyModifiedDirectDamage')
    system.applyActionImpact(battle, declared)

    expect(holder.entity.alive).toBe(false)
    // Post-mortem: the dead holder still emits its one reflect.
    expect(damageSpy.mock.calls.filter((c) => c[3] === 'reflection')).toHaveLength(1)
  })
})

describe('attacker-dead-before-flush (cleanA3-INT-2 pin)', () => {
  it('a queued reflect drops silently when the attacker dies mid-action (ward_break kickback)', () => {
    // Attacker: fragile - the ward_break kickback kills it mid-hit.
    const attackerEntity = createCombatant('enemy', {
      type: 'enemy', row: 4,
      stats: createBaseStats({ might: 100, speed: 100, criticalRate: 0, evasionRate: 0, dexterity: 0, maxHp: 50 }),
    })
    attackerEntity.baseStats = attackerEntity.stats

    // Holder: reflect def + a thin native ward whose break kicks back
    // wardMax x wardBreakDamagePercent = 1000 x 1 = 1000 damage.
    const holderStats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0, maxHp: 1_000_000 })
    holderStats.wardMax = 1000
    holderStats.wardBreakDamagePercent = 1
    const holderEntity = createCombatant('player', { type: 'player', stats: holderStats })
    holderEntity.baseStats = holderEntity.stats
    holderEntity.currentWard = 10

    const attacker = makeParticipant('enemy', attackerEntity)
    const holder = makeParticipant('player', holderEntity)

    const combat = new CombatSystem(new EventBus())
    const runtime = makeTurnRuntime({
      registry: REGISTRY,
      participants: () => [attacker, holder],
      combatSystem: combat,
    })
    const battle: TurnBattle = { players: [holder], enemies: [attacker], state: 'fighting' }
    const system = new TurnBattleSystem(combat, 10_000, REGISTRY, undefined, runtime)

    applyReflect(runtime, holder, SOFT_REFLECT)

    const declared = aoeDeclared(attacker, battle)
    declared.opposingSide = battle.players
    declared.affected = [holder]

    const damageSpy = vi.spyOn(combat, 'applyModifiedDirectDamage')
    system.applyActionImpact(battle, declared)

    // The ward_break kickback killed the attacker mid-action; its
    // queued reflect drops at the action-end flush (no reflection op).
    expect(attacker.entity.alive).toBe(false)
    expect(damageSpy.mock.calls.filter((c) => c[3] === 'ward_break')).toHaveLength(1)
    expect(damageSpy.mock.calls.filter((c) => c[3] === 'reflection')).toHaveLength(0)
  })
})
