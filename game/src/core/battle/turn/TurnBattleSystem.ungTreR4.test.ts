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
import { THE_PROC_COST } from '../../the-tu/TheEconomy'
import { makeTestBuffRegistry, makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// Ung The beta - cleanA4 INT-R4 regression pins:
// (a) the -400 UNG_TRE_GAUGE_PENALTY persists NEGATIVE through a queued
//     bypass drain (a free action never lifts a debt-negative gauge);
// (b) a reflect kill inside the action-tail flush is itself a death
//     boundary - a dead Tham An mark clears observer focus at action end,
//     never on the next declare (the HUD must never read a stale mark).

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

const REGISTRY = makeTestBuffRegistry([...LIVE_BUFFS])

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

function makeBattle(enemyHp = 100_000): {
  battle: TurnBattle
  playerP: TurnBattleParticipant
  enemyP: TurnBattleParticipant
  combat: CombatSystem
  runtime: TurnRuntimeFixture
} {
  const player = createCombatant({ id: 'reactor', type: 'player', currentHp: 100_000, maxHp: 100_000 }, 1)
  const enemy = createCombatant({ id: 'enemy', currentHp: enemyHp, maxHp: 100_000 }, 30)

  const playerP = makeParticipant('reactor', player, 1, 0)
  playerP.basic = {
    id: 'reactor_basic',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }
  playerP.reactivePayloads = { phan_kich: { ...PHAN_KICH } }

  const enemyP = makeParticipant('enemy', enemy, 30, 100)
  enemyP.basic = {
    id: 'enemy_hit',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 0.01 },
    targeting: { shape: 'single' },
  }

  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: REGISTRY,
    participants: () => [playerP, enemyP],
    combatSystem: combat,
  })
  return { battle: { players: [playerP], enemies: [enemyP], state: 'fighting' }, playerP, enemyP, combat, runtime }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ung tre gauge debt persists through the queued bypass drain (INT-R4 F1)', () => {
  it('a committed reaction sinks the gauge negative and the queued phan_kich drain leaves it there', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, counterChance: 1 })
    playerP.entity.stats = { ...playerP.entity.stats, counterChance: 1 }
    runtime.applyBuff('ung_the', playerP)
    runtime.applyBuff('phan_mon', playerP)
    playerP.thamTargetId = 'enemy'
    playerP.entity.currentThe = THE_PROC_COST
    playerP.actionGauge = 100 // below the -400 debt penalty -> goes negative

    vi.spyOn(Math, 'random').mockReturnValue(0)

    const system = new TurnBattleSystem(combat, 10_000, REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // observed enemy hit lands -> Phan commits

    expect(playerP.reactionDebt).toBe(1)
    const gaugeAfterCommit = playerP.actionGauge
    // Gauge advanced during pacing; the debt penalty still sank it negative.
    expect(gaugeAfterCommit).toBeLessThan(0)
    expect(battle.queuedFollowUps).toHaveLength(1)

    system.resolveNextStep(battle) // drains the queued phan_kich (bypass, consumes 0)

    expect(battle.queuedFollowUps ?? []).toHaveLength(0)
    expect(playerP.actionGauge).toBe(gaugeAfterCommit)
  })
})

describe('reflect kill at the action-tail flush is a death boundary (INT-R4 F2)', () => {
  it('a Tham An mark killed by its own action-end reflect clears observer focus before post-action windows', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle(1)
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, counterChance: 0 })
    playerP.entity.stats = { ...playerP.entity.stats, counterChance: 0 }
    runtime.applyBuff('ung_the', playerP)
    runtime.applyBuff('phan_chan', playerP)
    playerP.thamTargetId = 'enemy'
    playerP.entity.currentThe = 0 // no procs to pay - pure reflect path

    vi.spyOn(Math, 'random').mockReturnValue(0)

    const system = new TurnBattleSystem(combat, 10_000, REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // enemy hit lands -> phan_chan reflect kills it at the tail

    expect(enemyP.entity.alive).toBe(false)
    expect(playerP.thamTargetId).toBeUndefined()
  })
})
