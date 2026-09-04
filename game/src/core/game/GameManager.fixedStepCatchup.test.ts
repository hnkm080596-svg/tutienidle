import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Uncommitted audit followup plan, mục "Fixed-step/catch-up cho combat"
// (2026-08-24) — App.vue đo deltaSeconds THẬT bằng GameClock; khi tab bị
// trình duyệt throttle (nền/minimize/máy vừa resume), một lần gọi
// gameManager.update() có thể nhận đúng TỔNG THỜI GIAN đó dồn vào MỘT
// deltaSeconds lớn thay vì nhiều deltaSeconds nhỏ như lúc chạy nền trước
// (foreground). Trước khi sửa, các timer đếm-ngược-rồi-reset (cadence/
// attackTimer/spawnCountdown) chỉ kiểm
// tra <= 0 MỘT LẦN mỗi lời gọi rồi reset thẳng về mốc mới — một
// deltaSeconds lớn chỉ tạo ra ĐÚNG 1 đòn đánh dù đáng lẽ phải đủ N đòn
// theo đúng nhịp thời gian thực đã trôi qua. Test này khoá lại bất biến
// "cùng tổng thời gian mô phỏng phải cho cùng kết quả, bất kể delta được
// chia nhỏ hay dồn lớn" — nó FAIL trên code trước khi sửa
// (GameManager.updateBattleFixedStep()).
const ATTACKER_STATS_INPUT = {
  maxHp: 500,
  attack: 50,
  attackSpeed: 2, // interval = 1 / attackSpeed = 0.5s
  attackRangeRanks: 9,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createAttackerPlayer(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 50, speed: 2, criticalRate: 0 }

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

// Scheduler thống nhất (plan §8.4) — mọi đòn của player là skill
// auto-cast; skill fixture 'attack_speed' chiếm slot 0 (nhịp theo Attack
// Speed), xem cùng fixture ở BattleSystem.attackRangeVisibility.test.ts.
function createBasicSkill(): Skill {
  return {
    id: 'basic_test',
    name: 'Basic (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    remainingCooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    resourceType: 'none',
    unlocked: true,
    equipped: true,
    loadoutSlot: 0,
    loadoutSlots: [0],
  }
}

function createStubbornEnemy() {
  return defineEnemy({
    id: 'stubborn_dummy',
    name: 'Bao Cát',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    // HP + armor rất cao — không bao giờ chết trong lúc test, đòn địch
    // đánh lại player cũng không đáng kể (attack=0) để player.alive luôn
    // true suốt bài test, không ảnh hưởng số đòn đếm được.
    statsInput: { ...ATTACKER_STATS_INPUT, maxHp: 10_000_000, attack: 0, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

describe('GameManager — fixed-step catch-up cho combat (uncommitted audit followup plan)', () => {
  function runScenario(totalSeconds: number, stepSeconds: number | null): number {
    const gameManager = new GameManager()
    const player = createAttackerPlayer()

    gameManager.registerSkillTemplates([createBasicSkill()])
    gameManager.learnSkill('basic_test')
    gameManager.skillSystem.equipToSlot('basic_test', 0)

    gameManager.startBattle(player, createStubbornEnemy())

    // Bỏ qua countdown 3s trước trận (BattleSystem.start()) — chưa cần
    // đếm đòn đánh ở giai đoạn này.
    gameManager.update(3)

    // Materialize gán vị trí từ resolver — đặt quái trong tầm teleport
    // (col 2: sau khi đổi row về hàng quái, Chebyshev = 1) để player
    // đánh được ngay khi 'fighting' bắt đầu.
    gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2

    let attackCount = 0

    gameManager.eventBus.on<{ sourceId?: string }>('attack', event => {
      if (event.sourceId === player.id) {
        attackCount++
      }
    })

    if (stepSeconds === null) {
      // Kịch bản "tab bị throttle": TOÀN BỘ thời gian dồn vào 1 lần
      // gọi update() duy nhất, mô phỏng App.vue's tick() nhận 1
      // deltaSeconds lớn từ GameClock sau khi callback bị hoãn.
      gameManager.update(totalSeconds)
    } else {
      // Kịch bản foreground bình thường: nhiều deltaSeconds nhỏ cộng
      // dồn đúng bằng totalSeconds.
      const steps = Math.round(totalSeconds / stepSeconds)

      for (let i = 0; i < steps; i++) {
        gameManager.update(stepSeconds)
      }
    }

    return attackCount
  }

  it('tổng số đòn đánh giống nhau dù chia nhiều delta nhỏ (0.1s/lần) hay dồn 1 delta lớn (throttle tab)', () => {
    const totalSeconds = 20

    const manySmallDeltas = runScenario(totalSeconds, 0.1)
    const oneBigDelta = runScenario(totalSeconds, null)

    expect(oneBigDelta).toBe(manySmallDeltas)
    // Sanity: với attackSpeed=2 (interval 0.5s) trong 20s phải có nhiều
    // hơn 1 đòn — chặn regression về hành vi cũ (chỉ đánh đúng 1 lần
    // rồi vứt hết phần nợ timer).
    expect(oneBigDelta).toBeGreaterThan(10)
  })

  it('delta dồn vượt trần catch-up (BATTLE_MAX_CATCHUP_SECONDS) vẫn không khoá UI — chạy xong tức thời, không throw', () => {
    const gameManager = new GameManager()
    const player = createAttackerPlayer()

    gameManager.startBattle(player, createStubbornEnemy())
    gameManager.update(3)
    gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2

    // Giả lập máy ngủ nhiều giờ rồi resume — deltaSeconds cực lớn.
    expect(() => gameManager.update(6 * 60 * 60)).not.toThrow()
    expect(gameManager.getTurnBattle()!.enemies[0]!.entity.alive).toBe(true)
  })
})
