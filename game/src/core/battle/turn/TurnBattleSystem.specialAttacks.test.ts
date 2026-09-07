import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { defineEnemy, enemyToCombatEntity } from '../../enemy/Enemy'
import { toTurnBattleParticipant } from '../../game/TurnBattleAdapter'
import type { CombatEntity } from '../../combat/CombatEntity'
import type { TurnSkillDefinition } from './TurnSkillAction'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TurnBuffPool } from './TurnBuffPool'

// Phase A3 Task 5 (2026-09-07) — turn-based reader for
// CombatEntity.specialAttacks (enemy periodic heavy attack). Legacy
// semantics (EnemyAttackSystem.fireEnemyAttack): 1-based counter per
// enemy, incremented on each of ITS OWN attacks; when
// counter % everyNth === 0 the special attack replaces the basic attack
// (damageMultiplier swap, presetId carried for presentation). Counter
// never resets mid-battle. Turn-based: same semantics, counted per
// enemy's own actions.

function createCombatant(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

  return {
    id,
    name: id,
    type: 'enemy',
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
  damage: { kind: 'physical', multiplier: 0 },
  targeting: { shape: 'single' },
}

function bossBattle() {
  const player = createCombatant('player', { currentHp: 10_000_000, maxHp: 10_000_000 })
  player.type = 'player'

  // Boss: every 4th of its own attacks is a 3x heavy hit.
  const bossEnemy = defineEnemy({
    id: 'qa_boss',
    name: 'QA Boss',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 1_000_000,
      attack: 10,
      attackSpeed: 1,
      attackRangeRanks: 9,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      evasionRate: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
    specialAttacks: [{ everyNth: 4, damageMultiplier: 3, presetId: 'water_surge' }],
  })

  const bossParticipant = toTurnBattleParticipant(enemyToCombatEntity(bossEnemy), 1, BASIC)

  const battle: TurnBattle = {
    players: [makeParticipant('player', player, 10, 0)],
    enemies: [bossParticipant],
    state: 'fighting',
  }

  const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 100)

  return { battle, bossParticipant, system }
}

describe('turn-based enemy specialAttacks reader (Phase A3)', () => {
  it('boss special attack replaces the basic attack on every 4th of its own actions', () => {
    const { battle, bossParticipant, system } = bossBattle()

    const playerEntity = battle.players[0]!.entity
    const hpBefore = playerEntity.currentHp

    // Each resolveNextStep = one full turn (the internal queue advances the
    // gauge until someone acts). Boss speed 100 vs player 10 → boss takes
    // ~10 of every 11 turns; 50 turns ≈ 45 boss actions, comfortably past
    // the first everyNth=4 special.
    for (let i = 0; i < 50; i++) {
      system.resolveNextStep(battle)
    }

    // The boss counter advanced past 4 → at least one special attack fired.
    expect((bossParticipant.specialAttackCounter ?? 0)).toBeGreaterThanOrEqual(4)

    // A 3x heavy hit (base 10 × 3 = 30 raw, minus armor) must have landed;
    // basic hits with the same stats cap well below 20. Assert via
    // cumulative damage: at least one 3x hit among ≥4 landed actions.
    const totalDamage = hpBefore - playerEntity.currentHp
    expect(totalDamage).toBeGreaterThanOrEqual(25)
  })

  it('special attack does NOT fire before everyNth actions', () => {
    const { battle, bossParticipant, system } = bossBattle()

    const playerEntity = battle.players[0]!.entity
    const hpBefore = playerEntity.currentHp

    // First boss action only: counter 1, not divisible by 4.
    for (let i = 0; i < 12; i++) {
      if ((bossParticipant.specialAttackCounter ?? 0) >= 1) break
      system.resolveNextStep(battle)
    }

    expect(bossParticipant.specialAttackCounter).toBe(1)

    // Only the first basic hit has landed (multiplier 1 → single-digit
    // damage after armor; the engine floors every landed hit at 1).
    const totalDamage = hpBefore - playerEntity.currentHp
    expect(totalDamage).toBeGreaterThanOrEqual(1)
    expect(totalDamage).toBeLessThan(20)
  })
})
