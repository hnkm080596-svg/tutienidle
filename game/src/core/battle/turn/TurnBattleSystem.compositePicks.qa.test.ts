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
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { makeTurnRuntime } from './testing/TurnRuntimeFixtures'
import {
  PHAN_CHAN_BUFF,
  PHAN_CHAN_BASE_RATIO,
} from '../../../data/buff/TheTuBuffs'
import type { EntityVitalsChangedEvent } from '../../combat/EntityVitalsSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { FunctionCombatRng } from '../runtime/rng/FunctionCombatRng'
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
  // M8 flake fix - stats.maxHp must agree with the 1M currentHp/maxHp
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

    // A custom skill ID - the element_basic lane resolves the pool
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

// Regression guard - composite EXTRA picks once resolved through bare
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
  it('landed picks reflect through the defender phan_chan passive (one action -> ONE reflect)', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)

    const attackerP = makeParticipant('player', makeRegressEntity('player', 100), 0)
    const defenderP = makeParticipant('enemy', makeRegressEntity('enemy', 0), 1)
    defenderP.entity.type = 'enemy'

    const runtime = makeTurnRuntime({
      registry: BUFF_REGISTRY,
      participants: () => [attackerP, defenderP],
      combatSystem: combat,
    })
    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)

    runtime.applyBuff(PHAN_CHAN_BUFF.id, defenderP)

    // No randomness control needed - every roll in this path is
    // deterministic by construction: hits land (accuracy 9999 vs
    // evasion 0 -> chance 1.0), no crit/block (chance 0), and the
    // reflect trigger's authored chance is 1.0. The reflect roll reads
    // the runtime rng seam inside CombatProcSystem, but chance 1.0
    // always fires; no reactiveProc effect is in play, so the injected
    // rng seam is not exercised here.

    const battle: TurnBattle = {
      players: [attackerP],
      enemies: [defenderP],
      state: 'fighting',
    }

    const reflectAmounts: number[] = []
    const defenderHits: number[] = []
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
      if (event.reason === 'reflection' && event.entityId === attackerP.entity.id) {
        reflectAmounts.push(event.amount)
      }
      if (event.reason === 'damage' && event.entityId === defenderP.entity.id) {
        defenderHits.push(event.amount)
      }
    })

    system.applyActionImpact(
      battle,
      declaredCompositeCast(attackerP, [defenderP], battle.enemies),
    )

    // Each pick takes 100 hpDamage (might 100, zero mitigation); the
    // beta reflect rule is ONCE PER hostile ACTION (the composite cast
    // is one action, its hits settle first) at holder maxHp x ratio.
    const expectedReflect = 1_000_000 * PHAN_CHAN_BASE_RATIO

    // Both picks landed through the shared hit pipeline (regression
    // signal for the extra-pick lane); exactly one reflect fires per
    // action now that reflects merge per hostile action.
    expect(defenderHits).toHaveLength(2)
    expect(reflectAmounts).toEqual([expectedReflect])
    expect(1_000_000 - attackerP.entity.currentHp).toBe(expectedReflect)
  })

  it('a landed multi-pick composite opens ONE defender phan_mon window (once per action)', () => {
    const eventBus = new EventBus()
    const combat = new CombatSystem(eventBus)
    // Injected rng pinned low: every onImpactLanded proc roll draws
    // from the rng seam and succeeds - reactive chances hard-cap at
    // REACTIVE_CHANCE_CAP = 0.6, so the roll must be < 0.6 (a high
    // dodge-style value would suppress it). Hits land by construction
    // (accuracy 9999 vs evasion 0), so the global Math.random needs
    // no spy.
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

    const rng = new FunctionCombatRng(() => 0)
    const runtime = makeTurnRuntime({
      registry: BUFF_REGISTRY,
      participants: () => [attackerP, defenderP],
      combatSystem: combat,
      rng,
    })
    const system = new TurnBattleSystem(
      combat,
      10,
      BUFF_REGISTRY,
      /*spawnEnemy*/ undefined,
      runtime,
      /*onSkillCast*/ undefined,
      /*liveStatModifiers*/ undefined,
      rng,
    )

    runtime.applyBuff('phan_mon', defenderP)
    // Ung The beta: the window is post-action and observation-gated --
    // quan_the makes the defender observe every attacker. The action
    // completes once, so both landed picks collapse into ONE window
    // (once-per-channel-per-action: multi-hit = one check).
    runtime.applyBuff('quan_the', defenderP)

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

    expect(counters).toHaveLength(1)
    expect(counters.map((entry) => entry.targetIds)).toEqual([['player']])
  })
})
