import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TurnBattleSystem,
  type TurnBattle,
  type TurnBattleParticipant,
} from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { asBaseStats, createBaseStats } from '../../stats/StatBlock'
import { buffs as LIVE_BUFFS } from '../../../data/buff/buffs'
import { PHAN_KICH } from '../../../data/skill/TheTuSkills'
import type { BuffDefinition } from '../../buff2/BuffDefinition'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// Ung The beta - the reactive bypass contract (design Parts VI-XI): a
// queued entry resolves as a REAL action through declare -> impact but
// skips the ENTIRE natural-turn lifecycle (turn counter, round
// tracking, buff/DoT ticks, cooldowns, regen, resource deltas, charge
// advance, CC check, gauge) and opens NO new reactive windows (INV-9).
// The post-action Phan window pins: an observed enemy's action that
// resolved on the reactor rolls the marker's grant - success pays the
// flat cost, commits +1 Ung Tre debt, queues the payload.

const NO_MITIGATION = {
  evasionRate: 0,
  dexterity: 0,
  criticalRate: 0,
  defense: 0,
  endurancePercent: 0,
  blockChance: 0,
  finalDamageReductionPercent: 0,
} as const

function createCombatant(overrides: Partial<CombatEntity> = {}, speed = 10): CombatEntity {
  const stats = createBaseStats({ ...NO_MITIGATION, might: 100, speed })

  const entity = {
    id: 'id',
    name: 'name',
    type: 'enemy',
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
    baseStats: overrides.baseStats ?? overrides.stats ?? stats,
  } as CombatEntity

  const ceiling = Math.max(entity.maxHp, entity.currentHp)
  if (entity.stats.maxHp !== ceiling) {
    entity.stats = { ...entity.stats, maxHp: ceiling }
    entity.baseStats = asBaseStats({ ...entity.baseStats, maxHp: ceiling })
  }
  return entity
}


const TICKING_BUFF: BuffDefinition = {
  id: 'test_dot_host',
  name: 'host',
  kind: 'buff',
  polarity: 'buff',
  instanceScope: 'per_source',
  stacking: { maxStacks: 1, onReapplyStacks: 'replace', onReapplyDuration: 'refresh' },
  lifetime: { clock: 'holder_turns', duration: 5, scaling: 'fixed' },
  statModifiers: [{ stat: 'might', flat: 0 }],
  dispellable: true,
}

const KIT_REGISTRY = makeTestBuffRegistry([TICKING_BUFF, ...LIVE_BUFFS])

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

function makeBattle(): {
  battle: TurnBattle
  playerP: TurnBattleParticipant
  enemyP: TurnBattleParticipant
  combat: CombatSystem
  runtime: TurnRuntimeFixture
} {
  const player = createCombatant({ id: 'reactor', type: 'player', currentHp: 100_000, maxHp: 100_000 }, 10)
  const enemy = createCombatant({ id: 'enemy', currentHp: 100_000, maxHp: 100_000 }, 9)

  const playerP = makeParticipant('reactor', player, 10, 0)
  playerP.basic = {
    id: 'reactor_basic',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }
  playerP.reactivePayloads = { phan_kich: { ...PHAN_KICH } }
  playerP.special = {
    skill: { id: 'sp', cooldownTurns: 5, targetScope: 'self', targeting: { shape: 'single' } },
    remainingCooldownTurns: 3,
  }

  const enemyP = makeParticipant('enemy', enemy, 9, 100)
  enemyP.basic = {
    id: 'enemy_hit',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }

  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: KIT_REGISTRY,
    participants: () => [playerP, enemyP],
    combatSystem: combat,
  })
  return { battle: { players: [playerP], enemies: [enemyP], state: 'fighting' }, playerP, enemyP, combat, runtime }
}

