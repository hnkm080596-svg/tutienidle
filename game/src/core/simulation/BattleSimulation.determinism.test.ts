import { describe, expect, it } from 'vitest'
import { runBattle, runBattles } from './BattleSimulation'
import type { SimBuildSnapshot } from './BattleSimulation'
import { createDefaultPlayer } from '../player/Player'
import type { PlayerData } from '../player/Player'
import { defineEnemy } from '../enemy/Enemy'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'

// P4-M3 - determinism proofs: same seed + same inputs -> identical
// fingerprints, independent of clock chunking (FPS-independence), and
// batch isolation. Any divergence here is a CONFIRMED engine defect -
// report, never normalize it away harness-side.

const WEAK_ENEMY = defineEnemy({
  id: 'simdet_weak', name: 'Weak', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: { maxHp: 1, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
  rewards: { techniqueMastery: 0, spiritStone: 0 },
})

const VARIANCE_ENEMY = defineEnemy({
  id: 'simdet_mob', name: 'Mob', level: 1, realmId: 'mortal', lane: 'ground',
  statsInput: {
    maxHp: 500, might: 5, attackSpeed: 1,
    criticalRate: 0, criticalDamage: 1.5, armor: 0, evasionRate: 0.2,
  },
  rewards: { techniqueMastery: 0, spiritStone: 0 },
})

function ngoDaoBuild(): SimBuildSnapshot {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 }
  return { player, skills: [], techniques: [] }
}

function plainBuild(): SimBuildSnapshot {
  const player = createDefaultPlayer()
  player.cultivationPath = 'sword'
  return { player, skills: [], techniques: [] }
}

describe('determinism', () => {
  it('same seed + same ngo_dao stage-1 build -> identical result', () => {
    const input = {
      seed: 20260922,
      build: ngoDaoBuild(),
      ritual: { pathId: 'spell' as const, wayId: 'hidden_spell_pathway' as const },
      encounter: { kind: 'stage' as const, stageId: 'mortal_dong_1' },
    }
    const a = runBattle(input)
    const b = runBattle(input)
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.metrics).toEqual(b.metrics)
    expect(a.steps).toBe(b.steps)
    expect(a.fightingSteps).toBe(b.fightingSteps)
    expect(a.outcome).toBe(b.outcome)
  })

  it('same seed + same plain-physical build -> identical result', () => {
    const input = {
      seed: 42,
      build: plainBuild(),
      encounter: { kind: 'enemy' as const, enemy: VARIANCE_ENEMY },
    }
    const a = runBattle(input)
    const b = runBattle(input)
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.metrics).toEqual(b.metrics)
  })

  it('FPS-independence: advance chunk size never changes the outcome', () => {
    const base = {
      seed: 4242,
      build: ngoDaoBuild(),
      ritual: { pathId: 'spell' as const, wayId: 'hidden_spell_pathway' as const },
      encounter: { kind: 'stage' as const, stageId: 'mortal_dong_1' },
    }
    const results = [0.1, 0.033, 0.25].map((chunk) =>
      runBattle({ ...base, advanceChunkSeconds: chunk }),
    )
    const [baseline, fine, coarse] = results
    expect(fine!.fingerprint).toBe(baseline!.fingerprint)
    expect(coarse!.fingerprint).toBe(baseline!.fingerprint)
    expect(fine!.steps).toBe(baseline!.steps)
    expect(coarse!.steps).toBe(baseline!.steps)
    expect(fine!.fightingSteps).toBe(baseline!.fightingSteps)
  })

  it('different seeds produce distinguishable runs on a variance build', () => {
    const a = runBattle({
      seed: 1, build: plainBuild(), encounter: { kind: 'enemy', enemy: VARIANCE_ENEMY },
    })
    const b = runBattle({
      seed: 999, build: plainBuild(), encounter: { kind: 'enemy', enemy: VARIANCE_ENEMY },
    })
    // Proc/evasion variance across 500hp of hits: two distinct seeds
    // must diverge somewhere (fingerprint covers steps + per-role
    // damage + casts + deaths).
    expect(a.fingerprint).not.toBe(b.fingerprint)
  })

  it('batch runs stay isolated and order-stable', () => {
    const inputs = [
      { seed: 5, build: ngoDaoBuild(), ritual: { pathId: 'spell' as const, wayId: 'hidden_spell_pathway' as const }, encounter: { kind: 'stage' as const, stageId: 'mortal_dong_1' } },
      { seed: 5, build: plainBuild(), encounter: { kind: 'enemy' as const, enemy: WEAK_ENEMY } },
      { seed: 5, build: plainBuild(), encounter: { kind: 'enemy' as const, enemy: VARIANCE_ENEMY } },
    ]
    const batch = runBattles(inputs)
    const solo = inputs.map((input) => runBattle(input))
    expect(batch.map((r) => r.fingerprint)).toEqual(solo.map((r) => r.fingerprint))
  })
})
