import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from './CombatClock'
import { GameManager } from '../../game/GameManager'
import { createDefaultPlayer } from '../../player/Player'
import { SeededCombatRng } from '../runtime/rng/SeededCombatRng'
import { defineEnemy } from '../../enemy/Enemy'
import type { Stage } from '../../stage/Stage'

// Combat-contract M4 — the composition-root RNG reroute contract.
//
// mintCycleRng mints ONE CombatRng per battle cycle and every consumer
// (stage enemy picks, spawn placement, dynamic-basic providers, engine
// rolls, combat formulas) reads that single typed stream. This test pins
// the ONE-stream property end-to-end through GameManager: a seeded
// CombatRng injected via setBattleRngFactory must reproduce a full
// battle byte-for-byte — any consumer that kept a parallel
// `() => number` mint or skipped/duplicated a roll would desync the
// stream and diverge the run.
//
// The enemy is effectively immortal so no kill ever reaches the loot
// rolls (economy randomness deliberately stays on Math.random, outside
// the session boundary — spec C3).

const RNG_TANK = defineEnemy({
  id: 'rngc_tank',
  name: 'RNG Tank',
  level: 1,
  realmId: 'mortal',
  lane: 'ground',
  statsInput: {
    maxHp: 1_000_000_000,
    might: 5,
    attackSpeed: 1,
    criticalRate: 0.5,
    criticalDamage: 1.5,
    armor: 0,
    evasionRate: 0.4,
  },
  rewards: { techniqueInsight: 0, spiritStone: 0 },
})

const RNG_SCOUT = defineEnemy({
  id: 'rngc_scout',
  name: 'RNG Scout',
  level: 1,
  realmId: 'mortal',
  lane: 'ground',
  statsInput: {
    maxHp: 1_000_000_000,
    might: 3,
    attackSpeed: 1,
    criticalRate: 0.2,
    criticalDamage: 1.5,
    armor: 0,
    evasionRate: 0.1,
  },
  rewards: { techniqueInsight: 0, spiritStone: 0 },
})

// A mixed pool + eliteChance so pool picks, elite rolls AND spawn
// placement all consume the stream before the first turn resolves.
const RNG_STAGE: Stage = {
  id: 'rngc_stage',
  name: 'RNG Contract Stage',
  description: '',
  floor: 1,
  enemyPool: [
    { enemyId: RNG_TANK.id, weight: 3, eliteChance: 0.5 },
    { enemyId: RNG_SCOUT.id, weight: 1 },
  ],
  totalEnemyCount: 4,
  waves: [2, 2],
  spawnIntervalSeconds: 0,
}

function runSeededBattle(seed: number) {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createDefaultPlayer()
  gameManager.setActivePlayer(player)

  // The M4 seam: the factory mints a CombatRng per cycle.
  gameManager.setBattleRngFactory(() => new SeededCombatRng(seed))
  player.baseStats = {
    ...player.baseStats,
    might: 200,
    criticalRate: 0.5,
  } as typeof player.baseStats

  gameManager.catalogOps.registerEnemyTemplates([RNG_TANK, RNG_SCOUT])
  gameManager.catalogOps.registerStages([RNG_STAGE])

  expect(gameManager.turnBattleOps.startStage(player, RNG_STAGE)).toBe(true)

  const log: unknown[] = []
  for (let i = 0; i < 300; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
    const battle = gameManager.getTurnBattle()
    log.push({
      state: battle?.state,
      turns: battle?.totalTurnsElapsed ?? 0,
      playerHp: battle?.players[0]?.entity.currentHp,
      enemies: battle?.enemies.map((enemy) => ({
        // Entity ids embed a crypto UUID — identity minting is outside
        // the session-RNG contract; compare the template prefix only.
        id: enemy.entity.id.replace(/_[0-9a-f-]+$/, ''),
        x: enemy.entity.x,
        row: enemy.entity.row,
        hp: enemy.entity.currentHp,
        alive: enemy.entity.alive,
      })),
    })
  }

  return log
}

describe('CombatRng composition-root contract (M4)', () => {
  it('two battles on the same SeededCombatRng produce identical outcomes', () => {
    const run1 = runSeededBattle(42)
    const run2 = runSeededBattle(42)

    expect(run1).toEqual(run2)
    // The log must contain real combat (turns resolved, damage dealt) —
    // an empty battle would trivialize the parity check.
    expect(run1.some((entry) => (entry as { turns?: number }).turns! > 0)).toBe(true)
  })

  it('a different seed produces a different battle (the stream is really consumed)', () => {
    const run1 = runSeededBattle(42)
    const run2 = runSeededBattle(1337)

    expect(run1).not.toEqual(run2)
  })
})
