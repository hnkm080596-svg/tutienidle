import { describe, expect, it } from 'vitest'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer } from '../player/Player'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import { defineEnemy } from '../enemy/Enemy'
import type { EnemyDefinition } from '../enemy/Enemy'
import { calculateStats } from '../stats/StatCalculator'

// Bản Mệnh Pháp Bảo — tích hợp THẬT qua GameManager.startBattleWithPlayer()
// + BattleSystem.update() (không stub deps), xác nhận wiring end-to-end:
// setArtifactRuntime() được gọi, tick chạy qua update() thật, damage
// đáp xuống enemy thật qua applyActionHit() với origin đúng.

function bigHpEnemyDefinition(id: string): EnemyDefinition {
  return {
    id,
    name: 'Bia Tập Trúc Cơ',
    level: 1,
    realmId: 'foundation_establishment',
    lane: 'ground',
    statsInput: {
      maxHp: 1_000_000,
      attack: 0,
      attackSpeed: 0,
      movementSpeed: 0,
      attackRangeRanks: 0, // không tự đánh lại, cô lập damage của artifact
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      // evasionRate 0 -> hit chance 100% (accuracy 100 / (100+0)), cùng
      // convention BattleSystem.theTu.test.ts — nếu để mặc định 25 thì mỗi
      // phát artifact có 20% trượt qua rollHit(Math.random) khiến test flaky
      // (artifact bắn đủ nhưng hit trượt -> HP không đổi -> assert sai).
      evasionRate: 0,
    },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  }
}

function setupPhapTuWithArtifact() {
  const gameManager = new GameManager()

  gameManager.registerEnemyTemplates([defineEnemy(bigHpEnemyDefinition('dummy'))])

  const player = createDefaultPlayer()
  player.cultivationPath = 'phap_tu'
  player.realmId = 'foundation_establishment'
  player.realmLevel = 1
  player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
  player.artifact.selectedPath = 'attack'
  player.unlockedElements = ['fire']
  player.equippedElements = ['fire']
  // Không skill/basic attack nào equip — mọi damage quan sát được chỉ
  // có thể tới từ artifact.
  player.baseStats.attack = 0
  player.baseStats.firePower = 200
  // Tầm rất lớn — cô lập test khỏi biến số vị trí spawn/di chuyển,
  // chỉ tập trung xác nhận artifact TỰ bắn và trừ HP thật.
  player.baseStats.attackRange = 999

  const stats = calculateStats(player.baseStats, [])

  gameManager.startBattleWithPlayer(player, stats, gameManager.getEnemyTemplate('dummy')!)

  return { gameManager, player }
}

describe('BattleSystem — Bản Mệnh Pháp Bảo tích hợp thật (doc §11)', () => {
  it('setArtifactRuntime gắn đúng snapshot khi player có artifact', () => {
    const { gameManager } = setupPhapTuWithArtifact()

    const runtime = gameManager.getBattle()?.artifactRuntime

    expect(runtime).toBeDefined()
    expect(runtime?.snapshot.artifactId).toBe('ngu_hanh_chau')
    expect(runtime?.snapshot.path).toBe('attack')
    expect(runtime?.snapshot.equippedElements).toEqual(['fire'])
  })

  it('player không có artifact (Kiếm Tu) -> battle.artifactRuntime undefined, update() không crash', () => {
    const gameManager = new GameManager()

    gameManager.registerEnemyTemplates([defineEnemy(bigHpEnemyDefinition('dummy'))])

    const player = createDefaultPlayer()
    player.cultivationPath = 'kiem_tu'

    const stats = calculateStats(player.baseStats, [])

    gameManager.startBattleWithPlayer(player, stats, gameManager.getEnemyTemplate('dummy')!)

    expect(gameManager.getBattle()?.artifactRuntime).toBeUndefined()
    expect(() => gameManager.update(5)).not.toThrow()
  })

  it('sau vài giây fighting, artifact tự bắn và trừ HP thật của enemy qua applyActionHit', () => {
    const { gameManager } = setupPhapTuWithArtifact()

    // Countdown 3s trước khi 'fighting' — đẩy qua countdown rồi mới
    // tính damage window.
    gameManager.update(3.5)

    const hpAfterCountdown = gameManager.getBattle()?.enemies[0]?.entity.currentHp ?? 0

    gameManager.update(4) // ít nhất 1 activation (chu kỳ 3.0s) trong lúc fighting

    const hpAfterFighting = gameManager.getBattle()?.enemies[0]?.entity.currentHp ?? 0

    expect(hpAfterFighting).toBeLessThan(hpAfterCountdown)
  })

  it('artifact vẫn bắn khi player đang bị CC (Choáng) giữa trận', () => {
    const { gameManager } = setupPhapTuWithArtifact()

    gameManager.update(3.5) // qua khỏi countdown

    const battle = gameManager.getBattle()!

    battle.playerAilments.add({
      id: 'choang',
      category: 'cc',
      sourceId: battle.enemies[0]!.entity.id,
      targetId: battle.player.id,
      duration: 10,
      remainingTime: 10,
      stacks: 1,
      stackMode: 'refresh',
      ccEffect: 'stun',
      continuousSeconds: 0,
    } as never)

    const hpBefore = battle.enemies[0]!.entity.currentHp

    gameManager.update(4)

    expect(battle.enemies[0]!.entity.currentHp).toBeLessThan(hpBefore)
  })
})
