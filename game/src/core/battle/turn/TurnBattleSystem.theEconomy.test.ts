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
import { BUFF_REGISTRY } from '../../../data/buff/BuffRegistry'
import { THAM_THE } from '../../../data/skill/TheTuSkills'
import {
  THE_PROC_COST,
  THE_PROC_GAIN,
  THE_GAIN_ON_EVADE,
  THE_GAIN_ON_HIT_TAKEN,
  THE_GAIN_PER_ROUND,
  grantThe,
  isUngTheCombatant,
  onProcSuccess,
  resolveProcCost,
  tryPayProcCost,
  theCap,
} from '../../the-tu/TheEconomy'
import { MAX_THE } from '../../combat/CombatTypes'
import { makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// The Tu Reimagined (spec 2026-09-15 section 4.1, plan Task 15) — the
// hidden_body proc-fuel economy: pay-per-attempt cost, +THE_PROC_GAIN on
// success only, free income table gated on the ung_the marker, single
// clamp through entity.maxThe ?? MAX_THE. buff2 M4: economy reads run
// through the battle runtime's capability grants.

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

const ENEMY_HIT = {
  id: 'enemy_hit',
  cooldownTurns: 0,
  damage: { kind: 'physical' as const, multiplier: 1 },
  targeting: { shape: 'single' as const },
}

function makeWorld(participants: TurnBattleParticipant[]) {
  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: BUFF_REGISTRY,
    participants: () => participants,
    combatSystem: combat,
  })

  return { combat, runtime }
}

function makeBattle(): {
  battle: TurnBattle
  playerP: TurnBattleParticipant
  enemyP: TurnBattleParticipant
  combat: CombatSystem
  runtime: TurnRuntimeFixture
} {
  // High maxHp on both sides — a x1 basic must never one-shot (the enemy
  // has to survive to take its turn).
  const player = createCombatant({ id: 'ung', type: 'player', currentHp: 100_000, maxHp: 100_000 }, 10)
  const enemy = createCombatant({ id: 'enemy', currentHp: 100_000, maxHp: 100_000 }, 9)

  const playerP = makeParticipant('ung', player, 10, 0)
  playerP.basic = { ...THAM_THE }
  const enemyP = makeParticipant('enemy', enemy, 9, 100)
  enemyP.basic = { ...ENEMY_HIT }

  const { combat, runtime } = makeWorld([playerP, enemyP])

  return { battle: { players: [playerP], enemies: [enemyP], state: 'fighting' }, playerP, enemyP, combat, runtime }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TheEconomy — pool cap + pay-per-attempt', () => {
  it('theCap falls back to MAX_THE; an entity-baked maxThe wins', () => {
    const entity = createCombatant()

    expect(theCap(entity)).toBe(MAX_THE)

    entity.maxThe = MAX_THE + 20
    expect(theCap(entity)).toBe(MAX_THE + 20)
  })

  it('grantThe clamps at the cap: 115 + 20 -> 120 with maxThe, -> 100 without', () => {
    const entity = createCombatant()

    entity.currentThe = 95
    grantThe(entity, 20)
    expect(entity.currentThe).toBe(MAX_THE)

    entity.maxThe = 120
    grantThe(entity, 20)
    expect(entity.currentThe).toBe(120)
  })

  it('tryPayProcCost refuses below cost — no drain, no roll', () => {
    const entity = createCombatant({ currentThe: THE_PROC_COST - 1 })

    expect(tryPayProcCost(entity, resolveProcCost([]))).toBe(false)
    expect(entity.currentThe).toBe(THE_PROC_COST - 1)
  })

  it('tryPayProcCost pays on attempt; success grants THE_PROC_GAIN back (net +5)', () => {
    const entity = createCombatant({ currentThe: 20 })

    expect(tryPayProcCost(entity, resolveProcCost([]))).toBe(true)
    expect(entity.currentThe).toBe(5)

    onProcSuccess(entity)
    expect(entity.currentThe).toBe(25)
  })

  it('failed proc keeps the cost down (net -15)', () => {
    const entity = createCombatant({ currentThe: 20 })

    tryPayProcCost(entity, resolveProcCost([]))
    expect(entity.currentThe).toBe(5)
  })

  it('resolveProcCost — tu_the -5; combined deltas floor at 0; bach_ung freeProcs wins', () => {
    const holder = makeParticipant('p', createCombatant({ id: 'p', type: 'player' }), 10, 0)
    const { runtime } = makeWorld([holder])

    expect(resolveProcCost(runtime.buffs.getCapabilities(holder.entity.id))).toBe(THE_PROC_COST)

    runtime.applyBuff('tu_the', holder)
    expect(resolveProcCost(runtime.buffs.getCapabilities(holder.entity.id))).toBe(THE_PROC_COST - 5)

    runtime.applyBuff('bach_ung', holder)
    expect(resolveProcCost(runtime.buffs.getCapabilities(holder.entity.id))).toBe(0)
  })

  it('free procs still collect THE_PROC_GAIN on success', () => {
    const holder = makeParticipant('p', createCombatant({ id: 'p', type: 'player' }), 10, 0)
    const { runtime } = makeWorld([holder])
    runtime.applyBuff('bach_ung', holder)

    expect(tryPayProcCost(holder.entity, resolveProcCost(runtime.buffs.getCapabilities(holder.entity.id)))).toBe(true)
    expect(holder.entity.currentThe ?? 0).toBe(0)

    onProcSuccess(holder.entity)
    expect(holder.entity.currentThe).toBe(THE_PROC_GAIN)
  })
})

