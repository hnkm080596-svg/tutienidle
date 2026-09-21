// P5 - the benchmark battery (plan: docs/superpowers/plans/
// 2026-09-22-three-path-balance-baseline.md, inventory: docs/
// architecture/2026-09-23-balance-baseline-inventory.md section 3).
// Synthetic fixtures - deterministic literals, never registered into
// the real catalog outside a simulation run. Stats are tuned so the
// scenario's scalar DISCRIMINATES between path identities rather than
// producing a binary pass/fail.

import { defineEnemy } from '../../enemy/Enemy'
import type { Stage } from '../../stage/Stage'
import type { SimEncounter } from '../BattleSimulation'

export type BenchmarkId =
  | 'single_target'
  | 'multi_enemy'
  | 'durable_target'
  | 'burst_pressure'
  | 'attrition'

export interface BenchmarkDefinition {
  id: BenchmarkId
  /** Human-readable design intent, echoed into the balance report. */
  intent: string
  encounter: SimEncounter
}

// Reference point (inventory section 1): baseline player ~= might 10-15,
// maxHp ~100 + way modifiers, qi_refining Lv1. Real qi_refining mobs
// sit near hp 200 / might 20 / armor 10.

const BASE_REWARDS = { techniqueInsight: 0, spiritStone: 0 }

// Moderate fight - expected TTK tens of steps, enough hits both ways
// that kit identity shows but nobody one-shots.
const SINGLE_TARGET = defineEnemy({
  id: 'bench_single',
  name: 'Benchmark Single Target',
  level: 1,
  realmId: 'qi_refining',
  lane: 'ground',
  statsInput: {
    maxHp: 400,
    might: 12,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 5,
    evasionRate: 0,
  },
  rewards: BASE_REWARDS,
})

// Weak mob pack for the AoE benchmark - individually killable, the
// pack pressure is sustained small hits.
const SWARM_MOB = defineEnemy({
  id: 'bench_swarm_mob',
  name: 'Benchmark Swarm Mob',
  level: 1,
  realmId: 'qi_refining',
  lane: 'ground',
  statsInput: {
    maxHp: 80,
    might: 6,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 0,
    evasionRate: 0,
  },
  rewards: BASE_REWARDS,
})

const SWARM_STAGE: Stage = {
  id: 'bench_swarm_stage',
  name: 'Benchmark Swarm',
  description: 'Four weak mobs in two waves - AoE throughput benchmark.',
  floor: 1,
  enemyPool: [{ enemyId: SWARM_MOB.id, weight: 1 }],
  totalEnemyCount: 4,
  waves: [2, 2],
  spawnIntervalSeconds: 0,
}

// High HP, low damage - the sustained-DPS ceiling probe. Tuned (M2
// sweep): hp1200 sits inside entry-level reach so the outcome resolves
// by TTK, not survival - might 3 keeps the fight long but survivable.
const DURABLE_TARGET = defineEnemy({
  id: 'bench_durable',
  name: 'Benchmark Durable Target',
  level: 1,
  realmId: 'qi_refining',
  lane: 'ground',
  statsInput: {
    maxHp: 1200,
    might: 3,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 8,
    evasionRate: 0,
  },
  rewards: BASE_REWARDS,
})

// High might, modest HP - the survival-margin probe. Victory is
// attainable at entry level; the scalar is end-HP fraction, so might
// 16 (M2 sweep) threatens most of the HP bar without auto-killing.
const BURST_PRESSURE = defineEnemy({
  id: 'bench_burst',
  name: 'Benchmark Burst Pressure',
  level: 1,
  realmId: 'qi_refining',
  lane: 'ground',
  statsInput: {
    maxHp: 250,
    might: 16,
    attackSpeed: 1.2,
    criticalRate: 0.1,
    criticalDamage: 1.5,
    armor: 0,
    evasionRate: 0,
  },
  rewards: BASE_REWARDS,
})

// Long fight - sustain channels (regen / mana shield / the economy)
// must cycle repeatedly before the kill lands. M2 sweep: might 6 +
// hp900 makes sustain decide - raw-DPS paths die, sustain paths win.
const ATTRITION = defineEnemy({
  id: 'bench_attrition',
  name: 'Benchmark Attrition Target',
  level: 1,
  realmId: 'qi_refining',
  lane: 'ground',
  statsInput: {
    maxHp: 900,
    might: 6,
    attackSpeed: 1,
    criticalRate: 0,
    criticalDamage: 1.5,
    armor: 5,
    evasionRate: 0,
  },
  rewards: BASE_REWARDS,
})

export const BENCHMARKS: readonly BenchmarkDefinition[] = [
  {
    id: 'single_target',
    intent: 'kill-speed identity on one moderate target',
    encounter: { kind: 'enemy', enemy: SINGLE_TARGET },
  },
  {
    id: 'multi_enemy',
    intent: 'AoE throughput on a weak-mob pack',
    encounter: { kind: 'customStage', stage: SWARM_STAGE, enemies: [SWARM_MOB] },
  },
  {
    id: 'durable_target',
    intent: 'sustained-DPS ceiling on a high-HP low-damage target',
    encounter: { kind: 'enemy', enemy: DURABLE_TARGET },
  },
  {
    id: 'burst_pressure',
    intent: 'survival margin under high incoming burst',
    encounter: { kind: 'enemy', enemy: BURST_PRESSURE },
  },
  {
    id: 'attrition',
    intent: 'resource/sustain cycling over a long fight',
    encounter: { kind: 'enemy', enemy: ATTRITION },
  },
]

export function getBenchmark(id: BenchmarkId): BenchmarkDefinition {
  const bench = BENCHMARKS.find((b) => b.id === id)
  if (!bench) throw new Error(`unknown benchmark '${id}'`)
  return bench
}
