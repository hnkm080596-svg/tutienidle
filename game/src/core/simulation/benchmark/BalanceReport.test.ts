// P5-M1 - balance matrix + gate evaluation. Gate/comparator tests run
// on SYNTHETIC aggregates (unit-level); the recipe seams run real
// battles through the harness.

import { describe, expect, it } from 'vitest'
import { runBattle } from '../BattleSimulation'
import { defineEnemy } from '../../enemy/Enemy'
import type { BattleMetrics } from '../BattleMetrics'
import type { BattleSimulationResult } from '../BattleSimulation'
import {
  BASELINE_RECIPES,
  mortalSourcePlayer,
  type BaselineRecipe,
} from './BalanceBaselines'
import {
  aggregateCell,
  compareCells,
  evaluateGates,
  rankCells,
  type CellAggregate,
} from './BalanceReport'

function emptyMetrics(): BattleMetrics {
  return {
    damage: { total: 0, bySource: {}, byType: {}, takenByTarget: {}, dps: 0 },
    absorption: { wardAbsorbed: 0, externalWardAbsorbed: 0, manaShieldAbsorbed: 0, total: 0 },
    healing: { total: 0, byTarget: {}, overheal: 0 },
    resources: { byEntity: {} },
    casts: {},
    reactions: { resolved: {}, resolvedTotal: 0, skipped: 0, perMinute: 0 },
    uptime: {},
    deaths: [],
    vitalsDamage: { bySource: {}, byTarget: {}, playerOnEnemy: 0 },
    damageByMechanic: { byKind: {}, bySkillId: {}, byReactionId: {}, unattributed: 0 },
    phaseSteps: {},
    playerEndHpFraction: null,
    playerMaxHp: null,
  }
}

function fakeResult(overrides: {
  outcome?: BattleSimulationResult['outcome']
  fightingSteps?: number
  playerDealt?: number
  playerTaken?: number
  endHp?: number
  playerMaxHp?: number
  resources?: Partial<BattleMetrics['resources']['byEntity'][string]>
  casts?: Record<string, number>
  mechanic?: Partial<BattleMetrics['damageByMechanic']>
}): BattleSimulationResult {
  const metrics = emptyMetrics()
  const dealt = overrides.playerDealt ?? 0
  const taken = overrides.playerTaken ?? 0
  metrics.vitalsDamage.bySource['player'] = dealt
  metrics.vitalsDamage.byTarget['player'] = taken
  metrics.vitalsDamage.playerOnEnemy = dealt
  metrics.playerEndHpFraction = overrides.endHp ?? null
  metrics.resources.byEntity['player'] = {
    mpSpent: 0, mpGained: 0, wardSpent: 0, wardGained: 0, theSpent: 0, theGained: 0,
    ...overrides.resources,
  }
  metrics.casts = overrides.casts ?? {}
  metrics.playerMaxHp = overrides.playerMaxHp ?? null
  metrics.damageByMechanic = {
    byKind: {}, bySkillId: {}, byReactionId: {}, unattributed: 0,
    ...overrides.mechanic,
  }
  const fightingSteps = overrides.fightingSteps ?? 100
  return {
    outcome: overrides.outcome ?? 'victory',
    steps: fightingSteps,
    durationSeconds: fightingSteps * 0.1,
    fightingSteps,
    combatDurationSeconds: fightingSteps * 0.1,
    metrics,
    fingerprint: 'deadbeef',
    diagnostics: { timedEffectsStripped: 0, gaps: [] },
  }
}

const RECIPE_A: BaselineRecipe = {
  id: 'a', primary: true, ritual: { pathId: 'sword', wayId: 'sword_pathway' },
  postRitual: [], kitSkillIds: ['orb_dam'],
  expectedEconomy: { mustGenerate: [], mustSpend: [], notActiveAtThisPowerPoint: [], mustCast: [] },
}
const RECIPE_B: BaselineRecipe = { ...RECIPE_A, id: 'b' }
const RECIPE_C: BaselineRecipe = { ...RECIPE_A, id: 'c' }
const RECIPES = [RECIPE_A, RECIPE_B, RECIPE_C]

