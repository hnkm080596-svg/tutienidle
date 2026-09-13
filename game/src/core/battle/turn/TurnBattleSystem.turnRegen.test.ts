import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { BuffDefinition, BuffDefinitionCatalog } from '../../buff/BuffTypes'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import type { EntityVitalsChangedEvent } from '../../combat/EntityVitalsSystem'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import { BuffSystem } from '../../buff/BuffSystem'
import { BAT_KIEM_THUAT } from '../../../data/skill/BatKiemThuat'
import { MAX_THE, THE_GAIN_PER_FINISHER, THE_GAIN_PER_LINK } from '../../combat/CombatTypes'

// M8 (ARCH-003 + ARCH-010 + C05/C06) — combat resources & turn-phase
// contract. MP/Ward regen joins hpRegenPerTurn on the entity-turn cadence
// through the vitals authority; the legacy `*RegenPerSecond` field names
// are normalized HERE (the turn-resource boundary) — authored content is
// unchanged. A lethal status tick ends the actor's turn before regen and
// before any charged-hit resolution; charged completion accrues The
// exactly once.

const DOT_DEF: BuffDefinition = {
  id: 'qa_lethal_dot',
  name: 'QA lethal DoT',
  polarity: 'debuff',
  duration: 10,
  stackMode: 'refresh',
  effects: [{ type: 'dot', dpsRatio: 1, element: 'physical' }],
}

class Registry implements BuffDefinitionCatalog {
  private readonly defs = new Map<string, BuffDefinition>()
  constructor(defs: BuffDefinition[]) {
    for (const d of defs) this.defs.set(d.id, d)
  }
  get(id: string): BuffDefinition {
    const d = this.defs.get(id)
    if (!d) throw new Error(`missing buff: ${id}`)
    return d
  }
}

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })
  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(
  id: string,
  entity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return {
    id,
    entity,
    speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }
}

function makeBattle(players: TurnBattleParticipant[], enemies: TurnBattleParticipant[]): TurnBattle {
  return { players, enemies, state: 'fighting' }
}

/** DoT source whose raw damage is lethal against a low-HP target. */
function makeDotSource(): CombatEntity {
  return createCombatant('dot_source', {
    type: 'enemy',
    stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 50_000 }),
  })
}

/**
 * Punching-bag enemy: speed/maxHp live INSIDE the stats override —
 * refreshParticipantStats re-syncs participant.speed from entity.stats.speed
 * and reconciles entity.maxHp to stats.maxHp, so an entity-field-only
 * override would be folded back to the defaults on the first declare.
 */
function makeDummyEnemy(): TurnBattleParticipant {
  const stats = createBaseStats({
    evasionRate: 0,
    dexterity: 0,
    criticalRate: 0,
    attack: 0,
    speed: 1,
    maxHp: 1_000_000,
  })
  const enemy = createCombatant('enemy', {
    type: 'enemy',
    stats,
    baseStats: stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
  })
  return makeParticipant('enemy', enemy, 1, 1)
}

function countActorTurns(battle: TurnBattle, actorId: string): number {
  return (battle.log ?? []).filter((entry) => entry.actorId === actorId).length
}

function runPlayerTurns(system: TurnBattleSystem, battle: TurnBattle, turns: number): void {
  for (let i = 0; i < 5000 && countActorTurns(battle, 'player') < turns; i++) {
    system.resolveNextStep(battle)

    if (battle.state !== 'fighting') break
  }
}

