import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TurnBattleSystem,
  type TurnBattle,
  type TurnBattleParticipant,
  type TurnDeclaredAction,
} from './TurnBattleSystem'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import {
  PHAN_CHINH_BUFF,
  PHAN_CHINH_MAXHP_RATIO,
  PHAN_CHINH_TAKEN_RATIO,
} from '../../../data/buff/TheTuBuffs'
import type { EntityVitalsChangedEvent } from '../../combat/EntityVitalsSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { TurnSkillDefinition } from './TurnSkillAction'

// AR-18 QA Probe:
// Generic composite actions must execute based on declarative compositePicks
// configuration on TurnSkillDefinition, without checking hardcoded content IDs.

const ELEMENTAL_BASIC_A: TurnSkillDefinition = {
  id: 'basic_a',
  cooldownTurns: 0,
  damage: { kind: 'elemental', multiplier: 1, components: [{ kind: 'element', element: 'fire', ratio: 1 }] },
  targeting: { shape: 'single' },
}

const ELEMENTAL_BASIC_B: TurnSkillDefinition = {
  id: 'basic_b',
  cooldownTurns: 0,
  damage: { kind: 'elemental', multiplier: 1, components: [{ kind: 'element', element: 'water', ratio: 1 }] },
  targeting: { shape: 'single' },
}

function makeEntity(id: string): CombatEntity {
  // M8 flake fix — stats.maxHp must agree with the 1M currentHp/maxHp
  // fixture below: refreshParticipantStats clamps currentHp to the
  // EFFECTIVE maxHp, so the old default (100) silently turned this
  // "immortal" target into a 100-hp one that a random ~5% crit (143)
  // killed, dropping the second composite pick's hit (~2-5% flake).
  const stats = createBaseStats({ might: 100, accuracyRating: 9999, evasionRate: 0, maxHp: 1_000_000 })
  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentThe: 0,

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, priority: number): TurnBattleParticipant {
  return {
    id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AR-18: Generic composite skill policy', () => {
  it('executes composite picks for a skill with compositePicks policy and an arbitrary ID', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const system = new TurnBattleSystem(combat, 10)

    const player = makeEntity('player')
    const enemy = makeEntity('enemy')
    enemy.type = 'enemy'

    const playerP = makeParticipant('player', player, 0)
    const enemyP = makeParticipant('enemy', enemy, 1)

    // A custom skill ID — the element_basic lane resolves the pool
    // attached ON the def (Task 11): picks[0] is the payload, extras
    // resolve through the shared composite-picks lane.
    const customCompositeSkill: TurnSkillDefinition = {
      id: 'custom_composite_skill_999',
      cooldownTurns: 2,
      compositePicks: { poolType: 'element_basic', count: 2, pool: [ELEMENTAL_BASIC_A, ELEMENTAL_BASIC_B] },
      targeting: { shape: 'single' },
    }

    playerP.basic = customCompositeSkill

    const battle: TurnBattle = {
      players: [playerP],
      enemies: [enemyP],
      state: 'fighting',
    }

    const hits: Array<{ damageType: string }> = []
    eventBus.on<{ damageType: string }>('damage', (e) => hits.push(e))

    system.resolveNextStep(battle)

    // Should have picked both elemental skills from pool and executed 2 hits.
    expect(hits).toHaveLength(2)
  })
})

// Regression guard — composite EXTRA picks once resolved through bare
// CombatSystem.resolveActionHit inside applyActionImpact's picks lane,
// skipping the shared resolveDeclaredHit() pipeline: no defender
// onImpactLanded reactive window (Phan counter) and no phan_chinh
// Reflection. The PRIMARY pick always went through resolveDeclaredHit, so
// every assertion below is a per-hit COUNT: primary + 1 extra = 2 taken
// hits on the defender -> 2 reactive consequences required.

const NO_MITIGATION = {
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  finalDamageReductionPercent: 0,
} as const

