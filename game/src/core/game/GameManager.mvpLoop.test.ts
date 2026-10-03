import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { SKILLS } from '../../data/skill/Skills'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import type { Stage } from '../stage/Stage'
import type { BuffDefinition } from '../buff2/BuffDefinition'
import { isBattleInProgress } from '../battle/BattleTypes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Math.random la state TOAN CUC theo worker thread - file test chay
// truoc trong cung worker lam doi chuoi random cua test nay khien tran
// dau tu nhien co the ket thuc 'defeat' (flaky chi hien khi chay full
// suite). Seed PRNG co dinh (mulberry32) de vong lap MVP deterministic
// bat ke thu tu chia worker.
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

// Seed chon sao cho tran thang on dinh (da xac minh qua nhieu lan chay).
const MVP_LOOP_SEED = 1

// Combat Rework Phase 9 - mirror checklist "MVP cuoi cung" (plan muc
// 20): PLAYER (HP/Attack/Class->Projectile Pierce) + ENEMY (HP/Defense/
// AttackRange/Projectile) + COMBAT (Targeting/Collision/Damage Engine/
// Death) + BOSS (HP/Phase/Enrage) chay chung 1 vong lap THAT qua
// GameManager - khong mock lai BattleSystem, dung dung data skill/
// technique that (Kiem Tu) da ship. Day la bai test "tat ca rap lai
// co chay duoc khong", khong lap lai cac test chi tiet tung co che da
// co o Phase 3-8.
describe('GameManager — MVP loop end-to-end (Combat Rework Phase 9)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Boss stages are always solo (Combat Art Pipeline spec sec7 addendum,
  // 2026-09-05, effectiveTotalEnemyCount()) - totalEnemyCount:2 o stage
  // fixture duoi day CO TINH giu nguyen nhu content-author cu de chung
  // minh guarantee he thong: du data khai 2, mob KHONG BAO GIO spawn,
  // quai DAU TIEN (va DUY NHAT) luon la Boss.
  it('Class thật (Kiếm Tu) đánh xuyên 1 Stage Boss-solo (Phase/Enrage) tới Victory — mob trong enemyPool không bao giờ spawn', () => {
    vi.spyOn(Math, 'random').mockImplementation(mulberry32(MVP_LOOP_SEED))

    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)

    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    // Kiem Tu Reimagined - KIEM_TU_NODES is the live node tree; register
    // it so node purchases in this loop behave like the real game (App.vue
    // registers the same table).
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

    const enrageBuff: BuffDefinition = {
      id: 'mvp_test_enrage',
      name: 'Enrage (test)',
      kind: 'buff',
      instanceScope: 'per_source',
      stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
      lifetime: { clock: 'permanent', scaling: 'fixed' },
      dispellable: false,
    }

    const phaseBuff: BuffDefinition = {
      id: 'mvp_test_phase',
      name: 'Phase (test)',
      kind: 'buff',
      instanceScope: 'per_source',
      stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
      lifetime: { clock: 'permanent', scaling: 'fixed' },
      dispellable: false,
    }

    const mob = defineEnemy({
      id: 'mvp_test_mob',
      name: 'Mob',
      level: 1,
      realmId: 'qi_refining',
      lane: 'ground',
      // attackRange that (khong phai 999999 "vo han" kieu player) - quai
      // voi range vo han nghi da du tam nen KHONG BAO GIO di toi
      // (resolveMovement() chi buoc khi distance>range), mai mai dung
      // ngoai SCREEN_VISIBLE_MAX_X (2026-08-22, xem BattleLane.ts) -
      // gate "khong ban quai offscreen" se khoa cung ca 2 phia.
      statsInput: {
        maxHp: 20,
        might: 0,
        attackSpeed: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
    })

    const boss = defineEnemy({
      id: 'mvp_test_boss',
      name: 'Boss',
      level: 1,
      realmId: 'qi_refining',
      lane: 'ground',
      // attackRange that, cung ly do da ghi o mob phia tren (2026-08-22).
      statsInput: {
        maxHp: 15,
        might: 0,
        attackSpeed: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
      },
      rewards: { techniqueMastery: 0, spiritStone: 0 },
      isBoss: true,
      // createBossVariant() nhan maxHp x7 -> 105 HP that khi vao tran.
      tribulationPhases: [
        { hpThresholdPercent: 0.5, buff: phaseBuff, archetypeOverride: 'ranged' },
      ],
      enrage: { afterSeconds: 1, buff: enrageBuff },
    })

    gameManager.catalogOps.registerEnemyTemplates([mob, boss])

    const stage: Stage = {
      id: 'mvp_test_stage',
      name: 'MVP Test Stage',
      description: '',
      floor: 10,
      enemyPool: [{ enemyId: 'mvp_test_mob', weight: 1 }],
      totalEnemyCount: 2, waves: [2],
      spawnIntervalSeconds: 0.1,
      bossEnemyId: 'mvp_test_boss',
    }

    gameManager.catalogOps.registerStages([stage])

    const player = createDefaultPlayer()

    // Class - Kiem Tu THAT theo route-lock moi (spec 2026-08-29
    // kiem-the-kiem-y): tram chua Lv3 -> route Kiem Tran, slot 0 = Luong
    // Nghi Kiem Tran (2 kiem) - dung 1 active skill duy nhat cua route,
    // thay bo 3 skill kit cu.
    player.realmLevel = 12
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)).toBe(true)

    // Spawn telegraph (2026-08-24): quai materialize tre hon (0.75-1.4s)
    // khien tran dai them ~2-3s, realm pressure tich luy them - cong
    // buffer HP nho de bai test giu dung muc dich "vong lap day du toi
    // Victory" thay vi dua tren bien HP mong cua seed.
    player.baseStats.maxHp += 40

    // stat-system-reimagined Task 3 (D16/D17): the attackRange stat and
    // the realtime kiting fixture bump retired - the ATB engine targets
    // by rank/lane, not spatial range.

    expect(gameManager.turnBattleOps.startStage(player, stage)).toBe(true)

    let sawBossSpawn = false
    let sawMobSpawn = false

    // Slice 6 cutover: unified flow (Countdown -> Spawn -> Gauge -> Wave ->
    // Result). Boss Phase (archetype override) + Enrage theo giay la co
    // che real-time KHONG migrate (Deep Review sec2 - boss chi la quai +
    // buff, se thiet ke lai bang BossTurnTriggers khi content that toi) -
    // chi giu assertions core: spawn qua wave + victory + loop terminate.
    for (let i = 0; i < 4000 && isBattleInProgress(gameManager.getTurnBattle()?.state); i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)

      const battle = gameManager.getTurnBattle()

      const bossEntry = battle?.enemies.find((enemy) =>
        enemy.entity.id.startsWith('mvp_test_boss_'),
      )

      if (bossEntry) {
        sawBossSpawn = true
      }

      if (battle?.enemies.some((enemy) => enemy.entity.id.startsWith('mvp_test_mob_'))) {
        sawMobSpawn = true
      }
    }

    // COMBAT + PLAYER + ENEMY: tran phai THANG that (khong phai het tick
    // ma van 'fighting' - nghia la Damage Engine/Targeting/Wave spawn/
    // Death cua TOAN BO vong lap turn-based hoat dong dung).
    expect(gameManager.getTurnBattle()!.state).toBe('victory')

    // BOSS: quai Boss that da spawn (wave spawn floor-10 boss-final hoat
    // dong trong turn-based flow).
    expect(sawBossSpawn).toBe(true)

    // Boss stages are always solo - mob cua enemyPool KHONG BAO GIO duoc
    // roll du stage.totalEnemyCount (data tho) khai 2, vi
    // effectiveTotalEnemyCount() ep quai DAU TIEN da la luot spawn CUOI.
    expect(sawMobSpawn).toBe(false)
  })
})
