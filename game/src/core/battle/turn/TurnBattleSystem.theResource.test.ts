import { afterEach, describe, expect, it, vi } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { BuffPool } from '../../buff/BuffPool'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { MAX_THE, THE_GAIN_PER_LINK, THE_GAIN_PER_FINISHER } from '../../combat/CombatTypes'

// Phap Tu Reimagined Task 8 (spec 2026-09-14) — the The pool is
// FIELD-DRIVEN, not slot-driven: a cast grants `theGainOnLandedCast`
// ONCE when it lands on >=1 valid target (target/hit count never
// multiplies it — a 5-target AoE grants +5, not +25), and
// `theGainOnCrit` ONCE when any direct hit of the cast crits (same
// per-cast rule — INV-15). The clamp reads `entity.maxThe ?? MAX_THE`
// (Truong The nodes raise the cap for the 'no' route). Skills that
// author neither field generate nothing — slot position is no longer
// a gain rule (Bat Kiem Thuat keeps its gains via authored fields).

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
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
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new BuffPool(), consecutiveHardCcTurns: 0 }
}

const BASIC: TurnSkillDefinition = {
  id: 'qa_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

function specialBattle(playerThe = 0) {
  const player = createCombatant('player', { currentThe: playerThe })
  const enemyEntity = createCombatant('enemy')
  enemyEntity.type = 'enemy'

  const playerParticipant = makeParticipant('player', player, 100, 0)
  playerParticipant.basic = BASIC

  const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)
  enemyParticipant.basic = BASIC

  const battle: TurnBattle = {
    players: [playerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100)

  return { battle, playerParticipant, enemyParticipant, system }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('theGainOnLandedCast — per-cast gain contract (Task 8)', () => {
  it('grants theGainOnLandedCast once on a landed cast', () => {
    const { battle, playerParticipant, system } = specialBattle()

    playerParticipant.basic = {
      ...BASIC,
      id: 'qa_gain_basic',
      theGainOnLandedCast: 5,
    }

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(5)
  })

  it('grants the value ONCE for a multi-target cast (5 landed targets = +5, not +25)', () => {
    const player = createCombatant('player')
    const playerParticipant = makeParticipant('player', player, 100, 0)

    playerParticipant.basic = {
      id: 'qa_aoe_gain',
      cooldownTurns: 0,
      theGainOnLandedCast: 5,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'all_lanes' },
    }

    const enemies = Array.from({ length: 5 }, (_, index) => {
      const entity = createCombatant(`enemy_${index}`)
      entity.type = 'enemy'

      return makeParticipant(`enemy_${index}`, entity, 1, index + 1)
    })

    for (const enemy of enemies) {
      enemy.basic = BASIC
    }

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies,
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100)

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(5)
  })

  it('grants nothing when every hit is dodged (no landed target)', () => {
    const { battle, playerParticipant, enemyParticipant, system } = specialBattle()

    // Hit chance = accuracy / (accuracy + evasion) with a 5% floor —
    // stats alone can never guarantee a dodge; force the roll instead.
    enemyParticipant.entity.stats = {
      ...enemyParticipant.entity.stats,
      evasionRate: 10_000,
    }
    enemyParticipant.entity.baseStats = enemyParticipant.entity.stats
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    playerParticipant.basic = {
      ...BASIC,
      id: 'qa_gain_dodged',
      theGainOnLandedCast: 5,
    }

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(0)
  })

  it('a skill without the field generates nothing — slot position is not a rule', () => {
    const { battle, playerParticipant, system } = specialBattle()

    // Special slot occupied, but the skill authors no gain field.
    playerParticipant.special = { skill: { ...BASIC, id: 'qa_plain_special' }, remainingCooldownTurns: 0 }

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(0)
  })

  it('bat kiem special keeps THE_GAIN_PER_LINK via its authored field', () => {
    const { battle, playerParticipant, system } = specialBattle()

    playerParticipant.special = {
      skill: { ...BASIC, id: 'bat_kiem_thuat', theGainOnLandedCast: THE_GAIN_PER_LINK },
      remainingCooldownTurns: 0,
    }

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(THE_GAIN_PER_LINK)
  })

  it('bat kiem ultimate consumes the pool then gains THE_GAIN_PER_FINISHER (legacy ordering)', () => {
    const { battle, playerParticipant, system } = specialBattle()

    playerParticipant.ultimate = {
      skill: {
        id: 'tru_tien_kiem_tran',
        cooldownTurns: 0,
        resourceType: 'the',
        resourceCost: 100,
        theGainOnLandedCast: THE_GAIN_PER_FINISHER,
        damage: { kind: 'physical', multiplier: 1 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }
    playerParticipant.entity.currentThe = MAX_THE

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(THE_GAIN_PER_FINISHER)
  })
})

describe('theGainOnCrit — once per cast regardless of hit/target count (INV-15)', () => {
  it('adds theGainOnCrit when the cast crits', () => {
    const player = createCombatant('player')
    const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 1, criticalDamage: 1.5 })
    player.stats = stats
    player.baseStats = stats

    const playerParticipant = makeParticipant('player', player, 100, 0)
    playerParticipant.basic = {
      ...BASIC,
      id: 'qa_crit_basic',
      theGainOnLandedCast: 5,
      theGainOnCrit: 3,
    }

    const enemyEntity = createCombatant('enemy')
    enemyEntity.type = 'enemy'
    const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)
    enemyParticipant.basic = BASIC

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100)

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(5 + 3)
  })

  it('a multi-target cast where every hit crits still grants theGainOnCrit ONCE', () => {
    const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 1, criticalDamage: 1.5 })
    const player = createCombatant('player')
    player.stats = stats
    player.baseStats = stats

    const playerParticipant = makeParticipant('player', player, 100, 0)
    playerParticipant.basic = {
      id: 'qa_aoe_crit',
      cooldownTurns: 0,
      theGainOnLandedCast: 5,
      theGainOnCrit: 3,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'all_lanes' },
    }

    const enemies = Array.from({ length: 5 }, (_, index) => {
      const entity = createCombatant(`enemy_${index}`)
      entity.type = 'enemy'
      const participant = makeParticipant(`enemy_${index}`, entity, 1, index + 1)
      participant.basic = BASIC

      return participant
    })

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies,
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100)

    system.resolveNextStep(battle)

    // +5 landed-cast + +3 crit — NOT 5x3 for five critting hits.
    expect(playerParticipant.entity.currentThe).toBe(8)
  })
})

describe('maxThe cap (Task 8)', () => {
  it('clamps at entity.maxThe when the snapshot raises the cap', () => {
    const { battle, playerParticipant, system } = specialBattle()

    playerParticipant.entity.maxThe = 12
    playerParticipant.entity.currentThe = 10
    playerParticipant.basic = {
      ...BASIC,
      id: 'qa_gain_capped',
      theGainOnLandedCast: 15,
    }

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(12)
  })

  it('defaults to MAX_THE when entity.maxThe is unset', () => {
    const { battle, playerParticipant, system } = specialBattle()

    playerParticipant.entity.currentThe = MAX_THE - 2
    playerParticipant.basic = {
      ...BASIC,
      id: 'qa_gain_default_cap',
      theGainOnLandedCast: 15,
    }

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(MAX_THE)
  })
})
