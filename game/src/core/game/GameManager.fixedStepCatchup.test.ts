import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import { createDefaultPlayer } from '../player/Player'
import { toTurnSkillDefinition } from '../skilldef/LegacySkillAdapter'

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

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  }
}

// Scheduler thong nhat (plan sec8.4) - moi don cua player la skill
// auto-cast; skill fixture 'attack_speed' chiem slot 0 (nhip theo Attack
// Speed), xem cung fixture o BattleSystem.attackRangeVisibility.test.ts.
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
  }
}

function createStubbornEnemy() {
  return defineEnemy({
    id: 'stubborn_dummy',
    name: 'Bao Cát',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    // HP + armor rat cao - khong bao gio chet trong luc test, don dich
    // danh lai player cung khong dang ke (might=0) de player.alive luon
    // true suot bai test, khong anh huong so don dem duoc.
    statsInput: { ...ATTACKER_STATS_INPUT, maxHp: 10_000_000, might: 0, armor: 0 },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

describe('CombatClock — chunking invariant + no world-tick catch-up for combat', () => {
  function runScenario(totalSeconds: number, stepSeconds: number | null): number {
    const gameManager = new GameManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    const player = createAttackerPlayer()

    gameManager.catalogOps.registerSkillTemplates([createBasicSkill()])
    gameManager.catalogOps.registerProgressionNodes([{
      id: 'core_basic_test',
      name: 'Core: Basic',
      type: 'minor',
      insightCost: 0,
      maxLevel: 10,
      levelsSkillId: 'basic_test',
      effect: {},
    }])
    gameManager.progressionOps.learnSkill('basic_test', createDefaultPlayer())
    const basicSkill = gameManager.skillManager.get('basic_test')!
  gameManager.setPathRuntimeResolver(() => ({
    resolveBasic: () =>
      toTurnSkillDefinition(basicSkill, gameManager.skillSystem.getEffectiveSkill(basicSkill)),
    resolveSpecialUltimate: () => undefined,
    resolveMaxThe: () => 0,
    resolveStatDomains: () => undefined,
  }))

    gameManager.startBattle(player, createStubbornEnemy())

    // Slice 6 cutover: countdown la phase cua TurnBattle (30 pacing ticks
    // = 3s he song) - chay het countdown truoc khi dem turn.
    for (let i = 0; i < 30; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    // Materialize gan vi tri tu resolver - dat quai trong tam teleport
    // (col 2: sau khi doi row ve hang quai, Chebyshev = 1) de player
    // danh duoc ngay khi 'fighting' bat dau.
    gameManager.getTurnBattle()!.enemies[0]!.entity.x = 2

    // Slice 6 cutover: 'attack' event la co che real-time (BattleSystem cu
    // emit) - turn-based dem TONG TURNS da resolve qua totalTurnsElapsed.
    // Invariant dang bao ve giu nguyen: cung tong thoi gian -> cung so
    // buoc, bat ke chia nho hay don 1 delta lon (fixed-step loop).
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
    // Sanity: voi attackSpeed=2 (interval 0.5s) trong 20s phai co nhieu
    // hon 1 don - chan regression ve hanh vi cu (chi danh dung 1 lan
    // roi vut het phan no timer).
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

    // May ngu nhieu gio roi resume: GameClock tra ve deltaSeconds cuc lon.
    // Cultivation/production/auto-farm van nhan no; combat thi khong.
    expect(() => gameManager.tickOps.update(6 * 60 * 60)).not.toThrow()

    expect(gameManager.getTurnBattle()?.totalTurnsElapsed ?? 0).toBe(turnsBefore)
    expect(gameManager.getTurnBattle()!.enemies[0]!.entity.alive).toBe(true)
  })
})
