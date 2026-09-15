// ARCH-014 (M12) — battle_end terminal contract.
//
// Before M12: the victory/defeat terminal in GameManagerBattleRewardOps
// set battleEndEmitted for BOTH outcomes but only emitted 'battle_end'
// for victory; abandonBattle emitted 'defeat' itself, outside the guard.
// Consequence: natural defeat never reached battleDefeat audio,
// CombatScene.onBattleEnd or the PhaserCanvas snapshot-cache clears.
//
// These tests drive REAL stage battles on ManualClockSource and assert:
//   victory        -> exactly one { state: 'victory' } -> 'battleVictory'
//   natural defeat -> exactly one { state: 'defeat' }  -> 'battleDefeat'
//   abandon        -> exactly one { state: 'defeat' }  -> 'battleDefeat'
//                     (and a repeated abandon is a no-op)
//   auto-repeat    -> one publication PER cycle (two victories = 2 events)
// bindCombatAudio is the real presentation consumer wired on the same bus.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '@/core/battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import type { Stage } from '../stage/Stage'
import { bindCombatAudio } from '@/presentation/audio/combatAudioBinding'
import { AudioManager, resetAudioManagerForTest } from '@/core/audio/AudioManager'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'

interface BattleEndEvent {
  type: 'battle_end'
  state: 'victory' | 'defeat'
}

const FRAGILE_ENEMY = {
  maxHp: 500,
  might: 0,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

const LETHAL_ENEMY = {
  maxHp: 10_000_000,
  might: 5_000,
  attackSpeed: 1,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function stageFixture(id: string, enemyId: string): Stage {
  return {
    id,
    name: id,
    description: '',
    floor: 1,
    enemyPool: [{ enemyId, weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
}

function dummyEnemy(id: string, statsInput: typeof FRAGILE_ENEMY) {
  return defineEnemy({
    id,
    name: id,
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: { ...statsInput },
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  })
}

function strongPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.baseStats = asBaseStats({ ...player.baseStats, might: 1_000, speed: 100 })

  return player
}

function fragilePlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.baseStats = asBaseStats({ ...player.baseStats, might: 0, maxHp: 50, speed: 10 })

  return player
}

/** Direct startBattle() input — the dev-spawn/tribulation entry point. */
function playerEntity(overrides: { might?: number; maxHp?: number; speed?: number } = {}): CombatEntity {
  const stats = createBaseStats({
    might: overrides.might ?? 1_000,
    speed: overrides.speed ?? 100,
    criticalRate: 0,
    ...(overrides.maxHp !== undefined ? { maxHp: overrides.maxHp } : {}),
  })

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
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 4,
    alive: true,
  }
}

let playSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  resetAudioManagerForTest()
  playSpy = vi.spyOn(AudioManager.getInstance(), 'play').mockImplementation(() => {})
})

afterEach(() => {
  playSpy.mockRestore()
  resetAudioManagerForTest()
})

/** Count only terminal-sound calls — turns also emit attack/hit/death SFX. */
function soundCalls(soundId: 'battleVictory' | 'battleDefeat' | 'battleStart'): number {
  return playSpy.mock.calls.filter((call: unknown[]) => call[0] === soundId).length
}

function makeManager(): {
  gameManager: GameManager
  combatSource: ManualClockSource
  battleEnds: BattleEndEvent[]
} {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)

  const battleEnds: BattleEndEvent[] = []
  gameManager.eventBus.on<BattleEndEvent>('battle_end', (event) => battleEnds.push(event))

  // Real presentation consumer on the same bus (ARCH-014 lists the audio
  // binding as one of the three starved consumers).
  bindCombatAudio(gameManager.eventBus)

  return { gameManager, combatSource, battleEnds }
}

function runUntil(
  combatSource: ManualClockSource,
  predicate: () => boolean,
  maxSteps = 4_000,
): void {
  for (let i = 0; i < maxSteps && !predicate(); i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }
}

