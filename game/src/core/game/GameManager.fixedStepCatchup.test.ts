import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'

// Originally (2026-08-24) this locked the fixed-step catch-up the WORLD tick
// performed for combat: one lumped deltaSeconds had to produce the same number
// of pacing steps as many small ones.
//
// Combat has since left the world tick (2026-09-10 combat-turn-mechanism
// spec). The chunking invariant survives, but it belongs to CombatClock now:
// the same total time through the clock's source must produce the same battle,
// whether the source delivers it in one frame or two hundred. What does NOT
// survive is the combat catch-up CEILING (the old BATTLE_MAX_CATCHUP_SECONDS)
// - the spec forbids catch-up in combat outright, and the world tick can no
// longer reach the battle at all, which the second test pins.
const ATTACKER_STATS_INPUT = {
  maxHp: 500,
  might: 50,
  attackSpeed: 2, // interval = 1 / attackSpeed = 0.5s
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createAttackerPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 50, speed: 2, criticalRate: 0 })

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
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
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
    // đánh lại player cũng không đáng kể (might=0) để player.alive luôn
    // true suốt bài test, không ảnh hưởng số đòn đếm được.
    statsInput: { ...ATTACKER_STATS_INPUT, maxHp: 10_000_000, might: 0, armor: 0 },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

describe('CombatClock — chunking invariant + no world-tick catch-up for combat', () => {
  function runScenario(totalSeconds: number, stepSeconds: number | null): number {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createAttackerPlayer()

    gameManager.catalogOps.registerSkillTemplates([createBasicSkill()])
    gameManager.progressionOps.learnSkill('basic_test')
    gameManager.skillSystem.equipToSlot('basic_test', 0)

    gameManager.startBattle(player, createStubbornEnemy())

    // Slice 6 cutover: countdown là phase của TurnBattle (30 pacing ticks
    // = 3s hệ sống) — chạy hết countdown trước khi đếm turn.
    for (let i = 0; i < 30; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    // Materialize gán vị trí từ resolver — đặt quái trong tầm teleport
    // (col 2: sau khi đổi row về hàng quái, Chebyshev = 1) để player
    // đánh được ngay khi 'fighting' bắt đầu.
    gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2

    // Slice 6 cutover: 'attack' event là cơ chế real-time (BattleSystem cũ
    // emit) — turn-based đếm TỔNG TURNS đã resolve qua totalTurnsElapsed.
    // Invariant đang bảo vệ giữ nguyên: cùng tổng thời gian → cùng số
    // bước, bất kể chia nhỏ hay dồn 1 delta lớn (fixed-step loop).
    const _attackCount = 0

    if (stepSeconds === null) {
      // One long frame from the clock source (a stalled renderer catching up
      // in a single callback).
      combatSource.advance(totalSeconds)
    } else {
      // The ordinary case: many small frames summing to totalSeconds.
      const steps = Math.round(totalSeconds / stepSeconds)

      for (let i = 0; i < steps; i++) {
        combatSource.advance(stepSeconds)
      }
    }

    return gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0
  }

  it('cùng tổng thời gian trên CombatClock cho cùng số lượt, dù chia nhỏ hay dồn 1 frame lớn', () => {
    const totalSeconds = 20

    const manySmallDeltas = runScenario(totalSeconds, 0.1)
    const oneBigDelta = runScenario(totalSeconds, null)

    expect(oneBigDelta).toBe(manySmallDeltas)
    // Sanity: với attackSpeed=2 (interval 0.5s) trong 20s phải có nhiều
    // hơn 1 đòn — chặn regression về hành vi cũ (chỉ đánh đúng 1 lần
    // rồi vứt hết phần nợ timer).
    expect(oneBigDelta).toBeGreaterThan(10)
  })

  it('một delta world khổng lồ KHÔNG còn chạm tới combat — không catch-up, không trần, không dồn nợ', () => {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createAttackerPlayer()

    gameManager.startBattle(player, createStubbornEnemy())
    combatSource.advance(3)
    gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2

    const turnsBefore = gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0

    // Máy ngủ nhiều giờ rồi resume: GameClock trả về deltaSeconds cực lớn.
    // Cultivation/production/auto-farm vẫn nhận nó; combat thì không.
    expect(() => gameManager.tickOps.update(6 * 60 * 60)).not.toThrow()

    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(turnsBefore)
    expect(gameManager.getTurnBattle()!.enemies[0]!.entity.alive).toBe(true)
  })
})
