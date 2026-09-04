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
const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  attack: 0,
  attackSpeed: 1,
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

function registerDoanBaoThach(gameManager: GameManager) {
  gameManager.registerMaterials([
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

    expect(gameManager.tryUpgradeArtifactGrade(player)).toBe(false)
  })

  it('ngoài combat, đủ đá -> nâng phẩm thành công qua materialBag thật', () => {
    const gameManager = new GameManager()

    registerDoanBaoThach(gameManager)

    const player = createDefaultPlayer()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    gameManager.materialBag.add(gameManager.materialRegistry.get('doan_bao_thach'), 10)

    expect(gameManager.tryUpgradeArtifactGrade(player)).toBe(true)
    expect(player.artifact.grade).toBe('linh')
    expect(gameManager.materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('chặn nâng phẩm khi đang combat, không trừ đá', () => {
    const gameManager = new GameManager()

    registerDoanBaoThach(gameManager)
    gameManager.registerEnemyTemplates([defineEnemy(enemyDefinition())])

    const player = createDefaultPlayer()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    gameManager.materialBag.add(gameManager.materialRegistry.get('doan_bao_thach'), 10)

    gameManager.startBattle(createPlayerEntity(), defineEnemy(enemyDefinition()))
    expect(gameManager.getBattle()?.state).toBe('countdown')

    expect(gameManager.tryUpgradeArtifactGrade(player)).toBe(false)
    expect(player.artifact.grade).toBe('pham')
    expect(gameManager.materialBag.getAmount('doan_bao_thach')).toBe(10)
  })
})
