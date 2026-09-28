import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from '@/core/battle/turn/TurnBattleSystem'
import type { CombatEntity } from '@/core/combat/CombatEntity'
import { CombatSystem } from '@/core/combat/CombatSystem'
import { EventBus } from '@/core/events/EventBus'
import { asBaseStats, createBaseStats } from '@/core/stats/StatBlock'
import { BUFF_REGISTRY } from '@/data/buff/BuffRegistry'
import { GAUGE_MAX } from '@/core/battle/turn/ActionGauge'
import { makeTurnRuntime, type TurnRuntimeFixture } from '@/core/battle/turn/testing/TurnRuntimeFixtures'

// QA evidence probe (novel-attack seams, Ung The beta):
//   P1 -- a wave-spawned enemy joining mid-battle is observed by a live
//         Quan The marker even though no Tham An mark can exist on it
//         (design Part V: "every enemy observed incl. later spawns").
//   P2 -- the Quan The marker's FIXED_TURNS(4) lifetime is real: once it
//         expires, previously-observed enemies yield zero income.

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

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, consecutiveHardCcTurns: 0 }
}

const PLAIN_HIT = {
  id: 'plain_hit',
  cooldownTurns: 0,
  damage: { kind: 'physical' as const, multiplier: 1 },
  targeting: { shape: 'single' as const },
}

function makeBattle(): {
  battle: TurnBattle
  playerP: TurnBattleParticipant
  enemyP: TurnBattleParticipant
  participants: TurnBattleParticipant[]
  combat: CombatSystem
  runtime: TurnRuntimeFixture
} {
  const player = createCombatant({ id: 'ung', type: 'player', currentHp: 100_000, maxHp: 100_000 }, 10)
  const enemy = createCombatant({ id: 'enemy', currentHp: 100_000, maxHp: 100_000 }, 9)
  const playerP = makeParticipant('ung', player, 10, 0)
  playerP.basic = { ...PLAIN_HIT } // plain basic -- never plants a Tham mark
  const enemyP = makeParticipant('enemy', enemy, 9, 100)
  enemyP.basic = { ...PLAIN_HIT }
  const participants = [playerP, enemyP]
  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: BUFF_REGISTRY,
    participants: () => participants,
    combatSystem: combat,
  })
  return { battle: { players: [playerP], enemies: [enemyP], state: 'fighting' }, playerP, enemyP, participants, combat, runtime }
}

function makeAct(system: TurnBattleSystem, battle: TurnBattle, actor: TurnBattleParticipant, others: TurnBattleParticipant[]): void {
  for (const p of others) p.actionGauge = 0
  actor.actionGauge = GAUGE_MAX
  system.resolveNextStep(battle)
}

describe('novel-attack probe: wave-spawn observation + quan_the lifetime', () => {
  it('P1: wave-spawned enemy is observed under live quan_the -- income lands with NO Tham mark', () => {
    const { battle, playerP, participants, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)
    runtime.applyBuff('quan_the', playerP)
    playerP.thamTargetId = undefined

    const spawned = createCombatant({ id: 'spawned', currentHp: 100_000, maxHp: 100_000 }, 30)
    const spawnP = makeParticipant('spawned', spawned, 30, 200)
    spawnP.basic = { ...PLAIN_HIT }
    battle.wave = {
      totalEnemyCount: 2,
      waves: [1, 1],
      spawnedCount: 1,
      waveIndex: 1,
      pendingEnemySpawns: [{ participant: spawnP, ticksRemaining: 1, totalTicks: 1 }],
    }
    participants.push(spawnP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)

    // Telegraph decrement runs on every pacing tick -- the spawn materializes.
    system.tickPacing(battle, false)
    expect(battle.enemies).toContain(spawnP)
    expect(battle.wave!.pendingEnemySpawns).toHaveLength(0)

    // The spawned enemy completes a natural action while unmarked.
    makeAct(system, battle, spawnP, participants)

    // Observed via quan_the alone: +4 gainOnObservedAction, no mark planted.
    expect(playerP.entity.currentThe).toBe(4)
    expect(playerP.thamTargetId).toBeUndefined()
  })

  it('P2: quan_the FIXED_TURNS(4) expiry ends quan_the observation income', () => {
    const { battle, playerP, enemyP, participants, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)
    runtime.applyBuff('quan_the', playerP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    const quanRemaining = () =>
      runtime.buffs
        .getForTarget(playerP.entity.id)
        .find((i) => i.definitionId === 'quan_the')?.remaining

    // Turn 1: player's basic plants the Tham mark anyway (every ung_the
    // basic is the observation-mark channel). Undo it so ONLY the
    // quan_the path can observe the enemy for the rest of the probe.
    makeAct(system, battle, playerP, participants)
    playerP.thamTargetId = undefined

    // Marker live (rem=3 after one holder turn): observed income lands.
    expect(quanRemaining()).toBe(3)
    const liveBefore = playerP.entity.currentThe ?? 0
    makeAct(system, battle, enemyP, participants)
    expect(playerP.entity.currentThe ?? 0).toBe(liveBefore + 4)

    // Burn remaining holder turns (3 left: rem 3->2->1->expired).
    for (let i = 0; i < 3; i++) {
      makeAct(system, battle, playerP, participants)
      playerP.thamTargetId = undefined // each basic re-plants; undo
    }
    expect(quanRemaining()).toBeUndefined()

    // Marker dead + no Tham mark -- the enemy yields nothing.
    const deadBefore = playerP.entity.currentThe ?? 0
    makeAct(system, battle, enemyP, participants)
    expect(playerP.entity.currentThe ?? 0).toBe(deadBefore)
  })
})
