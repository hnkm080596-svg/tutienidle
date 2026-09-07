import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { MAX_THE, THE_GAIN_PER_LINK, THE_GAIN_PER_FINISHER } from '../../combat/CombatTypes'

// Phase A3 (2026-09-07) — Thế Thuần Hệ gain, simplified from legacy's
// chain-link-position rule (no turn-based chain state exists — see the
// A3 spec's Global Constraints). Every landed hit from a participant's
// `special` slot grants THE_GAIN_PER_LINK (10); every landed hit from the
// `ultimate` slot grants THE_GAIN_PER_FINISHER (20); basic hits grant
// nothing; the pool caps at MAX_THE (100).

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

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
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeParticipant(id: string, entity: CombatEntity, speed: number, priority: number): TurnBattleParticipant {
  return { id, entity, speed, priority, actionGauge: 0, alive: entity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}

const BASIC: TurnSkillDefinition = {
  id: 'qa_basic',
  cooldownTurns: 0,
  damage: { kind: 'physical', multiplier: 1 },
  targeting: { shape: 'single' },
}

const SPECIAL: TurnSkillDefinition = {
  id: 'qa_special',
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
  playerParticipant.special = { skill: SPECIAL, remainingCooldownTurns: 0 }

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

describe('currentThe gain on special/ultimate hits (Phase A3)', () => {
  it('grants THE_GAIN_PER_LINK on a landed special hit', () => {
    const { battle, playerParticipant, system } = specialBattle()

    // Player priority 0 + speed 100 → acts first.
    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(THE_GAIN_PER_LINK)
  })

  it('does not grant Thế from a basic-attack hit', () => {
    const { battle, playerParticipant, system } = specialBattle()

    // Remove the special slot so selectAction falls back to basic.
    playerParticipant.special = undefined

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(0)
  })

  it('caps currentThe at MAX_THE (100)', () => {
    const { battle, playerParticipant, system } = specialBattle(MAX_THE - 5)

    system.resolveNextStep(battle)

    expect(playerParticipant.entity.currentThe).toBe(MAX_THE)
    expect(playerParticipant.entity.currentThe).toBeLessThan(MAX_THE - 5 + THE_GAIN_PER_LINK + THE_GAIN_PER_FINISHER)
  })

  it('grants THE_GAIN_PER_FINISHER on a landed ultimate hit', () => {
    const { battle, playerParticipant, system } = specialBattle()

    playerParticipant.ultimate = {
      skill: {
        id: 'qa_ultimate',
        cooldownTurns: 0,
        // Gated by the Thế pool itself so commitAction consumes the full
        // 100 before the finisher gain is applied.
        resourceType: 'the',
        resourceCost: 100,
        damage: { kind: 'physical', multiplier: 1 },
        targeting: { shape: 'single' },
      },
      remainingCooldownTurns: 0,
    }
    // selectAction prefers the ultimate when affordable — give a full pool
    // but the gate consumes 100 (pool is already full), then the landed
    // hit grants +20 on top of the emptied pool.
    playerParticipant.entity.currentThe = MAX_THE

    system.resolveNextStep(battle)

    // Ultimate consumed the full pool (100 → 0), then the landed hit
    // granted THE_GAIN_PER_FINISHER (20).
    expect(playerParticipant.entity.currentThe).toBe(THE_GAIN_PER_FINISHER)
  })
})