describe('ARCH-014 (M12) — battle_end terminal publication, exactly once per outcome', () => {
  it('natural victory publishes exactly one battle_end victory; the audio consumer hears it once', () => {
    const { gameManager, combatSource, battleEnds } = makeManager()
    const player = strongPlayer()
    const enemy = dummyEnemy('end_dummy_v', FRAGILE_ENEMY)
    const stage = stageFixture('end_stage_victory', 'end_dummy_v')

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)

    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)

    runUntil(combatSource, () => gameManager.getTurnBattle()?.state === 'victory')

    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(battleEnds).toEqual([{ type: 'battle_end', state: 'victory' }])
    expect(soundCalls('battleVictory')).toBe(1)
    expect(soundCalls('battleDefeat')).toBe(0)

    // Terminal is closed: further steps never re-emit (clock stopped).
    for (let i = 0; i < 50; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    expect(battleEnds).toHaveLength(1)
    expect(soundCalls('battleVictory')).toBe(1)
  })

  it('natural defeat publishes exactly one battle_end defeat — the path that was silent before M12', () => {
    const { gameManager, combatSource, battleEnds } = makeManager()
    const player = fragilePlayer()
    const enemy = dummyEnemy('end_dummy_d', LETHAL_ENEMY)
    const stage = stageFixture('end_stage_defeat', 'end_dummy_d')

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)

    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)

    runUntil(combatSource, () => gameManager.getTurnBattle()?.state === 'defeat')

    expect(gameManager.getTurnBattle()?.state).toBe('defeat')
    expect(battleEnds).toEqual([{ type: 'battle_end', state: 'defeat' }])
    expect(soundCalls('battleDefeat')).toBe(1)
    expect(soundCalls('battleVictory')).toBe(0)
  })

  it('explicit abandon publishes exactly one battle_end defeat through the shared guard; a repeated abandon is a no-op', () => {
    const { gameManager, combatSource, battleEnds } = makeManager()
    const player = strongPlayer()
    const enemy = dummyEnemy('end_dummy_a', LETHAL_ENEMY)
    const stage = stageFixture('end_stage_abandon', 'end_dummy_a')

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)

    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)

    runUntil(combatSource, () => gameManager.getTurnBattle()?.state === 'fighting')
    expect(gameManager.getTurnBattle()?.state).toBe('fighting')

    expect(gameManager.abandonBattle()).toBe(true)
    expect(battleEnds).toEqual([{ type: 'battle_end', state: 'defeat' }])
    expect(soundCalls('battleDefeat')).toBe(1)

    // Second abandon: battle already terminal -> refused, no second event.
    expect(gameManager.abandonBattle()).toBe(false)
    expect(battleEnds).toHaveLength(1)
    expect(soundCalls('battleDefeat')).toBe(1)
  })

  it('auto-repeat emits battle_end exactly once PER CYCLE — two victories produce two events, not zero and not more', () => {
    const { gameManager, combatSource, battleEnds } = makeManager()
    const player = strongPlayer()
    const enemy = dummyEnemy('end_dummy_r', FRAGILE_ENEMY)
    const stage = stageFixture('end_stage_repeat', 'end_dummy_r')

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)

    expect(gameManager.turnBattleOps.startStage(player, stage, true)).toBe(true)

    runUntil(combatSource, () => battleEnds.length >= 2)

    expect(battleEnds).toEqual([
      { type: 'battle_end', state: 'victory' },
      { type: 'battle_end', state: 'victory' },
    ])
    expect(soundCalls('battleVictory')).toBe(2)
    expect(soundCalls('battleDefeat')).toBe(0)

    // Cleanup: abandon the running third cycle ends it once.
    expect(gameManager.abandonBattle()).toBe(true)
    expect(battleEnds).toHaveLength(3)
    expect(battleEnds[2]).toEqual({ type: 'battle_end', state: 'defeat' })
  })

  it('non-stage battle started after a terminal still publishes battle_end (once-guard reset on startBattle)', () => {
    const { gameManager, combatSource, battleEnds } = makeManager()
    const player = strongPlayer()
    const enemy = dummyEnemy('end_dummy_n', FRAGILE_ENEMY)
    const stage = stageFixture('end_stage_then_dev', 'end_dummy_n')

    gameManager.catalogOps.registerEnemyTemplates([enemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)

    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)

    runUntil(combatSource, () => gameManager.getTurnBattle()?.state === 'victory')
    expect(battleEnds).toEqual([{ type: 'battle_end', state: 'victory' }])

    // Non-stage entry — startBattleWithPlayer is the stageWaves launchBattle
    // callback AND the devtools/tribulation path; it routes through
    // startBattle(). Before the review-round fix this battle inherited
    // battleEndEmitted=true, so its terminal never published.
    gameManager.startBattleWithPlayer(player, enemy)

    runUntil(combatSource, () => gameManager.getTurnBattle()?.state === 'victory')

    expect(gameManager.getTurnBattle()?.state).toBe('victory')
    expect(battleEnds).toEqual([
      { type: 'battle_end', state: 'victory' },
      { type: 'battle_end', state: 'victory' },
    ])
    expect(soundCalls('battleVictory')).toBe(2)
  })

  it('abandon on a direct startBattle() (dev spawn seam) after a terminal still publishes defeat — guard was reset', () => {
    const { gameManager, combatSource, battleEnds } = makeManager()
    const player = strongPlayer()
    const stageEnemy = dummyEnemy('end_dummy_x', FRAGILE_ENEMY)
    const devEnemy = dummyEnemy('end_dummy_dev', LETHAL_ENEMY)
    const stage = stageFixture('end_stage_then_abandon', 'end_dummy_x')

    gameManager.catalogOps.registerEnemyTemplates([stageEnemy])
    gameManager.catalogOps.registerStages([stage])
    gameManager.setActivePlayer(player)

    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)

    runUntil(combatSource, () => gameManager.getTurnBattle()?.state === 'victory')
    expect(battleEnds).toEqual([{ type: 'battle_end', state: 'victory' }])

    // Direct CombatEntity entry — the enemySpawnDebug path. Pre-fix the
    // stale flag made emitAbandonEnd a silent no-op here (regression vs the
    // pre-M12 unconditional abandon emit).
    gameManager.startBattle(playerEntity(), devEnemy)

    runUntil(combatSource, () => gameManager.getTurnBattle()?.state === 'fighting')

    expect(gameManager.abandonBattle()).toBe(true)
    expect(battleEnds).toEqual([
      { type: 'battle_end', state: 'victory' },
      { type: 'battle_end', state: 'defeat' },
    ])
    expect(soundCalls('battleDefeat')).toBe(1)
  })
})
