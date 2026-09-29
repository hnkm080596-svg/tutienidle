/**
 * baseStats write-authority guard (ruling 2026-09-29).
 *
 * `player.baseStats` is the "real points" pool the hidden-lineage
 * predicate reads (HiddenLineage.isHiddenBreakthroughEligible). The
 * ruling that made permanent_stat pills write baseStats directly came
 * with exactly one enumeration: only TWO income channels may write it.
 *
 *   1. Level-up allocation - GameManagerProgressionOps.allocateAttributePoint
 *   2. Pills - PillSystem.useProfessionPill (permanent_stat + random_main_stat)
 *
 * Both share one bound: getEffectiveMainStatCap. Anything else that
 * needs to move a stat (equipment, buffs, nodes, body refinement)
 * belongs to the modifier/assembly channels and must NOT touch
 * baseStats - that is what keeps the predicate honest.
 *
 * Restore/replace paths (save load, entity mint) assign the whole
 * object or re-derive it through StatBlock/assembly, never mutate
 * baseStats fields in place - those are data movement, not income.
 *
 * Explicitly OUT of scope: test/simulation files (fixtures and driven
 * sessions set up state directly; they are not production authority).
 */
import { describe, expect, it } from 'vitest'
import { join, relative } from 'node:path'
import { listProductionTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')

/**
 * Matches writes to the baseStats pool:
 * - field writes: `x.baseStats.str =`, `x.baseStats[stat] +=`, `++`/`--`
 * - whole-object reassignment: `x.baseStats = {...}` (the `=` is not
 *   preceded by a member key here because `.baseStats` itself carries it)
 * - structural mutation: `Object.assign(x.baseStats, ...)`,
 *   `delete x.baseStats.k`
 *
 * Reads (`< cap`, `?? 0`) and construction (`baseStats: createBaseStats()`)
 * do not match - the `:` form is an object literal, not a `.` member write.
 */
const BASESTATS_WRITE_RE =
  /\.baseStats\s*(?:[+\-*/]?=(?!=)|\+\+|--)|\.baseStats(?:\.\w+|\[[^\]]*\])\s*(?:[+\-*/]?=(?!=)|\+\+|--)|Object\.assign\([^)]*\.baseStats|delete\s+\w+\.baseStats/

interface AllowedFile {
  path: string
  contract: string
}

const ALLOWED: AllowedFile[] = [
  {
    path: 'src/core/game/GameManagerProgressionOps.ts',
    contract:
      'Level-up allocation authority: allocateAttributePoint spends attributePoints into baseStats, bounded by getEffectiveMainStatCap.',
  },
  {
    path: 'src/core/pill/PillSystem.ts',
    contract:
      'Pill stat channel authority: useProfessionPill writes permanent_stat/random_main_stat grants into baseStats, bounded by the same cap (canUseProfessionPill).',
  },
]

interface Offender {
  file: string
  line: number
  text: string
}

function collectOffenders(): { violations: Offender[]; unclassified: Offender[] } {
  const violations: Offender[] = []
  const unclassified: Offender[] = []

  for (const file of listProductionTs(SRC_DIR)) {
    const rel = relative(GAME_ROOT, file).replaceAll('\\', '/')
    const allowed = ALLOWED.find((a) => a.path === rel)

    readTs(file)
      .split('\n')
      .forEach((line, idx) => {
        if (!BASESTATS_WRITE_RE.test(line)) return
        const offender = { file: rel, line: idx + 1, text: line.trim() }
        if (allowed) {
          violations.push(offender)
        } else {
          unclassified.push(offender)
        }
      })
  }

  return { violations, unclassified }
}

describe('baseStats write authority - only level-up + pills', () => {
  it(
    'no production file outside the two enumerated channels writes baseStats',
    { timeout: SCAN_TIMEOUT },
    () => {
      const { unclassified } = collectOffenders()
      expect(
        unclassified,
        'New baseStats writer outside level-up/pills. The hidden predicate ' +
          'reads baseStats only - a third channel either silently funds it ' +
          '(economy lie) or bypasses getEffectiveMainStatCap. Route through ' +
          'an enumerated channel or extend the allowlist with its contract.',
      ).toEqual([])
    },
  )

  it(
    'allowlisted files stay the only writers (allowlist drift check)',
    { timeout: SCAN_TIMEOUT },
    () => {
      const { violations } = collectOffenders()
      expect(
        violations.length,
        'An allowlisted authority file lost its baseStats write - the ' +
          'channel moved; update the contract, do not leave a stale entry.',
      ).toBeGreaterThan(0)
    },
  )
})
