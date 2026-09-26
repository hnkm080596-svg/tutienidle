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
import { PHAN_KICH } from '../../../data/skill/TheTuSkills'
import { THE_PROC_COST } from '../../the-tu/TheEconomy'
import { makeTurnRuntime, type TurnRuntimeFixture } from './testing/TurnRuntimeFixtures'

// Ung The beta - Quan The marker semantics (design Part V): the
// hidden marker makes EVERY enemy satisfy isObserved for its holder
// (incl. later spawns) for 4 HOLDER turns, then observation reverts to
// the Tham mark alone. bat_tu_ba_the remains the hard-CC unblocker;
// tu_the/bach_ung are parked (never granted in beta).

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

function buffsOf(runtime: TurnRuntimeFixture, participant: TurnBattleParticipant, id: string) {
  return runtime.buffs
    .getForTarget(participant.entity.id)
    .filter((instance) => instance.definitionId === id)
}

/** Player defender (phan_mon + payloads) vs a faster enemy attacker. */
function makeDuel(defenderChance = 1, defenderThe = 0): {
  battle: TurnBattle
  playerP: TurnBattleParticipant
  enemyP: TurnBattleParticipant
  combat: CombatSystem
  runtime: TurnRuntimeFixture
} {
  const player = createCombatant({ id: 'reactor', type: 'player', currentHp: 100_000, maxHp: 100_000 })
  const enemy = createCombatant({ id: 'enemy', currentHp: 100_000, maxHp: 100_000 })

  const playerP = makeParticipant('reactor', player, 1, 0)
  playerP.basic = {
    id: 'reactor_basic',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }
  playerP.reactivePayloads = { phan_kich: { ...PHAN_KICH } }
  playerP.entity.baseStats = asBaseStats({ ...playerP.entity.baseStats, counterChance: defenderChance })
  playerP.entity.stats = { ...playerP.entity.stats, counterChance: defenderChance }
  playerP.entity.currentThe = defenderThe

  const enemyP = makeParticipant('enemy', enemy, 30, 100)
  enemyP.basic = {
    id: 'enemy_hit',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }
  enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, speed: 30 })
  enemyP.entity.stats = { ...enemyP.entity.stats, speed: 30 }

  const combat = new CombatSystem(new EventBus())
  const runtime = makeTurnRuntime({
    registry: BUFF_REGISTRY,
    participants: () => [playerP, enemyP],
    combatSystem: combat,
  })

  return { battle: { players: [playerP], enemies: [enemyP], state: 'fighting' }, playerP, enemyP, combat, runtime }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('quan_the marker (Ung The beta)', () => {
  it('every enemy satisfies isObserved for the holder — no Tham mark needed for Phan', () => {
    const { battle, playerP, combat, runtime } = makeDuel(1, 100)
    runtime.applyBuff('phan_mon', playerP)
    runtime.applyBuff('quan_the', playerP)
    // No thamTargetId at all - the marker alone observes the attacker.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(battle.queuedFollowUps![0]!.payloadSkillId).toBe('phan_kich')
    expect(playerP.entity.currentThe).toBe(100 - THE_PROC_COST)
  })

  it('expiry at 4 holder turns reverts observation to the Tham mark alone', () => {
    const { battle, playerP, combat, runtime } = makeDuel(1, 100)
    runtime.applyBuff('phan_mon', playerP)
    runtime.applyBuff('quan_the', playerP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    // Age the marker out - 4 holder-turn boundaries.
    for (let turn = 0; turn < 4; turn += 1) {
      runtime.tickHolderTurnsEnd(playerP.entity.id)
    }
    expect(buffsOf(runtime, playerP, 'quan_the')).toHaveLength(0)

    new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)

    // Unmarked enemy no longer observed -> no window, no payment.
    expect(battle.queuedFollowUps).toBeUndefined()
    expect(playerP.entity.currentThe).toBe(100)
  })

  it('hard CC still blocks with quan_the — and bat_tu_ba_the unblocks it', () => {
    const { battle, playerP, combat, runtime } = makeDuel(1, 100)
    runtime.applyBuff('phan_mon', playerP)
    runtime.applyBuff('quan_the', playerP)
    runtime.applyBuff('choang', playerP)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(playerP.entity.currentThe).toBe(100)

    // Bat Tu Ba The: the CC cannot block - window reopens on the next action.
    runtime.applyBuff('bat_tu_ba_the', playerP)
    new TurnBattleSystem(combat, 10_000, BUFF_REGISTRY, undefined, runtime).resolveNextStep(battle)

    expect(battle.queuedFollowUps).toHaveLength(1)
    expect(playerP.entity.currentThe).toBe(100 - THE_PROC_COST)
  })
})

describe('parked legacy kit (beta window)', () => {
  it('tu_the and bach_ung buff defs stay authored but are never granted by the beta kit', () => {
    // Parked content pins (design Part XVIII): the defs live for
    // post-beta unlocks; nothing in the beta kit references them.
    expect(BUFF_REGISTRY.get('tu_the')).toBeDefined()
    expect(BUFF_REGISTRY.get('bach_ung')).toBeDefined()
  })
})
