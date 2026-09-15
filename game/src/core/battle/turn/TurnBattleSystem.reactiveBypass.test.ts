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
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { PHAN_KICH } from '../../../data/skill/TheTuSkills'
import type { TurnSkillDefinition } from './TurnSkillAction'

// The Tu Reimagined (spec 7.1, plan Task 16 / v2.4 P0.1) — the reactive
// bypass contract: a queued entry resolves as a REAL action through
// declare -> impact but skips the ENTIRE natural-turn lifecycle (turn
// counter, round tracking, buff/DoT ticks, cooldowns, regen, resource
// deltas, charge advance, CC check, gauge).

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
    currentSwordIntent: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
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

const PAYLOAD: TurnSkillDefinition = {
  id: 'phan_kich',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

const TICKING_BUFF = {
  id: 'test_dot_host',
  name: 'host',
  polarity: 'buff' as const,
  duration: 5,
  durationPolicy: 'fixed_holder_turns' as const,
  stackMode: 'replace' as const,
  effects: [{ type: 'statModifier' as const, stat: 'might' as const, flat: 0 }],
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

function makeBattle(): { battle: TurnBattle; playerP: TurnBattleParticipant; enemyP: TurnBattleParticipant } {
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

  return { battle: { players: [playerP], enemies: [enemyP], state: 'fighting' }, playerP, enemyP }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('reactive bypass contract (spec 7.1)', () => {
  it('queued payload entry resolves the payload skill against the captured target through declare -> impact', () => {
    const { battle, playerP, enemyP } = makeBattle()
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
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY)
    const step = system.resolveNextStep(battle)

    expect(step.actorId).toBe('reactor')
    expect(enemyP.entity.currentHp).toBeLessThan(enemyHpBefore)
    expect(playerP.entity.currentHp).toBe(100_000)
  })

  it('bypass skips the whole natural-turn lifecycle: counters, buffs, cooldowns, regen, rounds', () => {
    const { battle, playerP } = makeBattle()
    new BuffSystem(playerP.buffs).apply(TICKING_BUFF, playerP.entity, playerP.entity, BUFF_REGISTRY)
    const buffTurns = playerP.buffs.getAllById('test_dot_host')[0]!.remainingTurns
    playerP.entity.currentHp = 90_000 // regen would add if it ticked
    playerP.entity.stats = { ...playerP.entity.stats, hpRegenPerTurn: 100 }
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, hpRegenPerTurn: 100 })

    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', triggerContext: { origin: 'enemy_hit', outcome: 'taken' }, payloadSkillId: 'phan_kich', targetIds: ['enemy'] },
    ]

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY)
    system.resolveNextStep(battle)

    expect(battle.totalTurnsElapsed ?? 0).toBe(0) // no turn counter
    expect(battle.roundsElapsed ?? 0).toBe(0) // no round tracking
    expect(playerP.buffs.getAllById('test_dot_host')[0]!.remainingTurns).toBe(buffTurns) // no buff tick
    expect(playerP.special!.remainingCooldownTurns).toBe(3) // no cooldown tick
    expect(playerP.entity.currentHp).toBe(90_000) // no regen
    expect(playerP.entity.turnsSinceLastHitLanded).toBe(Infinity) // no turnsSinceLastHitLanded advance
    expect(playerP.consecutiveHardCcTurns).toBe(0)
  })

  it('a queued entry with no payloadSkillId resolves the actor basic (legacy follow_up semantic)', () => {
    const { battle, enemyP } = makeBattle()
    battle.queuedFollowUps = [{ actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'follow_up' }]

    const enemyHpBefore = enemyP.entity.currentHp
    new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY).resolveNextStep(battle)

    expect(enemyP.entity.currentHp).toBeLessThan(enemyHpBefore)
  })

  it('dead captured targets filter out — the payload resolves nothing', () => {
    const { battle, enemyP } = makeBattle()
    enemyP.entity.alive = false
    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', payloadSkillId: 'phan_kich', targetIds: ['enemy'] },
    ]

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY).resolveNextStep(battle)

    expect(battle.queuedFollowUps).toBeUndefined()
  })

  it('dead queued actor is skipped without burning chain depth', () => {
    const { battle, playerP } = makeBattle()
    playerP.entity.alive = false
    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', payloadSkillId: 'phan_kich', targetIds: ['enemy'] },
    ]

    const step = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY).resolveNextStep(battle)

    expect(step.actorId).toBe('enemy') // fell through to gauge order
    expect(battle.followUpChainDepth ?? 0).toBe(0)
  })

  it('unknown payload id resolves to the basic fallback only when authored payloads are absent', () => {
    const { battle, playerP, enemyP } = makeBattle()
    playerP.reactivePayloads = {}
    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', payloadSkillId: 'nonexistent', targetIds: ['enemy'] },
    ]

    const enemyHpBefore = enemyP.entity.currentHp
    new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY).resolveNextStep(battle)

    expect(enemyP.entity.currentHp).toBeLessThan(enemyHpBefore)
  })

  it('onEvade window: a dodged natural attack queues a counter via the phan_mon marker', () => {
    const { battle, playerP, enemyP } = makeBattle()
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, evasionRate: 1_000_000, counterChance: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, evasionRate: 1_000_000, counterChance: 1 }
    new BuffSystem(playerP.buffs).apply(BUFF_REGISTRY.get('phan_mon'), playerP.entity, playerP.entity, BUFF_REGISTRY)
    playerP.entity.currentThe = 15 // exactly the proc cost; no ung_the -> no evade income

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

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY).resolveNextStep(battle)
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
    // Economy: -15 attempt cost, +20 success credit -> net +5.
    expect(playerP.entity.currentThe).toBe(20)
  })

  it('a TAKEN hit queues the counter through the onImpactLanded proc (outcome taken, not evaded)', () => {
    const { battle, playerP, enemyP } = makeBattle()
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, counterChance: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, counterChance: 1 }
    new BuffSystem(playerP.buffs).apply(BUFF_REGISTRY.get('phan_mon'), playerP.entity, playerP.entity, BUFF_REGISTRY)
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

    new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY).resolveNextStep(battle)

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]).toMatchObject({
      actorId: 'reactor',
      actionSource: 'counter',
      payloadSkillId: 'phan_kich',
      targetIds: ['enemy'],
      triggerContext: { origin: 'enemy_hit', outcome: 'taken' },
    })
    // Economy: -15 attempt, +20 success — capped at the 100 default.
    expect(playerP.entity.currentThe).toBe(100)
  })

  it('4-deep chain trips MAX_FOLLOW_UP_CHAIN_DEPTH — queue drops, the next action is a NATURAL turn', () => {
    const { battle, playerP } = makeBattle()
    battle.queuedFollowUps = [
      { actorId: 'reactor', executionKind: 'reactive_bypass', actionSource: 'counter', payloadSkillId: 'phan_kich', targetIds: ['enemy'] },
    ]
    battle.followUpChainDepth = 4

    new BuffSystem(playerP.buffs).apply(TICKING_BUFF, playerP.entity, playerP.entity, BUFF_REGISTRY)
    const buffTurnsBefore = playerP.buffs.getAllById('test_dot_host')[0]!.remainingTurns

    const step = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY).resolveNextStep(battle)

    // Guard tripped -> gauge order; the faster player wins the race and
    // the action that resolves IS a natural turn (lifecycle ticks).
    expect(step.actorId).toBe('reactor')
    expect(battle.queuedFollowUps).toBeUndefined()
    expect(battle.followUpChainDepth).toBe(0)
    expect(battle.totalTurnsElapsed).toBe(1)
    expect(playerP.buffs.getAllById('test_dot_host')[0]!.remainingTurns).toBe(buffTurnsBefore - 1)
  })
})