function cell(
  recipe: BaselineRecipe,
  benchmarkId: CellAggregate['benchmarkId'],
  seedResults: { outcome?: BattleSimulationResult['outcome']; fightingSteps?: number; playerDealt?: number; playerTaken?: number; endHp?: number; playerMaxHp?: number; mechanic?: Partial<BattleMetrics['damageByMechanic']> }[],
): CellAggregate {
  const runs = seedResults.map((r, i) => ({ seed: i + 1, result: fakeResult(r) }))
  return aggregateCell(recipe, benchmarkId, runs)
}

const WINS = (steps: number, dealt = 500) => [
  { outcome: 'victory' as const, fightingSteps: steps, playerDealt: dealt },
  { outcome: 'victory' as const, fightingSteps: steps, playerDealt: dealt },
]

describe('aggregateCell', () => {
  it('aggregates rates + victory-only TTK / all-seeds DPS', () => {
    const c = cell(RECIPE_A, 'single_target', [
      { outcome: 'victory', fightingSteps: 100, playerDealt: 500 },
      { outcome: 'victory', fightingSteps: 200, playerDealt: 800 },
      { outcome: 'defeat', fightingSteps: 300, playerDealt: 900 },
      { outcome: 'defeat', fightingSteps: 400, playerDealt: 100 },
    ])
    expect(c.victoryRate).toBe(0.5)
    expect(c.defeatRate).toBe(0.5)
    expect(c.ttk).toBe(150) // median over victorious seeds only
    // Plan r5: DPS is the mean over the WHOLE seed battery -
    // 500/10s=50, 800/20s=40, 900/30s=30, 100/40s=2.5 -> 30.625
    expect(c.playerDps).toBeCloseTo(30.625, 5)
  })

  it('null TTK on a no-win cell', () => {
    const c = cell(RECIPE_A, 'single_target', [
      { outcome: 'defeat', fightingSteps: 50 },
      { outcome: 'defeat', fightingSteps: 70 },
    ])
    expect(c.victoryRate).toBe(0)
    expect(c.ttk).toBeNull()
    // DPS still aggregates (0 dealt on every defeat seed -> 0, not
    // null): the battery mean exists even when no win does.
    expect(c.playerDps).toBe(0)
  })
})

describe('compareCells', () => {
  it('orders victoryRate first, then defeatRate, then scalar', () => {
    const wins = cell(RECIPE_A, 'single_target', WINS(100))
    const mixed = cell(RECIPE_B, 'single_target', [
      { outcome: 'victory', fightingSteps: 50 },
      { outcome: 'defeat', fightingSteps: 50 },
    ])
    // A 2/2-win row beats a faster-TTK 1/2 row - outcome first.
    expect(compareCells(wins, mixed)).toBeLessThan(0)

    const faster = cell(RECIPE_B, 'single_target', WINS(80))
    expect(compareCells(wins, faster)).toBeGreaterThan(0) // 100 vs 80 ttk
  })

  it('ties within relative eps on the scalar', () => {
    const a = cell(RECIPE_A, 'single_target', WINS(100))
    const b = cell(RECIPE_B, 'single_target', WINS(104)) // within 5%
    expect(compareCells(a, b)).toBe(0)
    const c = cell(RECIPE_C, 'single_target', WINS(120)) // outside 5%
    expect(compareCells(a, c)).toBeLessThan(0) // lower ttk ranks ahead
  })

  it('null TTK never ties with a number', () => {
    const noWin = cell(RECIPE_A, 'single_target', [
      { outcome: 'timeout' as const, fightingSteps: 500 },
      { outcome: 'timeout' as const, fightingSteps: 500 },
    ])
    const win = cell(RECIPE_B, 'single_target', WINS(100))
    // victoryRate 0 vs 1 already orders; force-equal rates for the
    // scalar test:
    const noWinA = { ...noWin, victoryRate: 0 }
    const winB = { ...win, victoryRate: 0, defeatRate: 0 }
    const a2 = { ...noWinA, defeatRate: 0 }
    expect(compareCells(a2, winB)).toBeGreaterThan(0) // null loses to 100
  })
})

