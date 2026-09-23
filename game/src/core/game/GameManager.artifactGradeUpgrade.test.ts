import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { EnemyDefinition } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'

// Bản Mệnh Pháp Bảo (doc §5.3) — GameManager.tryUpgradeArtifactGrade()
// route qua materialBag thật + chặn giữa combat, ngoài combat mới cho
// nâng phẩm.
// M-F-ARTIFACT-DEFER: the artifact domain is deferred to Kim Dan+ - the
// op is additionally gated by isArtifactDomainUnlocked(player.realmId),
// so every real-policy case here (mortal/Truc Co) stays false. The
// open-window positive lives in ReleasePolicy.artifactDeferred.test.ts.
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

function registerDoanBaoThach(gameManager: GameManager) {
  gameManager.catalogOps.registerMaterials([
    {
      id: 'doan_bao_thach',
      name: 'Đoán Bảo Thạch',
      category: 'other',
      sourceType: 'monster',
      description: 'test fixture',
    },
  ])
}

describe('GameManager.tryUpgradeArtifactGrade (doc §5.3)', () => {
  it('không có artifact -> no-op false', () => {
    const gameManager = new GameManager()
    const player = createDefaultPlayer()

    expect(gameManager.realmAdvanceOps.tryUpgradeArtifactGrade(player)).toBe(false)
  })

  it('ngoài combat, đủ đá nhưng domain deferred -> no-op false, không trừ đá (mortal)', () => {
    const gameManager = new GameManager()

    registerDoanBaoThach(gameManager)

    const player = createDefaultPlayer()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    gameManager.materialBag.add(gameManager.materialRegistry.get('doan_bao_thach'), 10)

    expect(gameManager.realmAdvanceOps.tryUpgradeArtifactGrade(player)).toBe(false)
    expect(player.artifact.grade).toBe('pham')
    expect(gameManager.materialBag.getAmount('doan_bao_thach')).toBe(10)
  })

  it('ngoài combat, đủ đá nhưng domain deferred -> no-op false, không trừ đá (Trúc Cơ)', () => {
    const gameManager = new GameManager()

    registerDoanBaoThach(gameManager)

    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    gameManager.materialBag.add(gameManager.materialRegistry.get('doan_bao_thach'), 10)

    expect(gameManager.realmAdvanceOps.tryUpgradeArtifactGrade(player)).toBe(false)
    expect(player.artifact.grade).toBe('pham')
    expect(gameManager.materialBag.getAmount('doan_bao_thach')).toBe(10)
  })

  it('chặn nâng phẩm khi đang combat, không trừ đá', () => {
    const gameManager = new GameManager()

    registerDoanBaoThach(gameManager)
    gameManager.catalogOps.registerEnemyTemplates([defineEnemy(enemyDefinition())])

    const player = createDefaultPlayer()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    gameManager.materialBag.add(gameManager.materialRegistry.get('doan_bao_thach'), 10)

    gameManager.startBattle(createPlayerEntity(), defineEnemy(enemyDefinition()))
    expect(gameManager.getTurnBattle()?.state).toBe('intro')

    expect(gameManager.realmAdvanceOps.tryUpgradeArtifactGrade(player)).toBe(false)
    expect(player.artifact.grade).toBe('pham')
    expect(gameManager.materialBag.getAmount('doan_bao_thach')).toBe(10)
  })
})