describe('TurnBattleSystem — per-turn resource regeneration (ARCH-003)', () => {
  it('regen 10/turn restores MP and Ward by +10 per actor turn, capped at the live ceilings', () => {
    const stats = createBaseStats({
      evasionRate: 0,
      dexterity: 0,
      criticalRate: 0,
      speed: 100,
      maxHp: 1000,
      maxMp: 200,
      wardMax: 100,
      manaRegenPerSecond: 10,
      wardRegenPerSecond: 10,
      hpRegenPerTurn: 10,
    })
    const player = createCombatant('player', {
      stats,
      baseStats: stats,
      maxHp: 1000,
      currentHp: 950,
      currentMp: 50,
      currentWard: 0,
      // Never hit — the delayed-ward gate opens immediately (Infinity).
      timeSinceLastHitTaken: Infinity,
    })

    const battle = makeBattle([makeParticipant('player', player, 100, 0)], [makeDummyEnemy()])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000)

    runPlayerTurns(system, battle, 10)

    expect(countActorTurns(battle, 'player')).toBe(10)
    // +10/turn x 10 turns: MP 50 -> 150, Ward 0 -> 100 (cap), HP 950 -> 1000 (cap).
    expect(player.currentMp).toBe(150)
    expect(player.currentWard).toBe(100)
    expect(player.currentHp).toBe(1000)
  })

  it('Ward regen waits WARD_REGEN_DELAY_TURNS holder turns after a landed hit', () => {
    const stats = createBaseStats({
      evasionRate: 0,
      dexterity: 0,
      criticalRate: 0,
      speed: 100,
      wardMax: 1000,
      wardRegenPerSecond: 10,
    })
    const player = createCombatant('player', {
      stats,
      baseStats: stats,
      currentWard: 0,
      // Just hit — the delay counter restarts at 0 on the holder's cadence.
      timeSinceLastHitTaken: 0,
    })

    const battle = makeBattle([makeParticipant('player', player, 100, 0)], [makeDummyEnemy()])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000)

    runPlayerTurns(system, battle, 2)
    // Turn 1 -> 1, turn 2 -> 2; both below the 3-turn delay gate.
    expect(player.currentWard).toBe(0)

    runPlayerTurns(system, battle, 3)
    // Third unhit turn opens the gate: +10.
    expect(player.currentWard).toBe(10)

    runPlayerTurns(system, battle, 4)
    expect(player.currentWard).toBe(20)
  })

  it('emits the regen vitals event with the MP/Ward before/after views once per regen turn', () => {
    const eventBus = new EventBus()
    const regenEvents: EntityVitalsChangedEvent[] = []
    eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
      if (event.reason === 'regen') regenEvents.push(event)
    })

    const stats = createBaseStats({
      evasionRate: 0,
      dexterity: 0,
      criticalRate: 0,
      speed: 100,
      maxMp: 500,
      wardMax: 500,
      manaRegenPerSecond: 7,
      wardRegenPerSecond: 9,
    })
    const player = createCombatant('player', {
      stats,
      baseStats: stats,
      currentMp: 0,
      currentWard: 0,
      timeSinceLastHitTaken: Infinity,
    })

    const battle = makeBattle([makeParticipant('player', player, 100, 0)], [makeDummyEnemy()])
    const system = new TurnBattleSystem(new CombatSystem(eventBus), 10_000)

    runPlayerTurns(system, battle, 2)

    expect(regenEvents.length).toBe(2)
    expect(regenEvents[0]!.mpAfter - regenEvents[0]!.mpBefore).toBe(7)
    expect(regenEvents[0]!.wardAfter - regenEvents[0]!.wardBefore).toBe(9)
    expect(regenEvents[0]!.entityId).toBe('player')
  })
})