describe('evaluateGates', () => {
  const BENCH = 'single_target' as const
  const BENCH2 = 'durable_target' as const

  it('flags a row that strictly wins every benchmark', () => {
    const cells = [BENCH, BENCH2].flatMap((bench) => [
      cell(RECIPE_A, bench, WINS(50)),
      cell(RECIPE_B, bench, WINS(200)),
      cell(RECIPE_C, bench, WINS(300)),
    ])
    const gates = evaluateGates(RECIPES, cells)
    expect(gates.dominance.pass).toBe(false)
    expect(gates.dominance.dominantRecipeId).toBe('a')
  })

  it('passes dominance when the lead splits across benchmarks', () => {
    // Three benchmarks so each row can have both a first and a last.
    const BENCH3 = 'attrition' as const
    const cells = [
      cell(RECIPE_A, BENCH, WINS(50)),
      cell(RECIPE_B, BENCH, WINS(200)),
      cell(RECIPE_C, BENCH, WINS(300)),
      cell(RECIPE_A, BENCH2, WINS(300)),
      cell(RECIPE_B, BENCH2, WINS(50)),
      cell(RECIPE_C, BENCH2, WINS(200)),
      cell(RECIPE_A, BENCH3, WINS(200)),
      cell(RECIPE_B, BENCH3, WINS(300)),
      cell(RECIPE_C, BENCH3, WINS(50)),
    ]
    const gates = evaluateGates(RECIPES, cells)
    expect(gates.dominance.pass).toBe(true)
    expect(gates.strengths.pass).toBe(true) // each row has a win + a loss
  })

  it('flags a row with no identifiable strength', () => {
    const cells = [
      cell(RECIPE_A, BENCH, WINS(50)),
      cell(RECIPE_B, BENCH, WINS(100)),
      cell(RECIPE_C, BENCH, WINS(150)),
      cell(RECIPE_A, BENCH2, WINS(50)),
      cell(RECIPE_B, BENCH2, WINS(100)),
      cell(RECIPE_C, BENCH2, WINS(150)),
    ]
    const gates = evaluateGates(RECIPES, cells)
    // A ranks first on both benchmarks - B/C never have a strength.
    expect(gates.strengths.perRecipe['a']!.hasStrength).toBe(true)
    expect(gates.strengths.perRecipe['b']!.hasStrength).toBe(false)
    expect(gates.strengths.perRecipe['c']!.hasWeakness).toBe(true)
    expect(gates.strengths.pass).toBe(false)
  })

  it('flags stalemate (all-timeout, no player DPS, incoming cannot kill)', () => {
    const cells = [
      cell(RECIPE_A, 'attrition', [
        // Taken 0 over a 5000-step timeout against a 200hp pool -
        // incoming literally cannot kill.
        { outcome: 'timeout', fightingSteps: 5000, playerDealt: 0, playerTaken: 0, playerMaxHp: 200 },
        { outcome: 'timeout', fightingSteps: 5000, playerDealt: 0, playerTaken: 0, playerMaxHp: 200 },
      ]),
      cell(RECIPE_B, 'attrition', WINS(400)),
      cell(RECIPE_C, 'attrition', WINS(500)),
    ]
    const gates = evaluateGates(RECIPES, cells)
    expect(gates.stalemates).toEqual([
      { recipeId: 'a', benchmarkId: 'attrition' },
    ])
  })

  it('does NOT flag a timeout where incoming damage could have killed', () => {
    const cells = [
      cell(RECIPE_A, 'attrition', [
        // Taken 350 > 200 pool - the enemy threatened; sustain/heals
        // carried the player to the timeout. Not a cannot-kill stall.
        { outcome: 'timeout', fightingSteps: 5000, playerDealt: 0, playerTaken: 350, playerMaxHp: 200 },
      ]),
      cell(RECIPE_B, 'attrition', WINS(400)),
      cell(RECIPE_C, 'attrition', WINS(500)),
    ]
    const gates = evaluateGates(RECIPES, cells)
    expect(gates.stalemates).toEqual([])
  })

  it('tied-last does NOT count as a weakness (strict-worst only)', () => {
    // A first; B and C tie for last (same TTK). Under the approved
    // exit-2 rule a shared last place is not an identifiable weakness -
    // so B and C each lack a weakness and the gate FAILS.
    const cells = [
      cell(RECIPE_A, BENCH, WINS(50)),
      cell(RECIPE_B, BENCH, WINS(200)),
      cell(RECIPE_C, BENCH, WINS(200)),
    ]
    const gates = evaluateGates(RECIPES, cells)
    expect(gates.strengths.perRecipe['b']!.hasWeakness).toBe(false)
    expect(gates.strengths.perRecipe['c']!.hasWeakness).toBe(false)
    expect(gates.strengths.pass).toBe(false)
  })

  it('attrition tie-breaks on the resource-stability flag', () => {
    // Same outcome rates + same TTK (within eps): the stable row ranks
    // ahead of the partially-cycling row.
    const stable: BaselineRecipe = {
      ...RECIPE_A, id: 'stable',
      expectedEconomy: {
        mustGenerate: ['theGained'], mustSpend: [],
        notActiveAtThisPowerPoint: [], mustCast: [],
      },
    }
    const unstable: BaselineRecipe = { ...stable, id: 'unstable' }
    const stableCell = aggregateCell(stable, 'attrition', [
      { seed: 1, result: fakeResult({ outcome: 'victory', fightingSteps: 100, resources: { theGained: 5 } }) },
      { seed: 2, result: fakeResult({ outcome: 'victory', fightingSteps: 100, resources: { theGained: 5 } }) },
    ])
    const unstableCell = aggregateCell(unstable, 'attrition', [
      { seed: 1, result: fakeResult({ outcome: 'victory', fightingSteps: 100, resources: { theGained: 5 } }) },
      // Second seed: the channel never moved - partial cycling.
      { seed: 2, result: fakeResult({ outcome: 'victory', fightingSteps: 100 }) },
    ])
    expect(stableCell.economyStable).toBe(true)
    expect(unstableCell.economyStable).toBe(false)
    expect(compareCells(stableCell, unstableCell)).toBeLessThan(0)
    expect(compareCells(unstableCell, stableCell)).toBeGreaterThan(0)
  })

  it('flags a deadlocked declared channel', () => {
    const econRecipe: BaselineRecipe = {
      ...RECIPE_A,
      id: 'econ',
      expectedEconomy: {
        mustGenerate: ['theGained'], mustSpend: [],
        notActiveAtThisPowerPoint: [], mustCast: ['some_skill'],
      },
    }
    // Seeds: victories but theGained never moves and some_skill never casts.
    const cells = [
      aggregateCell(econRecipe, 'attrition', [
        { seed: 1, result: fakeResult({ outcome: 'victory', fightingSteps: 100 }) },
      ]),
    ]
    const gates = evaluateGates([econRecipe], cells)
    expect(gates.deadlocks).toEqual(
      expect.arrayContaining([
        { recipeId: 'econ', channel: 'theGained' },
        { recipeId: 'econ', channel: 'cast:some_skill' },
      ]),
    )
  })

  it('gate failure lists ignore alternate (reported-only) rows', () => {
    // Plan: alternates are reported, not gate rows - an alternate's
    // stalled channel/uncast skill/stall-out must never enter
    // deadlocks/stalemates, though its cells still aggregate + report
    // economyNoEvidence.
    const alt: BaselineRecipe = {
      ...RECIPE_A,
      id: 'alt',
      primary: false,
      expectedEconomy: {
        mustGenerate: ['theGained'], mustSpend: ['theSpent'],
        notActiveAtThisPowerPoint: [], mustCast: ['alt_skill'],
      },
    }
    const cells = [
      // Alternate: victories but declared channels never move and the
      // declared cast never fires.
      aggregateCell(alt, 'attrition', [
        { seed: 1, result: fakeResult({ outcome: 'victory', fightingSteps: 100 }) },
      ]),
      // Alternate all-timeout no-damage cell - a stalemate shape that
      // must not be flagged.
      aggregateCell(alt, 'single_target', [
        { seed: 1, result: fakeResult({ outcome: 'timeout', fightingSteps: 5000, playerMaxHp: 200 }) },
      ]),
      // A healthy primary row alongside.
      aggregateCell(RECIPE_A, 'attrition', [
        { seed: 1, result: fakeResult({ outcome: 'victory', fightingSteps: 100 }) },
      ]),
      aggregateCell(RECIPE_A, 'single_target', [
        { seed: 1, result: fakeResult({ outcome: 'victory', fightingSteps: 100 }) },
      ]),
    ]
    const gates = evaluateGates([alt, RECIPE_A], cells)
    expect(gates.deadlocks).toEqual([])
    expect(gates.stalemates).toEqual([])
  })

  it('secondaryDominance is INCONCLUSIVE over tolerance, REVIEW_REQUIRED when one non-kit bucket tops every primary row', () => {
    const highUnattributed = cell(RECIPE_A, BENCH, [
      { outcome: 'victory', fightingSteps: 100, playerDealt: 100 },
    ])
    const patched: CellAggregate = { ...highUnattributed, unattributedShare: 0.5 }
    const gates = evaluateGates(RECIPES, [patched])
    expect(gates.secondaryDominance).toBe('INCONCLUSIVE')

    // 'reaction' out-damages the kit on EVERY primary row's pooled
    // distribution - universal secondary dominance.
    const reactionTopped = (recipe: BaselineRecipe) =>
      aggregateCell(recipe, BENCH, [
        { seed: 1, result: fakeResult({
          outcome: 'victory', fightingSteps: 100, playerDealt: 100,
          mechanic: { byKind: { reaction: 80 }, bySkillId: { orb_dam: 20 } },
        }) },
      ])
    const gates2 = evaluateGates(RECIPES, [
      reactionTopped(RECIPE_A),
      reactionTopped(RECIPE_B),
      reactionTopped(RECIPE_C),
    ])
    expect(gates2.secondaryDominance).toBe('REVIEW_REQUIRED')
  })

  it('secondaryDominance PASSes when a non-kit bucket is large but kit still tops', () => {
    // reaction 40 < kit_skill 60 per row - the non-kit bucket is never
    // the TOP damage source, so no universal secondary dominance.
    const kitTopped = (recipe: BaselineRecipe) =>
      aggregateCell(recipe, BENCH, [
        { seed: 1, result: fakeResult({
          outcome: 'victory', fightingSteps: 100, playerDealt: 100,
          mechanic: { byKind: { reaction: 40 }, bySkillId: { orb_dam: 60 } },
        }) },
      ])
    const gates = evaluateGates(RECIPES, [
      kitTopped(RECIPE_A),
      kitTopped(RECIPE_B),
      kitTopped(RECIPE_C),
    ])
    expect(gates.secondaryDominance).toBe('PASS')
  })
})

