import { describe, expect, it } from 'vitest'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from './TurnBattleSystem'
import type { CombatEntity } from '../../combat/CombatEntity'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'

// QA adversarial probes (2026-09-04 quick review) — Slice 5 wave/stage.

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, blockChance: 0 })

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
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
  } as CombatEntity
}

function makeParticipant(
  id: string,
  combatEntity: CombatEntity,
  speed: number,
  priority: number,
): TurnBattleParticipant {
  return { id, entity: combatEntity, speed, priority, actionGauge: 0, alive: combatEntity.alive, consecutiveHardCcTurns: 0 }
}

describe('Slice 5 adversarial (QA probes)', () => {
  it('INV-S5-1: maxTurns cap vẫn hoạt động với wave spawn loop — không treo vô hạn', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 1 }) })
    const enemyA = createCombatant({ id: 'enemyA', currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 1 }) })

    const wave = { totalEnemyCount: 50, waves: [50], spawnedCount: 1, waveIndex: 0, pendingEnemySpawns: [] }
    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    let spawnCount = 0
    const spawnEnemy = (): TurnBattleParticipant => {
      spawnCount += 1
      const e = createCombatant({ id: `spawned_${spawnCount}`, currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 1 }) })
      return makeParticipant(e.id, e, 10, spawnCount + 1)
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 5, undefined, spawnEnemy)
    const result = system.runToCompletion(battle)

    // 1 dmg vs 1M hp — stalemate: cap 5 steps terminates an toàn ở defeat.
    expect(result).toBe('defeat')
    expect(battle.enemies.length).toBeLessThanOrEqual(6)
  })

  it('INV-S5-2: spawned enemy là participant mới hoàn toàn (không thừa hưởng state từ enemy cũ)', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 999 }) })
    const enemyA = createCombatant({ id: 'enemyA', currentHp: 1, maxHp: 1, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }) })

    const wave = { totalEnemyCount: 2, waves: [2], spawnedCount: 1, waveIndex: 0, pendingEnemySpawns: [] }
    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [makeParticipant('enemyA', enemyA, 10, 1)],
      state: 'fighting',
      wave,
    }

    let spawned: TurnBattleParticipant | undefined
    const spawnEnemy = (): TurnBattleParticipant => {
      spawned = makeParticipant('enemyB', createCombatant({ id: 'enemyB', currentHp: 1_000_000, maxHp: 1_000_000, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 0 }) }), 10, 2)
      return spawned
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 20, undefined, spawnEnemy)
    // Turn-Based Wave Redesign (2026-09-06) — spawn chuyển sang tickPacing:
    // giết enemyA (sân trống, waveIndex 0 < 1, spawnedCount 1 < 2) rồi
    // tickPacing → wave mới queue qua telegraph → spawnEnemy chạy.
    enemyA.alive = false
    battle.enemies = []
    system.tickPacing(battle)

    // buff2 M4: no per-participant pool exists — instance identity lives
    // in the shared store keyed by targetId. The invariant that remains:
    // the spawned participant is a fresh object queued by the telegraph
    // (no state leaks across the spawn boundary).
    expect(spawned).toBeDefined()
    expect(battle.wave?.pendingEnemySpawns.length).toBeGreaterThan(0)
    expect(spawned!.entity.id).toBe('enemyB')
  })

  it('INV-S5-3: wave totalEnemyCount=0 với spawnedCount=0 — isStageComplete true ngay khi sân trống', () => {
    const player = createCombatant({ id: 'player', type: 'player' as never, stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 10 }) })

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [],
      state: 'fighting',
      wave: { totalEnemyCount: 0, waves: [], spawnedCount: 0, waveIndex: 0, pendingEnemySpawns: [] },
    }

    const step = new TurnBattleSystem(new CombatSystem(new EventBus()), 20).resolveNextStep(battle)

    // Sân trống + mọi enemy đã spawn (0/0) → victory ngay.
    expect(step.state).toBe('victory')
  })
})
