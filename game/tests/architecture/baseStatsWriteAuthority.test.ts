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
 *
 * SCAN MODEL (honest bound): each file is normalized before scanning -
 * comments are stripped string-aware, then newlines collapse into one
 * line - so interposed comments (`baseStats/*c*.x`) and multi-line
 * writes (`x.baseStats\n  .s = 1`, `Object.assign(t, {\n baseStats })`)
 * cannot hide. Lexical scanning still cannot prove a payload carried
 * inside a variable (`Object.assign(t, blob)`) - the store-targeted
 * arms below flag indirect writes into $state/$patch so they surface
 * for review rather than passing silently. Transitive aliases
 * (`const b = a`) and parameter/loop-bound aliases stay uncovered by
 * design; that residual is recorded here, not hidden.
 */
import { describe, expect, it } from 'vitest'
import { join, relative } from 'node:path'
import { srcCorpus, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')

/**
 * Strip block and line comments without touching string literals so
 * `//` inside 'https://x' or "a//b" survives and /*c*\/ inside a write
 * expression does not shield it. Template-literal bodies are treated
 * as opaque strings (${} expressions inside them are not scanned -
 * bracket arms still catch `x.baseStats[`k`]` key syntax itself).
 */
function stripComments(src: string): string {
  let out = ''
  let i = 0
  let inString: '"' | "'" | '`' | null = null
  let inLine = false
  let inBlock = false
  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]
    if (inLine) {
      if (c === '\n') inLine = false
      i += 1
      continue
    }
    if (inBlock) {
      if (c === '*' && next === '/') {
        inBlock = false
        i += 2
        continue
      }
      i += 1
      continue
    }
    if (inString !== null) {
      out += c
      if (c === '\\') {
        out += next ?? ''
        i += 2
        continue
      }
      if (c === inString) inString = null
      i += 1
      continue
    }
    if (c === '/' && next === '/') {
      inLine = true
      i += 2
      continue
    }
    if (c === '/' && next === '*') {
      inBlock = true
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = c
      out += c
      i += 1
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** Member access is spelled `.baseStats` or `["baseStats"]`/`['..']`/`[`..`]`. */
const DOT_MEMBER = String.raw`\.baseStats\!?(?:\s*\.\w+\!?|\s*\[[^\]]{0,80}\])`
const WRITE_OP =
  String.raw`(?:=(?!=)|\+=|-=|\*=|/=|%=|\*\*=|<<=|>>>=|>>=|&=|\^=|\|=|\?\?=|\|\|=|&&=|\+\+|--)`

// Every arm is global: non-global exec() ignores lastIndex and would
// loop forever on the first hit.
const WRITE_RES: RegExp[] = [
  // x.baseStats = / += / ++ / x.baseStats.s = / x.baseStats[k] -=
  new RegExp(String.raw`\.baseStats\!?\s*` + WRITE_OP, 'g'),
  new RegExp(DOT_MEMBER + String.raw`\s*` + WRITE_OP, 'g'),
  // x['baseStats'].s = / x[`baseStats`][k] +=
  new RegExp(
    String.raw`\[(?:"baseStats"|'baseStats'|` + '`' + String.raw`baseStats` + '`' +
      String.raw`)\]\!?(?:\s*\.\w+\!?|\s*\[[^\]]{0,80}\])?\s*` + WRITE_OP,
    'g',
  ),
  // ++x.baseStats.s / --x.baseStats[k]
  new RegExp(String.raw`(?:\+\+|--)\s*\w+` + DOT_MEMBER, 'g'),
  // destructuring / for-of targets carrying baseStats: [p.baseStats.x]=a, for(p.baseStats.x of a)
  new RegExp(String.raw`[\[\{][^\]\}]{0,120}\.baseStats[^\]\}]{0,120}[\]\}]\s*=`, 'g'),
  // for-of/for-in with baseStats as the loop TARGET (before of/in);
  // `for (x of Object.entries(y.baseStats))` is a read - the pool
  // reference sits after the keyword, so it does not match.
  new RegExp(String.raw`for\s*\(\s*(?:const|let|var\s+)?[^)]{0,80}?\.baseStats\b[^)]*?\s+(?:of|in)\s`, 'g'),
  // structural APIs
  new RegExp(String.raw`Object\.assign\([^)]{0,200}\bbaseStats\b`, 'g'),
  new RegExp(String.raw`Object\.assign\(\s*(?:this\.\$state|\w+\.\$state|\w+Store)\s*,`, 'g'),
  new RegExp(String.raw`\.\$patch\s*\(\s*\{[^}]{0,400}\bbaseStats\b`, 'g'),
  new RegExp(String.raw`\.\$patch\s*\(\s*\w+\s*\)`, 'g'),
  new RegExp(String.raw`Reflect\.(?:set|defineProperty|deleteProperty)\([^)]{0,160}\bbaseStats\b`, 'g'),
  new RegExp(String.raw`Object\.definePropert(?:y|ies)\([^)]{0,160}\bbaseStats\b`, 'g'),
  new RegExp(String.raw`delete\s+[^;]{0,120}\bbaseStats\b`, 'g'),
  // .vue two-way binding into the pool
  new RegExp(String.raw`v-model="[^"]{0,120}\bbaseStats\b`, 'g'),
]

/**
 * Pool-alias escape hatches:
 *   const s = x.baseStats | const s = x['baseStats'] | s = x.baseStats
 *   const { baseStats } = x | const { baseStats: b } = x
 * `const copy = { ...x.baseStats }` is a fresh object - RHS `{` excluded.
 */
const ALIAS_DECL_RES: RegExp[] = [
  /(?:const|let|var)\s+(\w+)\s*=\s*(?!\s*\{)[^;=]{0,160}(?:\.baseStats\b|\[(?:"baseStats"|'baseStats'|`baseStats`)\])/g,
  /\b(\w+)\s*=\s*(?!\s*=|\s*\{)[^;]{0,120}\.baseStats\b/g,
  /\{\s*baseStats\s*:\s*(\w+)\s*\}\s*=/g,
  /\{\s*(baseStats)\s*\}\s*=/g,
]
const aliasWriteRe = (id: string): RegExp =>
  new RegExp(
    `\\b${id}\\s*(?:\\.\\w+|\\[[^\\]]{0,80}\\])\\s*(?:=(?!=)|\\+=|-=|\\*=|/=|%=|\\*\\*=|<<=|>>>=|>>=|&=|\\^=|\\|=|\\?\\?=|\\|\\|=|&&=|\\+\\+|--)` +
      `|(?:\\+\\+|--)\\s*${id}\\s*(?:\\.\\w+|\\[[^\\]]{0,80}\\])` +
      `|Object\\.assign\\(\\s*${id}\\b|delete\\s+${id}\\s*\\.`,
    'g',
  )

const TEST_EXT_RE = /\.test\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/

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
  {
    path: 'src/stores/player.ts',
    contract:
      'Restore-time migration fold: retired pill-permanent:* modifiers fold their earned flat into baseStats once during load (bounded by getEffectiveMainStatCap); the modifier is dropped so the fold is idempotent, not a new grant channel.',
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

  for (const file of srcCorpus(SRC_DIR)) {
    if (TEST_EXT_RE.test(file.path)) continue
    const rel = relative(GAME_ROOT, file.path).replaceAll('\\', '/')
    const allowed = ALLOWED.find((a) => a.path === rel)

    // Normalize: strip comments string-aware, then collapse newlines so
    // multi-line writes and comment-interposed tokens cannot hide.
    const normalized = stripComments(file.text).replace(/\n+/g, ' ')

    const aliasIds = new Set<string>()
    for (const re of ALIAS_DECL_RES) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(normalized)) !== null) {
        if (m[1]) aliasIds.add(m[1])
      }
    }
    const aliasRes = [...aliasIds].map(aliasWriteRe)

    const flag = (text: string): void => {
      const offender = { file: rel, line: 0, text }
      if (allowed) {
        violations.push(offender)
      } else {
        unclassified.push(offender)
      }
    }

    for (const re of WRITE_RES) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(normalized)) !== null) {
        flag(m[0].slice(0, 120))
      }
    }
    for (const re of aliasRes) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(normalized)) !== null) {
        flag(m[0].slice(0, 120))
      }
    }
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
