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
// M-F-ARTIFACT-DEFER: the artifact domain is deferred to Kim Dan+ - the
// op is gated by isArtifactDomainUnlocked(player.realmId), so every
// real-policy case here (mortal/Truc Co) stays false. The open-window
// positive lives in ReleasePolicy.artifactDeferred.test.ts.
const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayerEntity(): CombatEntity {
  const stats = createBaseStats({ might: 0 })

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
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
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  }
}

describe('GameManager.setArtifactPath (doc §7.1)', () => {
  it('không có artifact -> no-op false', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    expect(gameManager.realmAdvanceOps.setArtifactPath(player, 'attack')).toBe(false)
  })

  it('không có battle nhưng domain deferred -> no-op false (mortal)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

    expect(gameManager.realmAdvanceOps.setArtifactPath(player, 'defense')).toBe(false)
    expect(player.artifact.selectedPath).toBeUndefined()
  })

  it('không có battle nhưng domain deferred -> no-op false (Trúc Cơ)', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

    expect(gameManager.realmAdvanceOps.setArtifactPath(player, 'attack')).toBe(false)
    expect(gameManager.realmAdvanceOps.setArtifactPath(player, 'control')).toBe(false)
    expect(player.artifact.selectedPath).toBeUndefined()
  })

  it('chặn đổi hướng khi battle đang intro/countdown/fighting', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

    gameManager.catalogOps.registerEnemyTemplates([defineEnemy(enemyDefinition())])
    gameManager.startBattle(createPlayerEntity(), defineEnemy(enemyDefinition()))

    expect(gameManager.getTurnBattle()?.state).toBe('intro')
    expect(gameManager.realmAdvanceOps.setArtifactPath(player, 'attack')).toBe(false)
    expect(player.artifact.selectedPath).toBeUndefined()
  })
})