const COMPOSITE_PRIMARY_PICK: TurnSkillDefinition = {
  id: 'pick_primary',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

const COMPOSITE_EXTRA_PICK: TurnSkillDefinition = {
  id: 'pick_extra',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

const COMPOSITE_ROOT: TurnSkillDefinition = {
  id: 'composite_root',
  cooldownTurns: 0,
  compositePicks: {
    poolType: 'element_basic',
    count: 2,
    pool: [COMPOSITE_PRIMARY_PICK, COMPOSITE_EXTRA_PICK],
  },
  targeting: { shape: 'single' },
}

function makeRegressEntity(id: string, might: number): CombatEntity {
  const stats = createBaseStats({
    ...NO_MITIGATION,
    might,
    accuracyRating: 9999,
    maxHp: 1_000_000,
  })
  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentThe: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  } as CombatEntity
}

// Mirrors what declareActorAction produces for a composite cast:
// picks[0]'s payload on action.damage + scaledDamage, the extra pick on
// compositePickedSkills.
function declaredCompositeCast(
  actor: TurnBattleParticipant,
  affected: TurnBattleParticipant[],
  opposingSide: TurnBattleParticipant[],
): TurnDeclaredAction {
  return {
    actorId: actor.id,
    skillId: COMPOSITE_ROOT.id,
    ccBlocked: false,
    isCharging: false,
    chargeResolved: false,
    chargeTargetIds: [],
    chargedSkill: null,
    action: {
      skillId: COMPOSITE_ROOT.id,
      skill: COMPOSITE_ROOT,
      damage: COMPOSITE_PRIMARY_PICK.damage,
      targeting: COMPOSITE_PRIMARY_PICK.targeting,
      slot: null,
    },
    opposingSide,
    affected,
    scaledDamage: COMPOSITE_PRIMARY_PICK.damage ?? null,
    suddenDeathMultiplier: 1,
    compositePickedSkills: [COMPOSITE_EXTRA_PICK],
    isFollowUpBypass: false,
    actionSource: 'normal',
  }
}

describe('composite extra picks run the declared-hit pipeline', () => {
  it('each landed pick reflects through the defender phan_chinh emblem (2 hits -> 2 reflects)', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY)

    const attackerP = makeParticipant('player', makeRegressEntity('player', 100), 0)
    const defenderP = makeParticipant('enemy', makeRegressEntity('enemy', 0), 1)
    defenderP.entity.type = 'enemy'

    new BuffSystem(defenderP.buffs).apply(
      PHAN_CHINH_BUFF,
      defenderP.entity,
      defenderP.entity,
      BUFF_REGISTRY,
    )

    // Rolls pinned low: hits land (accuracy 9999 vs evasion 0), no
    // crit/block — reflect chance is authored 1.0 anyway.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const battle: TurnBattle = {
      players: [attackerP],
      enemies: [defenderP],
      state: 'fighting',
    }

    const reflectAmounts: number[] = []
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
      if (event.reason === 'reflection' && event.entityId === attackerP.entity.id) {
        reflectAmounts.push(event.amount)
      }
    })

    system.applyActionImpact(
      battle,
      declaredCompositeCast(attackerP, [defenderP], battle.enemies),
    )

    // Each hit takes 100 hpDamage (might 100, zero mitigation); each
    // taken hit owes hpDamage x takenRatio + holder maxHp x maxHpRatio.
    const expectedPerHit =
      100 * PHAN_CHINH_TAKEN_RATIO + 1_000_000 * PHAN_CHINH_MAXHP_RATIO

    // Pre-fix failure signature: only the primary hit reflects (1 event);
    // the composite extra pick bypassed rollReactiveTrigger entirely.
    expect(reflectAmounts).toEqual([expectedPerHit, expectedPerHit])
    expect(1_000_000 - attackerP.entity.currentHp).toBe(2 * expectedPerHit)
  })

  it('each landed pick opens the defender phan_mon taken window (2 hits -> 2 counters queued)', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY)

    const attackerP = makeParticipant('player', makeRegressEntity('player', 100), 0)
    const defenderP = makeParticipant('enemy', makeRegressEntity('enemy', 0), 1)
    defenderP.entity.type = 'enemy'

    // phan_mon marker: onImpactLanded counter at counterChance 1.0 with
    // enough The for two paid attempts.
    defenderP.entity.baseStats = asBaseStats({
      ...defenderP.entity.baseStats,
      counterChance: 1,
    })
    defenderP.entity.stats = { ...defenderP.entity.stats, counterChance: 1 }
    defenderP.entity.currentThe = 100
    new BuffSystem(defenderP.buffs).apply(
      BUFF_REGISTRY.get('phan_mon'),
      defenderP.entity,
      defenderP.entity,
      BUFF_REGISTRY,
    )

    // Rolls pinned low: hits land, no crit/block, every proc succeeds
    // (reactive chances hard-cap at REACTIVE_CHANCE_CAP = 0.6, so the
    // roll must be < 0.6 — a high dodge-style mock would suppress it).
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const battle: TurnBattle = {
      players: [attackerP],
      enemies: [defenderP],
      state: 'fighting',
    }

    system.applyActionImpact(
      battle,
      declaredCompositeCast(attackerP, [defenderP], battle.enemies),
    )

    const counters = (battle.queuedFollowUps ?? []).filter(
      (entry) => entry.actorId === 'enemy' && entry.actionSource === 'counter',
    )

    // Pre-fix failure signature: only the primary hit rolled the
    // defender's onImpactLanded proc -> 1 queued phan_kich; the extra
    // pick never reached resolveReactiveProcs.
    expect(counters).toHaveLength(2)
    expect(counters.map((entry) => entry.targetIds)).toEqual([['player'], ['player']])
  })
})
