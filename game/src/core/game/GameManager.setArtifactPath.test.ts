import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { EnemyDefinition } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'

// Bản Mệnh Pháp Bảo (doc §7.1) — setArtifactPath() đổi được NHIỀU LẦN
// ngoài combat, chặn trong countdown/fighting/tribulation, không cần
// artifact tồn tại thì no-op false.
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

function createPlayerEntity(): CombatEntity {
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
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  }
}

function enemyDefinition(): EnemyDefinition {
  return {
    id: 'target_dummy',
    name: 'Bia Tập',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: MINIMAL_STATS_INPUT,
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  }
}

describe('GameManager.setArtifactPath (doc §7.1)', () => {
  it('không có artifact -> no-op false', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    expect(gameManager.setArtifactPath(player, 'attack')).toBe(false)
  })

  it('không có battle -> đổi được ngay', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

    expect(gameManager.setArtifactPath(player, 'defense')).toBe(true)
    expect(player.artifact.selectedPath).toBe('defense')
  })

  it('đổi được nhiều lần ngoài combat (không phải lựa chọn vĩnh viễn)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

    gameManager.setArtifactPath(player, 'attack')
    gameManager.setArtifactPath(player, 'control')

    expect(player.artifact.selectedPath).toBe('control')
  })

  it('chặn đổi hướng khi battle đang countdown/fighting', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

    gameManager.registerEnemyTemplates([defineEnemy(enemyDefinition())])
    gameManager.startBattle(createPlayerEntity(), defineEnemy(enemyDefinition()))

    expect(gameManager.getBattle()?.state).toBe('countdown')
    expect(gameManager.setArtifactPath(player, 'attack')).toBe(false)
    expect(player.artifact.selectedPath).toBeUndefined()
  })
})
