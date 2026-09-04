import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import { TurnBuffPool } from './TurnBuffPool'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'

// QA adversarial probes (2026-09-04 quick review) — Slice 5 wave/stage.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0 }

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
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
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, buffs: new TurnBuffPool(), consecutiveHardCcTurns: 0 }
}

describe('Slice 5 adversarial (QA probes)', () => {
  it('INV-S5-1: maxTurns cap vẫn hoạt động với wave spawn loop — không treo vô hạn', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 1 } })
    const enemyA = createCombatant({ id: 'enemyA', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 1 } })

    const wave = { totalEnemyCount: 50, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    let spawnCount = 0
    const spawnEnemy = (): TurnBattleParticipant => {
      spawnCount += 1
      const e = createCombatant({ id: `spawned_${spawnCount}`, currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 1 } })
      return makeParticipant(e.id, e, 10, spawnCount + 1)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 5, undefined, spawnEnemy)
    const result = system.runToCompletion(battle)

    // 1 dmg vs 1M hp — stalemate: cap 5 steps terminates an toàn ở defeat.
    expect(result).toBe('defeat')
    expect(battle.enemies.length).toBeLessThanOrEqual(6)
  })

  it('INV-S5-2: spawned enemy có TurnBuffPool riêng (không share pool với enemy cũ)', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 999 } })
    const enemyA = createCombatant({ id: 'enemyA', currentHp: 1, maxHp: 1, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

    const wave = { totalEnemyCount: 2, spawnedCount: 1 }
    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    let spawnedPool: TurnBuffPool | undefined
    const spawnEnemy = (): TurnBattleParticipant => {
      const spawned = makeParticipant('enemyB', createCombatant({ id: 'enemyB', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } }), 10, 2)
      spawnedPool = spawned.buffs
      return spawned
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)
    system.resolveNextStep(battle)

    const enemyAParticipant = battle.enemies[0]!
    expect(spawnedPool).toBeDefined()
    expect(spawnedPool).not.toBe(enemyAParticipant.buffs)
  })

  it('INV-S5-3: wave totalEnemyCount=0 với spawnedCount=0 — isStageComplete true ngay khi sân trống', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 10 } })

    const battle: TurnBattle = {
      player: makeParticipant('player', player, 10, 0),
      enemies: [],
      state: 'fighting',
      wave: { totalEnemyCount: 0, spawnedCount: 0 },
    }

    const step = new TurnBattleSystem(new CombatSystem(new EventBus()), 20).resolveNextStep(battle)

    // Sân trống + mọi enemy đã spawn (0/0) → victory ngay.
    expect(step.state).toBe('victory')
  })
})