describe('kit-surface declaration (real recipes)', () => {
  it('spell_pathway classifies a foreign-element origin as other_skill', () => {
    // The recipe resolves fire/dot only - a water-basic damage op on
    // this row is leakage, not kit. If kitSkillIds regressed to the
    // full five-element whitelist this assertion fails (kit_skill
    // would top instead of other_skill).
    const nguHanh = BASELINE_RECIPES.find((r) => r.id === 'phap_tu_ngu_hanh')!
    const c = aggregateCell(nguHanh, 'single_target', [
      {
        seed: 1,
        result: fakeResult({
          outcome: 'victory', fightingSteps: 100, playerDealt: 100,
          mechanic: { bySkillId: { thuy_tien_thuat: 80, hoa_cau_thuat: 20 } },
        }),
      },
    ])
    expect(c.topBucket).toBe('other_skill')
  })

  it('kiem_tu_hien classifies a higher-realm combo origin as other_skill', () => {
    // tam_tram [C,C,C] needs orb_chem (realmIndex 2) - unreachable at
    // qi_refining. If kitSkillIds regressed to the full 37-combo list
    // this assertion fails (kit_skill would top instead).
    const kiemHien = BASELINE_RECIPES.find((r) => r.id === 'kiem_tu_hien')!
    const c = aggregateCell(kiemHien, 'single_target', [
      {
        seed: 1,
        result: fakeResult({
          outcome: 'victory', fightingSteps: 100, playerDealt: 100,
          mechanic: { bySkillId: { tam_tram: 80, orb_dam: 20 } },
        }),
      },
    ])
    expect(c.topBucket).toBe('other_skill')
  })
})

