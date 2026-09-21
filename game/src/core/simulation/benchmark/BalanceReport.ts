// P5 - the balance matrix runner + gate evaluation (plan section Scenario
// ranking + gates). Aggregates per recipe x benchmark cell across the
// seed battery; gates consume ONE comparator and the per-cell
// aggregates - never raw single-seed results.

import type { BattleMetrics } from '../BattleMetrics'
import {
  runBattle,
  type BattleSimulationInput,
  type BattleSimulationResult,
} from '../BattleSimulation'
import {
  ALL_RECIPES,
  BALANCE_SEEDS,
  recipeInputs,
  type BaselineRecipe,
  type ExpectedEconomy,
} from './BalanceBaselines'
import { BENCHMARKS, type BenchmarkId } from './BenchmarkEncounters'

// ---------------------------------------------------------------------------
// Per-cell aggregate
// ---------------------------------------------------------------------------

export interface SeedRunSummary {
  seed: number
  outcome: BattleSimulationResult['outcome']
  fightingSteps: number
  playerDps: number
  hpDamageTaken: number
  endHpFraction: number | null
  fingerprint: string
  metrics: BattleMetrics
}

export interface CellAggregate {
  recipeId: string
  benchmarkId: BenchmarkId
  victoryRate: number
  defeatRate: number
  timeoutRate: number
  /** Median fightingSteps over victorious seeds; null when none. */
  ttk: number | null
  /** Mean player DPS over victorious seeds; null when none. */
  playerDps: number | null
  /** Mean vitals-derived HP damage taken by the player, all seeds. */
  hpDamageTaken: number
  /** Median player end-HP fraction across all seeds. */
  endHpFraction: number | null
  /** Fraction of non-defeat seeds where each declared channel moved. */
  economyMovement: Record<string, number>
  /** Plan attrition tie-break: every declared channel moved in EVERY
   *  non-defeat seed. false on no-evidence cells and on partially
   *  cycling channels; vacuous true for empty declarations with
   *  surviving seeds. */
  economyStable: boolean
  /** Latest observed player maxHp across seeds (stalemate pool check). */
  playerMaxHp: number | null
  /** Share of player vitals damage with no trace attribution (0..1). */
  unattributedShare: number
  /** Top bucket across the FULL damage distribution (kit included). */
  topBucket: string | null
  /** Top non-kit mechanic bucket by player damage, if any. */
  topNonKitBucket: string | null
  topNonKitShare: number
  seeds: readonly SeedRunSummary[]
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

// Channel resolvers - the ExpectedEconomy channel vocabulary. Kept
// concrete-id-free: channels are ledger fields / metric lanes, and the
// recipe data (not the evaluator) decides which apply.
function channelValue(metrics: BattleMetrics, channel: string): number {
  const ledger = metrics.resources.byEntity['player']
  switch (channel) {
    case 'mpSpent': return ledger?.mpSpent ?? 0
    case 'mpGained': return ledger?.mpGained ?? 0
    case 'wardSpent': return ledger?.wardSpent ?? 0
    case 'wardGained': return ledger?.wardGained ?? 0
    case 'theSpent': return ledger?.theSpent ?? 0
    case 'theGained': return ledger?.theGained ?? 0
    case 'healingReceived': return metrics.healing.byTarget['player'] ?? 0
    default: return 0
  }
}

function economyMovementFor(
  economy: ExpectedEconomy,
  seeds: readonly SeedRunSummary[],
): Record<string, number> {
  const channels = [...economy.mustGenerate, ...economy.mustSpend]
  const result: Record<string, number> = {}
  if (channels.length === 0) return result
  // Defeat seeds end early - a channel that never got the chance to
  // cycle there is not evidence of deadlock. Evaluate on non-defeats.
  const eligible = seeds.filter((s) => s.outcome !== 'defeat')
  const denom = Math.max(1, eligible.length)
  for (const channel of channels) {
    const moved = eligible.filter(
      (s) => channelValue(s.metrics, channel) > 0,
    ).length
    result[channel] = moved / denom
  }
  return result
}

// The FULL damage-source distribution (plan exit-4): kit_skill is the
// combined damage of the recipe's declared kit ids; every other
// trace-provenance kind plus the vitals-derived unattributed remainder
// form the non-kit buckets. A secondary mechanic can only be "the top
// damage source" when compared against the kit, not after removing it.
function bucketDistribution(
  metrics: BattleMetrics,
  kitSkillIds: readonly string[],
): Record<string, number> {
  const mech = metrics.damageByMechanic
  const kit = new Set(kitSkillIds)
  const buckets: Record<string, number> = {
    kit_skill: 0,
    other_skill: 0,
    reaction: mech.byKind['reaction'] ?? 0,
    buff_periodic: mech.byKind['buff_periodic'] ?? 0,
    proc: mech.byKind['proc'] ?? 0,
    scripted: mech.byKind['scripted'] ?? 0,
    unattributed: mech.unattributed,
  }
  for (const [skillId, hp] of Object.entries(mech.bySkillId)) {
    buckets[kit.has(skillId) ? 'kit_skill' : 'other_skill']! += hp
  }
  return buckets
}

export function aggregateCell(
  recipe: BaselineRecipe,
  benchmarkId: BenchmarkId,
  runs: readonly { seed: number; result: BattleSimulationResult }[],
): CellAggregate {
  const seeds: SeedRunSummary[] = runs.map(({ seed, result }) => {
    // Plan contract: player output = player-sourced hp loss on
    // ENEMY-SIDE targets only (self/ally damage never feeds DPS).
    const playerDealt = result.metrics.vitalsDamage.playerOnEnemy
    const duration = result.combatDurationSeconds
    return {
      seed,
      outcome: result.outcome,
      fightingSteps: result.fightingSteps,
      playerDps: duration > 0 ? playerDealt / duration : 0,
      hpDamageTaken: result.metrics.vitalsDamage.byTarget['player'] ?? 0,
      endHpFraction: result.metrics.playerEndHpFraction,
      fingerprint: result.fingerprint,
      metrics: result.metrics,
    }
  })
  const k = seeds.length
  const victories = seeds.filter((s) => s.outcome === 'victory')
  const defeats = seeds.filter((s) => s.outcome === 'defeat')

  const playerDealtTotal = seeds.reduce(
    (sum, s) => sum + s.metrics.vitalsDamage.playerOnEnemy,
    0,
  )
  const unattributedTotal = seeds.reduce(
    (sum, s) => sum + s.metrics.damageByMechanic.unattributed,
    0,
  )

  // Top bucket across the whole seed battery (pooled) - the full
  // distribution decides the top damage source; the non-kit top is
  // kept alongside for the report.
  const pooled: Record<string, number> = {}
  for (const s of seeds) {
    for (const [bucket, hp] of Object.entries(
      bucketDistribution(s.metrics, recipe.kitSkillIds),
    )) {
      pooled[bucket] = (pooled[bucket] ?? 0) + hp
    }
  }
  const rankedBuckets = Object.entries(pooled).sort((a, b) => b[1] - a[1])
  const top = rankedBuckets[0]
  const topNonKit = rankedBuckets.find(([bucket]) => bucket !== 'kit_skill')

  const economyChannels = [
    ...recipe.expectedEconomy.mustGenerate,
    ...recipe.expectedEconomy.mustSpend,
  ]
  const economyMovement = economyMovementFor(recipe.expectedEconomy, seeds)
  const eligibleSeeds = seeds.filter((s) => s.outcome !== 'defeat').length
  const economyStable =
    eligibleSeeds > 0 &&
    economyChannels.every((channel) => economyMovement[channel] === 1)

  const playerMaxHp = seeds.reduce<number | null>(
    (max, s) =>
      s.metrics.playerMaxHp !== null && (max === null || s.metrics.playerMaxHp > max)
        ? s.metrics.playerMaxHp
        : max,
    null,
  )

  return {
    recipeId: recipe.id,
    benchmarkId,
    victoryRate: victories.length / k,
    defeatRate: defeats.length / k,
    timeoutRate: (k - victories.length - defeats.length) / k,
    // TTK is victory-only (a defeat's "time to kill" is undefined);
    // DPS is the mean over the WHOLE seed battery per plan r5 - defeat
    // seeds still dealt damage over their combat time.
    ttk: median(victories.map((s) => s.fightingSteps)),
    playerDps: mean(seeds.map((s) => s.playerDps)),
    hpDamageTaken: mean(seeds.map((s) => s.hpDamageTaken)) ?? 0,
    endHpFraction: median(
      seeds.map((s) => s.endHpFraction).filter((v): v is number => v !== null),
    ),
    economyMovement,
    economyStable,
    playerMaxHp,
    unattributedShare: playerDealtTotal > 0 ? unattributedTotal / playerDealtTotal : 0,
    topBucket: top && top[1] > 0 ? top[0] : null,
    topNonKitBucket: topNonKit && topNonKit[1] > 0 ? topNonKit[0] : null,
    topNonKitShare:
      topNonKit && playerDealtTotal > 0 ? topNonKit[1] / playerDealtTotal : 0,
    seeds,
  }
}

// ---------------------------------------------------------------------------
// Comparator - the ONE ordering every gate consumes (plan: lexicographic
// victoryRate desc -> defeatRate asc -> scenario scalar keys).
// ---------------------------------------------------------------------------

const EPS = 0.05

function scalarKeys(benchmarkId: BenchmarkId): readonly (keyof CellAggregate)[] {
  switch (benchmarkId) {
    case 'single_target':
    case 'durable_target':
      return ['ttk']
    case 'multi_enemy':
      return ['ttk', 'playerDps']
    case 'burst_pressure':
      return ['endHpFraction', 'playerDps']
    case 'attrition':
      return ['ttk', 'economyStable']
  }
}

// -1: a ranks ahead; +1: b ranks ahead; 0: full tie.
export function compareCells(a: CellAggregate, b: CellAggregate): number {
  if (a.victoryRate !== b.victoryRate) return b.victoryRate - a.victoryRate
  if (a.defeatRate !== b.defeatRate) return a.defeatRate - b.defeatRate
  for (const key of scalarKeys(a.benchmarkId)) {
    const va = a[key]
    const vb = b[key]
    if (typeof va === 'boolean' || typeof vb === 'boolean') {
      // boolean key (resource-stability flag) - exact equality; stable
      // ranks ahead (plan: booleans/enums compare exactly).
      if (va === vb) continue
      return va === true ? -1 : 1
    }
    if (typeof va !== 'number' || typeof vb !== 'number') {
      // null handling: null==null ties (advance); null vs number - the
      // null row loses (a TTK of null means no victories anyway, but
      // keep the semantics explicit for other scalars).
      if (va === null && vb === null) continue
      if (va === null) return 1
      if (vb === null) return -1
      continue
    }
    // Lower-is-better for TTK; higher-is-better for the rate scalars.
    const lowerBetter = key === 'ttk' || key === 'hpDamageTaken'
    const diff = lowerBetter ? va - vb : vb - va
    const tolerance = EPS * Math.max(Math.abs(va), Math.abs(vb))
    if (Math.abs(va - vb) > tolerance) return diff < 0 ? -1 : 1
  }
  return 0
}

export function rankCells(cells: readonly CellAggregate[]): CellAggregate[] {
  return [...cells].sort(compareCells)
}

// ---------------------------------------------------------------------------
// Gates (spec exit conditions, machine-checkable)
// ---------------------------------------------------------------------------

export interface GateReport {
  /** exit-1: no path strictly first on every benchmark. */
  dominance: { pass: boolean; dominantRecipeId?: string }
  /** exit-2: every path best-or-tied somewhere AND strictly worst somewhere. */
  strengths: {
    pass: boolean
    perRecipe: Record<string, { hasStrength: boolean; hasWeakness: boolean }>
  }
  /** Cells ending in timeout with negligible player DPS. */
  stalemates: { recipeId: string; benchmarkId: BenchmarkId }[]
  /** exit-3: declared economy channels that never cycled. */
  deadlocks: { recipeId: string; channel: string }[]
  /** Evaluated cells with zero non-defeat seeds - an all-defeat fight
   *  can end before channels cycle, so absence of movement there is
   *  NOT deadlock evidence. Recorded so the report stays honest. */
  economyNoEvidence: { recipeId: string; benchmarkId: BenchmarkId }[]
  /** exit-4 tri-state. */
  secondaryDominance: 'PASS' | 'REVIEW_REQUIRED' | 'INCONCLUSIVE'
  unattributedTolerance: number
}

const STALEMATE_DPS_FLOOR = 0.01
export const UNATTRIBUTED_TOLERANCE = 0.2

export function evaluateGates(
  recipes: readonly BaselineRecipe[],
  cells: readonly CellAggregate[],
): GateReport {
  const primaryCells = cells.filter((c) =>
    recipes.find((r) => r.id === c.recipeId)?.primary,
  )
  const byBenchmark = new Map<BenchmarkId, CellAggregate[]>()
  for (const cell of primaryCells) {
    const list = byBenchmark.get(cell.benchmarkId) ?? []
    list.push(cell)
    byBenchmark.set(cell.benchmarkId, list)
  }

  // exit-1: a path dominates iff it ranks strictly first on EVERY
  // benchmark (compareCells < 0 against every other primary row).
  let dominantRecipeId: string | undefined
  for (const recipe of recipes.filter((r) => r.primary)) {
    const dominatesAll = [...byBenchmark.values()].every((benchmarkCells) => {
      const mine = benchmarkCells.find((c) => c.recipeId === recipe.id)
      if (!mine) return false
      return benchmarkCells.every(
        (other) =>
          other.recipeId === recipe.id || compareCells(mine, other) < 0,
      )
    })
    if (dominatesAll) dominantRecipeId = recipe.id
  }

  // exit-2: strength = best-or-tied-first on >=1 benchmark; weakness =
  // strictly worst on >=1.
  const perRecipe: GateReport['strengths']['perRecipe'] = {}
  let strengthsPass = true
  for (const recipe of recipes.filter((r) => r.primary)) {
    let hasStrength = false
    let hasWeakness = false
    for (const benchmarkCells of byBenchmark.values()) {
      const mine = benchmarkCells.find((c) => c.recipeId === recipe.id)
      if (!mine) continue
      const ranked = rankCells(benchmarkCells)
      if (compareCells(ranked[0]!, mine) === 0) hasStrength = true
      // Weakness = strictly worst: ranks below EVERY other row on the
      // benchmark (epsilon ties at the bottom do not count - a shared
      // last place is not an identifiable weakness under the approved
      // contract).
      if (
        benchmarkCells.every(
          (other) =>
            other.recipeId === recipe.id || compareCells(mine, other) > 0,
        )
      ) {
        hasWeakness = true
      }
    }
    perRecipe[recipe.id] = { hasStrength, hasWeakness }
    if (!hasStrength || !hasWeakness) strengthsPass = false
  }

  // Stalemate: timeout + negligible player DPS + incoming damage that
  // cannot kill (total taken never reached one player pool - healing
  // aside, the enemy never threatened). Both sides alive, nobody
  // progressing.
  const stalemates: GateReport['stalemates'] = []
  for (const cell of primaryCells) {
    const allTimeout = cell.seeds.every((s) => s.outcome === 'timeout')
    const maxDps = Math.max(...cell.seeds.map((s) => s.playerDps))
    const maxTaken = Math.max(...cell.seeds.map((s) => s.hpDamageTaken))
    const incomingCannotKill =
      cell.playerMaxHp !== null && maxTaken < cell.playerMaxHp
    if (allTimeout && maxDps < STALEMATE_DPS_FLOOR && incomingCannotKill) {
      stalemates.push({ recipeId: cell.recipeId, benchmarkId: cell.benchmarkId })
    }
  }

  // exit-3: a declared channel that moved in ZERO non-defeat seeds is a
  // deadlock (economyMovement 0). Channels partially moving are recorded
  // in the report but pass.
  const deadlocks: GateReport['deadlocks'] = []
  const economyNoEvidence: GateReport['economyNoEvidence'] = []
  // Deadlock failure entries derive from PRIMARY rows only - alternate
  // recipes are reported-only per plan (their diagnostics still appear
  // via economyNoEvidence and the cell table).
  for (const cell of cells) {
    const recipe = recipes.find((r) => r.id === cell.recipeId)
    if (!recipe) continue
    if (cell.benchmarkId !== 'attrition' && cell.benchmarkId !== 'single_target') {
      continue
    }
    // mustCast first - casts can fire inside losing fights, so an
    // all-defeat cell still carries cast evidence.
    if (recipe.primary) {
      for (const skillId of recipe.expectedEconomy.mustCast) {
        const fired = cell.seeds.some((s) => (s.metrics.casts[skillId] ?? 0) > 0)
        if (!fired) deadlocks.push({ recipeId: cell.recipeId, channel: `cast:${skillId}` })
      }
    }
    // Channel movement needs a surviving fight - all-defeat cells carry
    // no economy evidence (the fight can end before channels cycle).
    if (!cell.seeds.some((s) => s.outcome !== 'defeat')) {
      economyNoEvidence.push({ recipeId: cell.recipeId, benchmarkId: cell.benchmarkId })
      continue
    }
    if (recipe.primary) {
      for (const [channel, fraction] of Object.entries(cell.economyMovement)) {
        if (fraction === 0) deadlocks.push({ recipeId: cell.recipeId, channel })
      }
    }
  }

  // exit-4 tri-state over primary rows. Per plan: PASS requires no
  // non-kit bucket to be the TOP damage source on every primary row;
  // REVIEW_REQUIRED when ONE non-kit bucket tops every primary row.
  // The full distribution (kit_skill included) decides each row's top -
  // pooled across the row's cells.
  const anyInconclusive = primaryCells.some(
    (c) => c.unattributedShare > UNATTRIBUTED_TOLERANCE,
  )
  const rowTopBuckets = new Map<string, string | null>()
  for (const recipe of recipes.filter((r) => r.primary)) {
    const rowCells = primaryCells.filter((c) => c.recipeId === recipe.id)
    if (rowCells.length === 0) {
      rowTopBuckets.set(recipe.id, null)
      continue
    }
    const pooled: Record<string, number> = {}
    for (const c of rowCells) {
      for (const s of c.seeds) {
        for (const [bucket, hp] of Object.entries(
          bucketDistribution(s.metrics, recipe.kitSkillIds),
        )) {
          pooled[bucket] = (pooled[bucket] ?? 0) + hp
        }
      }
    }
    const top = Object.entries(pooled).sort((a, b) => b[1] - a[1])[0]
    rowTopBuckets.set(recipe.id, top && top[1] > 0 ? top[0] : null)
  }
  const rowTops = [...rowTopBuckets.values()].filter(
    (b): b is string => b !== null,
  )
  const universalNonKit =
    rowTops.length > 0 &&
    rowTops.length === rowTopBuckets.size &&
    rowTops.every((b) => b === rowTops[0] && b !== 'kit_skill')
      ? rowTops[0]
      : undefined
  const secondaryDominance: GateReport['secondaryDominance'] = anyInconclusive
    ? 'INCONCLUSIVE'
    : universalNonKit !== undefined
      ? 'REVIEW_REQUIRED'
      : 'PASS'

  return {
    dominance: { pass: dominantRecipeId === undefined, dominantRecipeId },
    strengths: { pass: strengthsPass, perRecipe },
    stalemates,
    deadlocks,
    economyNoEvidence,
    secondaryDominance,
    unattributedTolerance: UNATTRIBUTED_TOLERANCE,
  }
}

// ---------------------------------------------------------------------------
// Matrix runner
// ---------------------------------------------------------------------------

export interface BalanceMatrixResult {
  cells: readonly CellAggregate[]
  gates: GateReport
  recipes: readonly BaselineRecipe[]
}

export function runBalanceMatrix(options?: {
  recipes?: readonly BaselineRecipe[]
  seeds?: readonly number[]
}): BalanceMatrixResult {
  const recipes = options?.recipes ?? ALL_RECIPES
  const seeds = options?.seeds ?? BALANCE_SEEDS
  const cells: CellAggregate[] = []

  for (const recipe of recipes) {
    for (const benchmark of BENCHMARKS) {
      const runs = seeds.map((seed) => {
        // Identical mortal source for every recipe - build identity
        // lives entirely in the ritual + postRitual writes.
        const input: BattleSimulationInput = {
          ...recipeInputs(recipe, seed),
          encounter: benchmark.encounter,
        }
        return { seed, result: runBattle(input) }
      })
      cells.push(aggregateCell(recipe, benchmark.id, runs))
    }
  }

  return { cells, gates: evaluateGates(recipes, cells), recipes }
}
