import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { calculateStats } from '../stats/StatCalculator'
import { defineEnemy } from '../enemy/Enemy'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import type { Stage } from '../stage/Stage'
import type { Buff } from '../buff/Buff'
import { isBattleInProgress } from '../battle/BattleTypes'

// Math.random là state TOÀN CỤC theo worker thread — file test chạy
// trước trong cùng worker làm đổi chuỗi random của test này khiến trận
// đấu tự nhiên có thể kết thúc 'defeat' (flaky chỉ hiện khi chạy full
// suite). Seed PRNG cố định (mulberry32) để vòng lặp MVP deterministic
// bất kể thứ tự chia worker.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0

    let t = state

    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Seed chọn sao cho trận thắng ổn định (đã xác minh qua nhiều lần chạy).
const MVP_LOOP_SEED = 1

// Combat Rework Phase 9 — mirror checklist "MVP cuối cùng" (plan mục
// 20): PLAYER (HP/Attack/Class→Projectile Pierce) + ENEMY (HP/Defense/
// AttackRange/Projectile) + COMBAT (Targeting/Collision/Damage Engine/
// Death) + BOSS (HP/Phase/Enrage) chạy chung 1 vòng lặp THẬT qua
// GameManager — không mock lại BattleSystem, dùng đúng data skill/
// technique thật (Kiếm Tu) đã ship. Đây là bài test "tất cả ráp lại
// có chạy được không", không lặp lại các test chi tiết từng cơ chế đã
// có ở Phase 3-8.
describe('GameManager — MVP loop end-to-end (Combat Rework Phase 9)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Class thật (Kiếm Tu) đánh xuyên 1 Stage 2 quái (mob + Boss có Phase/Enrage) tới Victory', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(MVP_LOOP_SEED))

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
      // attackRange thật (không phải 999999 "vô hạn" kiểu player) — quái
      // với range vô hạn nghĩ đã đủ tầm nên KHÔNG BAO GIỜ đi tới
      // (resolveMovement() chỉ bước khi distance>range), mãi mãi đứng
      // ngoài SCREEN_VISIBLE_MAX_X (2026-08-22, xem BattleLane.ts) —
      // gate "không bắn quái offscreen" sẽ khoá cứng cả 2 phía.
      statsInput: {
        maxHp: 20,
        attack: 0,
        attackSpeed: 1,
        movementSpeed: 2.4,
        attackRangeRanks: 7,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })

    const boss = defineEnemy({
      id: 'mvp_test_boss',
      name: 'Boss',
      level: 1,
      realmId: 'qi_refining',
      lane: 'ground',
      // attackRange thật, cùng lý do đã ghi ở mob phía trên (2026-08-22).
      statsInput: {
        maxHp: 15,
        attack: 0,
        attackSpeed: 1,
        movementSpeed: 2.4,
        attackRangeRanks: 7,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
      isBoss: true,
      // createBossVariant() nhân maxHp x7 -> 105 HP thật khi vào trận.
      tribulationPhases: [
        { hpThresholdPercent: 0.5, buff: phaseBuff, archetypeOverride: 'ranged' },
      ],
      enrage: { afterSeconds: 1, buff: enrageBuff },
    })

    gameManager.registerEnemyTemplates([mob, boss])

    const stage: Stage = {
      id: 'mvp_test_stage',
      name: 'MVP Test Stage',
      description: '',
      floor: 10,
      enemyPool: [{ enemyId: 'mvp_test_mob', weight: 1 }],
      totalEnemyCount: 2,
      spawnIntervalSeconds: 0.1,
      bossEnemyId: 'mvp_test_boss',
    }

    gameManager.registerStages([stage])

    const player = createDefaultPlayer()

    // Class — Kiếm Tu THẬT, tự cấp Tâm Pháp + Ngự Kiếm Thuật (basic,
    // đã có Pierce từ Phase 5) + 2 skill còn lại.
    player.realmLevel = 12
    expect(gameManager.chooseCultivationPath('kiem_tu', player)).toBe(true)

    // Spawn telegraph (2026-08-24): quái materialize trễ hơn (0.75–1.4s)
    // khiến trận dài thêm ~2-3s, realm pressure tích lũy thêm — cộng
    // buffer HP nhỏ để bài test giữ đúng mục đích "vòng lặp đầy đủ tới
    // Victory" thay vì đua trên biên HP mỏng của seed.
    player.baseStats.maxHp += 40

    // Combat AI rework (plan §13/§2.4) + balance pass 2026-08-26: Boss
    // đổi archetype sang 'ranged' ở phase 50% rồi giữ khoảng cách kiting
    // 0.6×range tới cổng (rank authored 7 bị clamp về 5 → đứng ở cột ≥3).
    // Kiếm Tu range nền 5 với tới cột ≤10 nên vẫn bắn được kiter; fixture
    // cộng thêm range để bài test không phụ thuộc biên.
    player.baseStats.attackRange += 8

    const finalStats = calculateStats(player.baseStats, [
      ...player.modifiers,
      ...gameManager.getAggregatedModifiers(),
    ])

    expect(gameManager.startStage(player, finalStats, stage)).toBe(true)

    let sawBossSpawn = false
    let sawBossPhaseTrigger = false
    let sawBossEnrageTrigger = false

    // Countdown 3 giây trước trận (2026-08-22) — startStage() giờ bắt
    // đầu ở 'countdown' chứ không 'fighting' ngay, xem BattleSystem.start().
    for (let i = 0; i < 4000 && isBattleInProgress(gameManager.getBattle()?.state); i++) {
      gameManager.update(0.05)

      const battle = gameManager.getBattle()

      const bossEntry = battle?.enemies.find((enemy) =>
        enemy.entity.id.startsWith('mvp_test_boss_'),
      )

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