describe('TurnBattleSystem — post-status liveness boundary (ARCH-010)', () => {
  it('a lethal DoT tick prevents same-turn regen and leaves the actor dead', () => {
    const stats = createBaseStats({
      evasionRate: 0,
      dexterity: 0,
      criticalRate: 0,
      speed: 100,
      maxMp: 500,
      manaRegenPerSecond: 50,
      hpRegenPerTurn: 50,
    })
    const player = createCombatant('player', {
      stats,
      baseStats: stats,
      maxHp: 100,
      currentHp: 100,
      currentMp: 0,
    })

    const registry = new Registry([DOT_DEF])
    const playerBuffs = new BuffPool()
    new BuffSystem(playerBuffs).apply(DOT_DEF, makeDotSource(), player, registry)

    const playerParticipant = makeParticipant('player', player, 100, 0)
    playerParticipant.buffs = playerBuffs

    const enemy = makeDummyEnemy()
    const battle = makeBattle([playerParticipant], [enemy])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry)

    system.resolveNextStep(battle)

    // DoT killed the player at the status phase — the turn ended there:
    // no regen touched the pools and no hit landed on the enemy.
    expect(player.alive).toBe(false)
    expect(player.currentHp).toBe(0)
    expect(player.currentMp).toBe(0)
    expect(enemy.entity.currentHp).toBe(1_000_000)
    expect(battle.state).toBe('defeat')
  })

  it('a charged actor killed by its own status tick never resolves the captured hit', () => {
    const stats = createBaseStats({
      evasionRate: 0,
      dexterity: 0,
      criticalRate: 0,
      speed: 100,
    })
    const player = createCombatant('player', {
      stats,
      baseStats: stats,
      maxHp: 50,
      currentHp: 50,
    })

    const registry = new Registry([DOT_DEF])
    const playerBuffs = new BuffPool()
    new BuffSystem(playerBuffs).apply(DOT_DEF, makeDotSource(), player, registry)

    const playerParticipant = makeParticipant('player', player, 100, 0)
    playerParticipant.buffs = playerBuffs
    // Resolve turn: the counter reaches 0 THIS declare, so without the
    // liveness boundary the captured charged hit would fire post-death.
    playerParticipant.chargingTurnsRemaining = 1
    playerParticipant.pendingChargedSkillId = 'qa_charged'
    playerParticipant.special = {
      skill: {
        id: 'qa_charged',
        cooldownTurns: 0,
        chargeTurns: 3,
        damage: { kind: 'physical', multiplier: 5 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    const enemy = makeDummyEnemy()
    const battle = makeBattle([playerParticipant], [enemy])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000, registry)

    const step = system.resolveNextStep(battle)

    expect(player.alive).toBe(false)
    expect(step.targetIds).toEqual([])
    expect(enemy.entity.currentHp).toBe(1_000_000)
    // The dead charger holds no leftover pending id for a later turn.
    expect(playerParticipant.pendingChargedSkillId).toBeUndefined()
    expect(playerParticipant.chargingTurnsRemaining).toBeUndefined()
  })

  it('the vitals authority itself rejects ordinary healing on a dead entity', () => {
    const player = createCombatant('player', { currentHp: 0, alive: false })
    const vitals = new CombatSystem(new EventBus()).vitals

    expect(vitals.applyHealing(player, 100, 'healing', 'src')).toBe(0)
    expect(player.currentHp).toBe(0)
    expect(vitals.applyTurnRegen(player, { hp: 10, mp: 10, ward: 10 })).toEqual({ hp: 0, mp: 0, ward: 0 })
  })
})

describe('TurnBattleSystem — charged-hit The gain (C05)', () => {
  it('the real Bat Kiem Thuat charge accrues THE_GAIN_PER_LINK exactly once, at completion', () => {
    const stats = createBaseStats({
      evasionRate: 0,
      dexterity: 0,
      criticalRate: 0,
      speed: 100,
      attack: 10,
    })
    const player = createCombatant('player', { stats, baseStats: stats })
    const playerParticipant = makeParticipant('player', player, 100, 0)
    playerParticipant.special = { skill: BAT_KIEM_THUAT, remainingCooldownTurns: 0 }

    const enemy = makeDummyEnemy()
    const battle = makeBattle([playerParticipant], [enemy])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000)

    // Turn 1: charge INITIATION — resource/cooldown commit, no gain yet.
    system.resolveNextStep(battle)
    expect(player.currentThe ?? 0).toBe(0)
    expect(playerParticipant.chargingTurnsRemaining).toBe(BAT_KIEM_THUAT.chargeTurns)

    // Charge ticks then resolves on the player's 4th turn (3 charge turns).
    runPlayerTurns(system, battle, 4)

    expect(playerParticipant.chargingTurnsRemaining).toBeUndefined()
    // Exactly once — not once per charge tick, not zero from the early return.
    expect(player.currentThe).toBe(THE_GAIN_PER_LINK)
    expect(enemy.entity.currentHp).toBeLessThan(1_000_000)
  })

  it('a charged ultimate grants THE_GAIN_PER_FINISHER through the same completion path', () => {
    const stats = createBaseStats({
      evasionRate: 0,
      dexterity: 0,
      criticalRate: 0,
      speed: 100,
      attack: 10,
    })
    const player = createCombatant('player', { stats, baseStats: stats, currentThe: MAX_THE })
    const playerParticipant = makeParticipant('player', player, 100, 0)
    playerParticipant.ultimate = {
      skill: {
        id: 'qa_charged_ult',
        cooldownTurns: 0,
        chargeTurns: 2,
        resourceType: 'the',
        resourceCost: MAX_THE,
        damage: { kind: 'physical', multiplier: 1 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }

    const battle = makeBattle([playerParticipant], [makeDummyEnemy()])
    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10_000)

    // Init commits the full The pool (100 -> 0); resolution adds the
    // finisher gain on top of the emptied pool.
    runPlayerTurns(system, battle, 3)

    expect(player.currentThe).toBe(THE_GAIN_PER_FINISHER)
  })
})
