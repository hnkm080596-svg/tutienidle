import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import type { Stage } from '../stage/Stage'
import type { Buff } from '../buff/Buff'

// Combat Rework Phase 9 — mirror checklist "MVP cuối cùng" (plan mục
// 20): PLAYER (HP/Attack/Class→Projectile Pierce) + ENEMY (HP/Defense/
// AttackRange/Projectile) + COMBAT (Targeting/Collision/Damage Engine/
// Death) + BOSS (HP/Phase/Enrage) chạy chung 1 vòng lặp THẬT qua
// GameManager — không mock lại BattleSystem, dùng đúng data skill/
// technique thật (Kiếm Tu) đã ship. Đây là bài test "tất cả ráp lại
// có chạy được không", không lặp lại các test chi tiết từng cơ chế đã
// có ở Phase 3-8.
describe('GameManager — MVP loop end-to-end (Combat Rework Phase 9)', () => {
  it('Class thật (Kiếm Tu) đánh xuyên 1 Stage 2 quái (mob + Boss có Phase/Enrage) tới Victory', () => {
    const gameManager = new GameManager()

    gameManager.registerTechniqueTemplates(TECHNIQUES)
    gameManager.registerSkillTemplates(SKILLS)

    const enrageBuff: Buff = {
      id: 'mvp_test_enrage',
      name: 'Enrage (test)',
      category: 'buff',
      stacks: 1,
      stackMode: 'stack',
      modifiers: [],
    }

    const phaseBuff: Buff = {
      id: 'mvp_test_phase',
      name: 'Phase (test)',
      category: 'buff',
      stacks: 1,
      stackMode: 'stack',
      modifiers: [],
    }

    const mob = defineEnemy({
      id: 'mvp_test_mob',
      name: 'Mob',
      level: 1,
      realmId: 'qi_refining',
      lane: 'ground',
      statsInput: { maxHp: 20, attack: 0, attackSpeed: 1, movementSpeed: 60, attackRange: 999999, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { experience: 0, cultivation: 0, spiritStone: 0 },
    })

    const boss = defineEnemy({
      id: 'mvp_test_boss',
      name: 'Boss',
      level: 1,
      realmId: 'qi_refining',
      lane: 'ground',
      statsInput: { maxHp: 15, attack: 0, attackSpeed: 1, movementSpeed: 60, attackRange: 999999, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
      rewards: { experience: 0, cultivation: 0, spiritStone: 0 },
      isBoss: true,
      // createBossVariant() nhân maxHp x8 -> 120 HP thật khi vào trận.
      tribulationPhases: [{ hpThresholdPercent: 0.5, buff: phaseBuff, archetypeOverride: 'ranged' }],
      enrage: { afterSeconds: 1, buff: enrageBuff },
    })

    gameManager.registerEnemyTemplates([mob, boss])

    const stage: Stage = {
      id: 'mvp_test_stage',
      name: 'MVP Test Stage',
      description: '',
      enemyPool: [{ enemyId: 'mvp_test_mob', weight: 1 }],
      totalEnemyCount: 2,
      spawnIntervalSeconds: 0.1,
      bossEnemyId: 'mvp_test_boss',
    }

    gameManager.registerStages([stage])

    const player = createDefaultPlayer()

    // Class — Kiếm Tu THẬT, tự cấp Tâm Pháp + Ngự Kiếm Thuật (basic,
    // đã có Pierce từ Phase 5) + 2 skill còn lại.
    expect(gameManager.chooseCultivationPath('kiem_tu', player)).toBe(true)

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(gameManager.startStage(player, finalStats, stage)).toBe(true)

    let sawBossSpawn = false
    let sawBossPhaseTrigger = false
    let sawBossEnrageTrigger = false

    for (let i = 0; i < 4000 && gameManager.getBattle()?.state === 'fighting'; i++) {
      gameManager.update(0.05)

      const battle = gameManager.getBattle()

      const bossEntry = battle?.enemies.find(enemy => enemy.entity.id.startsWith('mvp_test_boss_'))

      if (bossEntry) {
        sawBossSpawn = true

        if (bossEntry.entity.archetype === 'ranged') {
          sawBossPhaseTrigger = true
        }

        if (bossEntry.buffs.has('mvp_test_enrage')) {
          sawBossEnrageTrigger = true
        }
      }
    }

    // COMBAT + PLAYER + ENEMY: trận phải THẮNG thật (không phải hết
    // tick mà vẫn 'fighting' — nghĩa là Damage Engine/Targeting/
    // Collision/Death của TOÀN BỘ vòng lặp hoạt động đúng).
    expect(gameManager.getBattle()!.state).toBe('victory')

    // BOSS: quái Boss thật đã spawn (Stage→wave spawn hoạt động), và
    // cả Phase (archetype đổi) lẫn Enrage (buff áp) đều trigger được
    // trong 1 trận thật — không chỉ ở test cô lập BattleSystem.
    expect(sawBossSpawn).toBe(true)
    expect(sawBossPhaseTrigger).toBe(true)
    expect(sawBossEnrageTrigger).toBe(true)
  })
})
