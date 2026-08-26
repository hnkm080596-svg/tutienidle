import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Buff } from '../buff/Buff'
import type { EnemyDefinition } from '../enemy/Enemy'

const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  attack: 0,
  attackSpeed: 1,
  movementSpeed: 60,
  attackRangeRanks: 999999,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0 }

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentRage: 0,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  }
}

function createSummonTargetDefinition(id: string): EnemyDefinition {
  return {
    id,
    name: 'Sói Triệu Hồi',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: MINIMAL_STATS_INPUT,
    rewards: { techniqueInsight: 0, cultivation: 0, spiritStone: 0 },
  }
}

describe('GameManager.updateBossSummons (Combat Rework Phase 4 — Boss Mechanics)', () => {
  it('boss trigger summonEnemyIds thì spawn thật quái mới vào battle.enemies, rồi dọn sạch pendingSummons', () => {
    const gameManager = new GameManager()

    gameManager.registerEnemyTemplates([defineEnemy(createSummonTargetDefinition('add_wolf'))])

    const enrageBuff: Buff = {
      id: 'unused',
      name: 'unused',
      category: 'buff',
      stacks: 1,
      stackMode: 'stack',
      modifiers: [],
    }

    const boss = defineEnemy({
      id: 'boss_test',
      name: 'Boss Test',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: MINIMAL_STATS_INPUT,
      rewards: { techniqueInsight: 0, cultivation: 0, spiritStone: 0 },
      isBoss: true,
      tribulationPhases: [
        // hpThresholdPercent 1 -> HP đầy (100%) vẫn <= 1, trigger NGAY
        // tick đầu tiên, khỏi phải giả lập damage để hạ HP trong test.
        { hpThresholdPercent: 1, buff: enrageBuff, summonEnemyIds: ['add_wolf'] },
      ],
    })

    gameManager.startBattle(createPlayer(), boss)
    gameManager.update(3) // Countdown 3s trước trận (2026-08-22) - bỏ qua để test chạy combat logic ngay

    expect(gameManager.getBattle()!.enemies).toHaveLength(1)

    gameManager.update(0.016)

    const battle = gameManager.getBattle()!

    // Spawn telegraph (2026-08-24): summon được ĐẶT LỊCH qua pending
    // queue rồi materialize sau 0.75s — flush telegraph để assertions
    // đọc trạng thái cuối (resolveBossSummons đã rút sạch pendingSummons).
    gameManager.update(1)

    expect(battle.enemies).toHaveLength(2)
    expect(
      battle.enemies.some((battleEnemy) => battleEnemy.entity.id.startsWith('add_wolf_')),
    ).toBe(true)
    expect(battle.pendingSummons).toEqual([])
    expect(battle.pendingEnemySpawns).toEqual([])
  })

  it('không có template khớp id thì bỏ qua summon đó, không throw', () => {
    const gameManager = new GameManager()
    // Cố tình KHÔNG registerEnemyTemplates() cho 'unknown_enemy'.

    const enrageBuff: Buff = {
      id: 'unused',
      name: 'unused',
      category: 'buff',
      stacks: 1,
      stackMode: 'stack',
      modifiers: [],
    }

    const boss = defineEnemy({
      id: 'boss_test',
      name: 'Boss Test',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: MINIMAL_STATS_INPUT,
      rewards: { techniqueInsight: 0, cultivation: 0, spiritStone: 0 },
      tribulationPhases: [
        { hpThresholdPercent: 1, buff: enrageBuff, summonEnemyIds: ['unknown_enemy'] },
      ],
    })

    gameManager.startBattle(createPlayer(), boss)
    gameManager.update(3) // Countdown 3s trước trận (2026-08-22) — bỏ qua để test chạy combat logic ngay

    expect(() => gameManager.update(0.016)).not.toThrow()

    expect(gameManager.getBattle()!.enemies).toHaveLength(1)
  })
})