function buffsOf(runtime: TurnRuntimeFixture, participant: TurnBattleParticipant, id: string) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === id)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('reactive bypass contract (spec 7.1)', () => {
  it('queued payload entry resolves the payload skill against the captured target through declare -> impact', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    battle.queuedFollowUps = [
      {
        actorId: 'reactor',
        executionKind: 'reactive_bypass',
        actionSource: 'counter',
        triggerContext: { origin: 'enemy_hit', outcome: 'taken' },
        payloadSkillId: 'phan_kich',
        targetIds: ['enemy'],
      },
    ]

    const enemyHpBefore = enemyP.entity.currentHp
    const system = new TurnBattleSystem(combat, 10_000, KIT_REGISTRY, undefined, runtime)
    const step = system.resolveNextStep(battle)

    expect(step.actorId).toBe('reactor')
    expect(enemyP.entity.currentHp).toBeLessThan(enemyHpBefore)
    expect(playerP.entity.currentHp).toBe(100_000)
  })

  it('bypass skips the whole natural-turn lifecycle: counters, buffs, cooldowns, regen, rounds', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    runtime.applyBuff('test_dot_host', playerP)
    const buffTurns = buffsOf(runtime, playerP, 'test_dot_host')[0]!.remaining
    playerP.entity.currentHp = 90_000 // regen would add if it ticked
    playerP.entity.stats = { ...playerP.entity.stats, hpRegenPerTurn: 100 }
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, hpRegenPerTurn: 100 })

    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', triggerContext: { origin: 'enemy_hit', outcome: 'taken' }, payloadSkillId: 'phan_kich', targetIds: ['enemy'] },
    ]

    const system = new TurnBattleSystem(combat, 10_000, KIT_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle)

    expect(battle.totalTurnsElapsed ?? 0).toBe(0) // no turn counter
    expect(battle.roundsElapsed ?? 0).toBe(0) // no round tracking
    expect(buffsOf(runtime, playerP, 'test_dot_host')[0]!.remaining).toBe(buffTurns) // no buff tick
    expect(playerP.special!.remainingCooldownTurns).toBe(3) // no cooldown tick
    expect(playerP.entity.currentHp).toBe(90_000) // no regen
    expect(playerP.entity.turnsSinceLastHitLanded).toBe(Infinity) // no turnsSinceLastHitLanded advance
    expect(playerP.consecutiveHardCcTurns).toBe(0)
  })

  it('a queued entry with no payloadSkillId resolves the actor basic (legacy follow_up semantic)', () => {
    const { battle, enemyP, combat, runtime } = makeBattle()
    battle.queuedFollowUps = [{ actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'follow_up' }]

    const enemyHpBefore = enemyP.entity.currentHp
    new TurnBattleSystem(combat, 10_000, KIT_REGISTRY, undefined, runtime).resolveNextStep(battle)

    expect(enemyP.entity.currentHp).toBeLessThan(enemyHpBefore)
  })

  it('dead captured targets filter out — the payload resolves nothing', () => {
    const { battle, enemyP, combat, runtime } = makeBattle()
    enemyP.entity.alive = false
    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', payloadSkillId: 'phan_kich', targetIds: ['enemy'] },
    ]

    new TurnBattleSystem(combat, 10_000, KIT_REGISTRY, undefined, runtime).resolveNextStep(battle)

    expect(battle.queuedFollowUps).toBeUndefined()
  })

  it('dead queued actor is skipped without burning chain depth', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    playerP.entity.alive = false
    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', payloadSkillId: 'phan_kich', targetIds: ['enemy'] },
    ]

    const step = new TurnBattleSystem(combat, 10_000, KIT_REGISTRY, undefined, runtime).resolveNextStep(battle)

    expect(step.actorId).toBe('enemy') // fell through to gauge order
    expect(battle.followUpChainDepth ?? 0).toBe(0)
  })

  it('unknown payload id resolves to the basic fallback only when authored payloads are absent', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    playerP.reactivePayloads = {}
    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', payloadSkillId: 'nonexistent', targetIds: ['enemy'] },
    ]

    const enemyHpBefore = enemyP.entity.currentHp
    new TurnBattleSystem(combat, 10_000, KIT_REGISTRY, undefined, runtime).resolveNextStep(battle)

    expect(enemyP.entity.currentHp).toBeLessThan(enemyHpBefore)
  })

  it('onEvade window: a dodged natural attack queues a counter via the phan_mon marker', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, evasionRate: 1_000_000, counterChance: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, evasionRate: 1_000_000, counterChance: 1 }
    runtime.applyBuff('phan_mon', playerP)
    playerP.thamTargetId = 'enemy' // the defender OBSERVES the attacker
    playerP.entity.currentThe = 15 // exactly the proc cost

    // Speed lives on baseStats — refreshParticipantStats recomputes
    // entity.stats from baseStats + modifiers every pacing step.
    enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, speed: 30 })
    enemyP.entity.stats = { ...enemyP.entity.stats, speed: 30 }
    enemyP.speed = 30
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, speed: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, speed: 1 }
    playerP.speed = 1
    // MIN_HIT_CHANCE floors every attack at 5% — a 0.999 roll dodges;
    // the proc roll then needs < 0.6 (counterChance clamps at 0.60).
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValue(0)

    new TurnBattleSystem(combat, 10_000, KIT_REGISTRY, undefined, runtime).resolveNextStep(battle)
    expect(battle.queuedFollowUps).toHaveLength(1)
    const entry = battle.queuedFollowUps![0]!
    expect(entry).toMatchObject({
      actorId: 'reactor',
      executionKind: 'reactive_bypass',
      actionSource: 'counter',
      payloadSkillId: 'phan_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'enemy_hit', outcome: 'evaded' },
    })
    // Success-only cost: 15 - 15 = 0, +1 Ung Tre debt.
    expect(playerP.entity.currentThe).toBe(0)
    expect(playerP.reactionDebt).toBe(1)
  })

  it('a TAKEN hit queues the counter through the onImpactLanded proc (outcome taken, not evaded)', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, counterChance: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, counterChance: 1 }
    runtime.applyBuff('phan_mon', playerP)
    playerP.thamTargetId = 'enemy' // the defender OBSERVES the attacker
    playerP.entity.currentThe = 100

    // Speed lives on baseStats — refreshParticipantStats recomputes
    // entity.stats from baseStats + modifiers every pacing step.
    enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, speed: 30 })
    enemyP.entity.stats = { ...enemyP.entity.stats, speed: 30 }
    enemyP.speed = 30
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, speed: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, speed: 1 }
    playerP.speed = 1
    vi.spyOn(Math, 'random').mockReturnValue(0)

    new TurnBattleSystem(combat, 10_000, KIT_REGISTRY, undefined, runtime).resolveNextStep(battle)

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]).toMatchObject({
      actorId: 'reactor',
      actionSource: 'counter',
      payloadSkillId: 'phan_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'enemy_hit', outcome: 'taken' },
    })
    // Success-only cost: 100 - 15 = 85; no income without ung_the.
    expect(playerP.entity.currentThe).toBe(85)
  })

  it('4-deep chain trips MAX_FOLLOW_UP_CHAIN_DEPTH — queue drops, the next action is a NATURAL turn', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', payloadSkillId: 'phan_kich', targetIds: ['enemy'] },
    ]
    battle.followUpChainDepth = 4

    runtime.applyBuff('test_dot_host', playerP)
    const buffTurnsBefore = buffsOf(runtime, playerP, 'test_dot_host')[0]!.remaining

    const step = new TurnBattleSystem(combat, 10_000, KIT_REGISTRY, undefined, runtime).resolveNextStep(battle)

    // Guard tripped -> gauge order; the faster player wins the race and
    // the action that resolves IS a natural turn (lifecycle ticks).
    expect(step.actorId).toBe('reactor')
    expect(battle.queuedFollowUps).toBeUndefined()
    expect(battle.followUpChainDepth).toBe(0)
    expect(battle.totalTurnsElapsed).toBe(1)
    expect(buffsOf(runtime, playerP, 'test_dot_host')[0]!.remaining).toBe(buffTurnsBefore! - 1)
  })
})