describe('baseline recipe seams (real battles)', () => {
  it('body/hien purchases cuong_chien through the registered node catalog', () => {
    const recipe = BASELINE_RECIPES.find((r) => r.id === 'the_tu_hien')!
    // Would throw "postRitual write rejected" if the catalog closure
    // missed THE_TU_NODES or the writer refused.
    const result = runBattle({
      seed: 11,
      build: { player: mortalSourcePlayer(), skills: [], techniques: [] },
      ritual: recipe.ritual,
      postRitual: recipe.postRitual,
      encounter: {
        kind: 'enemy',
        enemy: defineEnemy({
          id: 'bench_probe', name: 'probe', level: 1, realmId: 'mortal', lane: 'ground',
          statsInput: {
            maxHp: 500, might: 0, attackSpeed: 1,
            criticalRate: 0, criticalDamage: 1.5, armor: 0,
          },
          rewards: { techniqueMastery: 0, spiritStone: 0 },
        }),
      },
    })
    expect(result.outcome).toBe('victory')
    expect(result.metrics.casts['cuong_quyen'] ?? 0).toBeGreaterThan(0)
  })

  it('a rejected postRitual write fails loudly', () => {
    expect(() =>
      runBattle({
        seed: 11,
        build: { player: mortalSourcePlayer(), skills: [], techniques: [] },
        ritual: { pathId: 'sword', wayId: 'sword_pathway' },
        postRitual: [{ type: 'purchase_node', nodeId: 'nonexistent_node' }],
        encounter: {
          kind: 'enemy',
          enemy: defineEnemy({
            id: 'bench_probe', name: 'probe', level: 1, realmId: 'mortal', lane: 'ground',
            statsInput: {
              maxHp: 1, might: 0, attackSpeed: 1,
              criticalRate: 0, criticalDamage: 1.5, armor: 0,
            },
            rewards: { techniqueMastery: 0, spiritStone: 0 },
          }),
        },
      }),
    ).toThrow(/postRitual write rejected/)
  })
})

describe('rankCells', () => {
  it('sorts by the comparator', () => {
    const a = cell(RECIPE_A, 'single_target', WINS(50))
    const b = cell(RECIPE_B, 'single_target', WINS(200))
    const c = cell(RECIPE_C, 'single_target', WINS(300))
    expect(rankCells([c, a, b]).map((x) => x.recipeId)).toEqual(['a', 'b', 'c'])
  })
})
