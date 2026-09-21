import { describe, expect, it } from 'vitest'
import { runBattle, runBattles } from './BattleSimulation'
import type { BattleSimulationInput, SimBuildSnapshot } from './BattleSimulation'
import { createDefaultPlayer } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
import type { PlayerData } from '../player/Player'

// P4-M1 - deterministic combat simulation harness. Every assertion runs
// through the REAL canonical chain: fresh GameManager + manual clock +
// seeded RNG + real build composition, never a stubbed engine.

const WEAK_ENEMY = defineEnemy({
  id: 'sim_weak_mob', name: 'Weak Mob', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueMastery: 0, spiritStone: 0 },
})

const STRONG_ENEMY = defineEnemy({
  id: 'sim_boss', name: 'Sim Boss', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: {
    maxHp: 1_000_000, might: 9_999, attackSpeed: 1,
    criticalRate: 0, criticalDamage: 1.5, armor: 0, evasionRate: 0,
  },
  rewards: { techniqueMastery: 0, spiritStone: 0 },
})

const MULTI_STAGE: Stage = {
  id: 'sim_multi_stage', name: 'Sim Multi Stage', description: '',
  floor: 1,
  enemyPool: [{ enemyId: WEAK_ENEMY.id, weight: 1 }],
  totalEnemyCount: 2, waves: [2],
  spawnIntervalSeconds: 0,
}

function strongPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'sword'
  return player
}

function weakPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.baseStats.maxHp = 5
  player.baseStats.might = 0
  player.baseStats.speed = 1
  player.baseStats.criticalRate = 0
  return player
}

function build(player: PlayerData): SimBuildSnapshot {
  return { player, skills: [], techniques: [] }
}

function preRitualPlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 }
  return player
}

describe('runBattle', () => {
  it('a strong build beats a weak enemy to victory', () => {
    const result = runBattle({
      seed: 1,
      build: build(strongPlayer()),
      encounter: { kind: 'enemy', enemy: WEAK_ENEMY },
    })
    expect(result.outcome).toBe('victory')
    expect(result.steps).toBeGreaterThan(0)
    expect(result.fightingSteps).toBeGreaterThan(0)
    expect(result.fightingSteps).toBeLessThanOrEqual(result.steps)
    expect(result.durationSeconds).toBeCloseTo(result.steps * 0.1, 5)
    expect(result.combatDurationSeconds).toBeCloseTo(result.fightingSteps * 0.1, 5)
    expect(result.fingerprint).toMatch(/^[0-9a-f]+$/)
  })

  it('a weak build falls to a strong enemy', () => {
    const result = runBattle({
      seed: 1,
      build: build(weakPlayer()),
      encounter: { kind: 'enemy', enemy: STRONG_ENEMY },
    })
    expect(result.outcome).toBe('defeat')
  })

  it('respects maxSteps and reports timeout', () => {
    const result = runBattle({
      seed: 1,
      build: build(weakPlayer()),
      encounter: { kind: 'enemy', enemy: WEAK_ENEMY },
      maxSteps: 5,
    })
    // Weak player cannot kill the 1hp mob inside 5 consumed steps once
    // intro+countdown eat the budget.
    expect(result.outcome).toBe('timeout')
    expect(result.steps).toBeLessThanOrEqual(5)
  })

  it('maxSteps is a hard cap under coarse advance chunks', () => {
    // advanceChunkSeconds 0.25 feeds ~2.5 steps per call - without the
    // remaining-budget clamp the cap is checked pre-advance and the run
    // overshoots. The stage battle cannot terminate inside 8 steps
    // (intro+countdown alone exceed the cap), so steps lands exactly on it.
    const result = runBattle({
      seed: 20260922,
      build: build(preRitualPlayer()),
      ritual: { pathId: 'spell', wayId: 'hidden_spell_pathway' },
      encounter: { kind: 'stage', stageId: 'mortal_dong_1' },
      maxSteps: 8,
      advanceChunkSeconds: 0.25,
    })
    expect(result.outcome).toBe('timeout')
    expect(result.steps).toBe(8)
  })

  it('runs the real ritual when the path/way pair is provided', () => {
    const result = runBattle({
      seed: 20260922,
      build: build(preRitualPlayer()),
      ritual: { pathId: 'spell', wayId: 'hidden_spell_pathway' },
      encounter: { kind: 'enemy', enemy: WEAK_ENEMY },
    })
    expect(result.outcome).toBe('victory')
  })

  it('rejects a ritual on an already post-ritual player', () => {
    expect(() =>
      runBattle({
        seed: 1,
        build: build(strongPlayer()),
        ritual: { pathId: 'sword', wayId: 'sword_pathway' },
        encounter: { kind: 'enemy', enemy: WEAK_ENEMY },
      }),
    ).toThrow()
  })

  it('supports an in-memory multi-enemy stage via customStage', () => {
    const result = runBattle({
      seed: 1,
      build: build(strongPlayer()),
      encounter: { kind: 'customStage', stage: MULTI_STAGE, enemies: [WEAK_ENEMY] },
    })
    expect(result.outcome).toBe('victory')
  })

  it('does not mutate the caller snapshot', () => {
    const player = strongPlayer()
    const skills = build(player).skills
    const techniques = build(player).techniques
    const snapshot: SimBuildSnapshot = { player, skills, techniques }
    const frozenPlayer = structuredClone(player)
    runBattle({ seed: 1, build: snapshot, encounter: { kind: 'enemy', enemy: WEAK_ENEMY } })
    expect(player).toEqual(frozenPlayer)
    expect(skills).toEqual([])
    expect(techniques).toEqual([])
  })

  it('strips persistentTimedEffects and reports the count', () => {
    const player = strongPlayer()
    const effect: PersistentTimedEffect = {
      id: 'fx_test',
      sourceItemId: 'pill_test',
      appliedAtMs: 0,
      expiresAtMs: Date.now() + 60_000,
      modifiers: [],
    }
    player.persistentTimedEffects = [effect]
    const result = runBattle({
      seed: 1,
      build: build(player),
      encounter: { kind: 'enemy', enemy: WEAK_ENEMY },
    })
    expect(result.diagnostics.timedEffectsStripped).toBe(1)
    expect(player.persistentTimedEffects).toHaveLength(1) // caller untouched
  })
})

describe('runBattles', () => {
  it('runs a batch with per-run isolation', () => {
    const inputs: BattleSimulationInput[] = [
      { seed: 7, build: build(strongPlayer()), encounter: { kind: 'enemy', enemy: WEAK_ENEMY } },
      { seed: 7, build: build(weakPlayer()), encounter: { kind: 'enemy', enemy: STRONG_ENEMY } },
      { seed: 7, build: build(strongPlayer()), encounter: { kind: 'enemy', enemy: WEAK_ENEMY } },
    ]
    const results = runBattles(inputs)
    expect(results.map((r) => r.outcome)).toEqual(['victory', 'defeat', 'victory'])
    // Runs 1 and 3 are identical inputs - identical fingerprints proves
    // no cross-run state bleed.
    expect(results[0]!.fingerprint).toBe(results[2]!.fingerprint)
  })
})