describe('hidden_body free income (marker-gated, ordering before reactive windows)', () => {
  it('taken hit income: +6 lands on the defender BEFORE the onImpactLanded window runs', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // ung_the player's basic (+4)
    system.resolveNextStep(battle) // enemy turn: round boundary (+5) then a landed hit (+6)

    expect(playerP.entity.currentThe).toBe(4 + THE_GAIN_PER_ROUND + THE_GAIN_ON_HIT_TAKEN)
  })

  it('evade income: +8 on a dodged hit', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)
    // Evasion must live on baseStats/stats at creation — the engine's
    // per-step effective-stat refresh would overwrite a live-stat poke.
    playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, evasionRate: 1_000_000 })
    playerP.entity.stats = { ...playerP.entity.stats, evasionRate: 1_000_000 }

    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // player's basic lands on the enemy (+4)
    system.resolveNextStep(battle) // enemy turn: round boundary (+5), its attack is dodged (+8)

    expect(playerP.entity.currentThe).toBe(4 + THE_GAIN_PER_ROUND + THE_GAIN_ON_EVADE)
  })

  it('own basic lands -> +4 via the ung_the marker field (single channel)', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // player's tham_the lands on the enemy

    expect(playerP.entity.currentThe).toBe(4)
  })

  it('non-marker participants gain nothing from the free-income table', () => {
    const { battle, playerP, combat, runtime } = makeBattle()
    // No ung_the marker.

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle)
    system.resolveNextStep(battle)

    expect(playerP.entity.currentThe ?? 0).toBe(0)
  })

  it('round boundary grants THE_GAIN_PER_ROUND to every ung_the participant', () => {
    const { battle, playerP, enemyP, combat, runtime } = makeBattle()
    runtime.applyBuff('ung_the', playerP)

    const system = new TurnBattleSystem(combat, 10, BUFF_REGISTRY, undefined, runtime)
    system.resolveNextStep(battle) // player acts (+4 basic)
    system.resolveNextStep(battle) // enemy acts -> round boundary (+5) + taken (+6)

    expect(playerP.entity.currentThe).toBe(4 + THE_GAIN_PER_ROUND + THE_GAIN_ON_HIT_TAKEN)
    expect(enemyP.entity.currentThe ?? 0).toBe(0)
    expect(isUngTheCombatant(runtime.buffs.getCapabilities(playerP.entity.id))).toBe(true)
    expect(isUngTheCombatant(runtime.buffs.getCapabilities(enemyP.entity.id))).toBe(false)
  })
})
