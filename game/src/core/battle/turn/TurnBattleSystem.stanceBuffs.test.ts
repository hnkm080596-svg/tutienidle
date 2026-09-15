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

// The Tu Reimagined (spec 6.1, plan Task 19) — stance/burst semantics:
// bach_ung's freeProcs zero the attempt cost while success still credits
// +20, and its payloadAilments rider merges into bypass payloads at
// resolve time; tu_the's procCostFlatDelta -5 floors at 0; both expire
// on the holder's own turns (fixed_holder_turns) and restore the base
// cost on expiry.

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
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

/** Player defender (phan_mon + payloads) vs a faster enemy attacker. */
function makeDuel(defenderChance = 1, defenderThe = 0): {
  battle: TurnBattle
  playerP: TurnBattleParticipant
  enemyP: TurnBattleParticipant
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
  new BuffSystem(playerP.buffs).apply(BUFF_REGISTRY.get('phan_mon'), playerP.entity, playerP.entity, BUFF_REGISTRY)

  const enemyP = makeParticipant('enemy', enemy, 30, 100)
  enemyP.basic = {
    id: 'enemy_hit',
    cooldownTurns: 0,
    damage: { kind: 'physical', multiplier: 1 },
    targeting: { shape: 'single' },
  }
  enemyP.entity.baseStats = asBaseStats({ ...enemyP.entity.baseStats, speed: 30 })
  enemyP.entity.stats = { ...enemyP.entity.stats, speed: 30 }

  return { battle: { players: [playerP], enemies: [enemyP], state: 'fighting' }, playerP, enemyP }
}

function system(): TurnBattleSystem {
  return new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, BUFF_REGISTRY)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('bach_ung burst window (spec 6.1)', () => {
  it('freeProcs zero the attempt cost — success still credits +20', () => {
    const { battle, playerP } = makeDuel(1, 0)
    new BuffSystem(playerP.buffs).apply(BUFF_REGISTRY.get('bach_ung'), playerP.entity, playerP.entity, BUFF_REGISTRY)
    vi.spyOn(Math, 'random').mockReturnValue(0) // hit lands, proc succeeds

    system().resolveNextStep(battle)

    expect(battle.queuedFollowUps).toHaveLength(1)
    // 0 - 0 (free) + 20 (success) — the free proc nets the full gain.
    expect(playerP.entity.currentThe).toBe(20)
  })

  it('payloadAilments rider merges into the bypass payload — counter applies choang', () => {
    const { battle, playerP, enemyP } = makeDuel(1, 50)
    new BuffSystem(playerP.buffs).apply(BUFF_REGISTRY.get('bach_ung'), playerP.entity, playerP.entity, BUFF_REGISTRY)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    // Step 1: enemy hit lands -> counter queued (free proc).
    system().resolveNextStep(battle)
    // Step 2: the bypass counter resolves through declare -> impact and
    // the merged choang rider applies to the enemy.
    system().resolveNextStep(battle)

    const choang = enemyP.buffs.getAllById('choang')
    expect(choang.length).toBeGreaterThan(0)
    // The participant's payload map was NOT mutated by the merge.
    expect(playerP.reactivePayloads!['phan_kich']!.appliesAilments).toBeUndefined()
  })

  it('payload rider is window-scoped — without bach_ung the counter applies nothing', () => {
    const { battle, playerP, enemyP } = makeDuel(1, 50)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system().resolveNextStep(battle)
    system().resolveNextStep(battle)

    expect(enemyP.buffs.getAllById('choang')).toHaveLength(0)
  })
})

describe('tu_the stance window (spec 6.1)', () => {
  it('procCostFlatDelta -5 — an attempt costs 10, not 15', () => {
    const { battle, playerP } = makeDuel(1, 10) // below base cost, covers the delta
    new BuffSystem(playerP.buffs).apply(BUFF_REGISTRY.get('tu_the'), playerP.entity, playerP.entity, BUFF_REGISTRY)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system().resolveNextStep(battle)

    expect(battle.queuedFollowUps).toHaveLength(1)
    // 10 - 10 + 20 = 20.
    expect(playerP.entity.currentThe).toBe(20)
  })

  it('without the stance the same pool cannot pay — no roll at all', () => {
    const { battle, playerP } = makeDuel(1, 10)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    system().resolveNextStep(battle)

    expect(battle.queuedFollowUps).toBeUndefined()
    expect(playerP.entity.currentThe).toBe(10)
  })

  it('expiry restores the base cost — stance worn off, 10 The no longer funds a check', () => {
    const { battle, playerP } = makeDuel(1, 10)
    const buff = new BuffSystem(playerP.buffs)
    buff.apply(BUFF_REGISTRY.get('tu_the'), playerP.entity, playerP.entity, BUFF_REGISTRY)

    // Expire the stance: fixed_holder_turns ticks only on holder turns.
    const instance = playerP.buffs.getAllById('tu_the')[0]!
    instance.remainingTurns = 0
    instance.remainingTime = 0
    buff.updateTime(0)

    vi.spyOn(Math, 'random').mockReturnValue(0)
    system().resolveNextStep(battle)

    expect(playerP.buffs.getAllById('tu_the')).toHaveLength(0)
    expect(battle.queuedFollowUps).toBeUndefined()
    expect(playerP.entity.currentThe).toBe(10)
  })
})
