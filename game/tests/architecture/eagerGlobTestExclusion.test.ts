import { describe, expect, it } from 'vitest'

// Eager-glob duplicate-registration guard (test-workload remediation
// phase 1, audit defect class: -483 accidental case executions).
//
// Defect: `import.meta.glob('<dir>/**/*.ts', { eager: true })` inside a
// test file eagerly EXECUTES every matched `*.test.ts` module during
// collection, re-registering each foreign suite inside the importer's
// file. A `path.endsWith('.test.ts')` continue inside the loop cannot
// prevent it - registration already happened at import time. The fix is
// a negation in the glob itself (LegacySkillCoverage.test.ts precedent):
//   ['../../data/**/*.ts', '!../../data/**/*.test.ts']
//
// This guard scans every gated test file's SOURCE (via `?raw` glob - raw
// text never executes, so the scan itself cannot re-register anything)
// and fails when an `eager: true` glob call contains a positive pattern
// whose final segment can incidentally match `*.test.ts` (i.e. a `*`
// immediately before the `.ts` suffix: `*.ts`, `TheTu*.ts`, ...) without
// a `*.test.ts` negation covering the SAME glob root in the same call.
// A negation rooted elsewhere (e.g. `!../../data/**` while the positive
// is `../../src/data/**`) does not exclude the positive's test files.

const TEST_FILE_SOURCES = import.meta.glob(
  ['../../src/**/*.test.ts', '../../tests/**/*.test.ts'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

const GLOB_CALL_RE = /import\.meta\.glob\s*\(([\s\S]*?)\)/g
const EAGER_RE = /\beager\s*:\s*true\b/
const QUOTED_RE = /'([^'\n]*)'|"([^"\n]*)"/g

// Blanks out comments and string literals (replaced by spaces, offsets
// preserved) so `import.meta.glob(...)` text inside a comment or a plain
// string is never mistaken for a real call.
function sanitizeSource(source: string): string {
  const out = source.split('')
  let i = 0
  const n = out.length
  const blank = (a: number, b: number) => {
    for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < n) {
    const c = out[i]!
    const next = out[i + 1]
    if (c === '/' && next === '/') {
      let j = i + 2
      while (j < n && out[j] !== '\n') j++
      blank(i, j)
      i = j
    } else if (c === '/' && next === '*') {
      let j = i + 2
      while (j < n - 1 && !(out[j] === '*' && out[j + 1] === '/')) j++
      blank(i, Math.min(j + 2, n))
      i = Math.min(j + 2, n)
    } else if (c === "'" || c === '"' || c === '`') {
      const quote = c
      let j = i + 1
      while (j < n && out[j] !== quote) {
        if (out[j] === '\\') j++
        j++
      }
      blank(i, Math.min(j + 1, n))
      i = Math.min(j + 1, n)
    } else {
      i++
    }
  }
  return out.join('')
}

function lastSegment(pattern: string): string {
  return pattern.slice(pattern.lastIndexOf('/') + 1)
}

// True when the pattern's last segment can match some `*.test.ts` name:
// it must end with `.ts`, not already require `.test.ts`, and the part
// after the last `*` must be exactly `.ts` so the wildcard can swallow a
// `.test` infix (`TheTu*.ts` matches `TheTuAnNodes.test.ts`; `*Kit.ts`
// cannot match `X.test.ts` and is not flagged).
function canMatchTestFiles(segment: string): boolean {
  const star = segment.lastIndexOf('*')
  if (star === -1) return false
  return segment.slice(star + 1) === '.ts' && !segment.endsWith('.test.ts')
}

// The directory root of a glob pattern: everything before the first `*`.
function globRoot(pattern: string): string {
  const star = pattern.indexOf('*')
  return star === -1 ? pattern : pattern.slice(0, star)
}

// A negation covers a positive when it targets `*.test.ts` AND its root
// is the same directory or a parent of the positive's root. Root compare
// keeps `!../../data/**` from "covering" `../../src/data/**`.
function negationCovers(positive: string, negation: string): boolean {
  if (!negation.startsWith('!') || !negation.endsWith('.test.ts')) return false
  const nRoot = globRoot(negation.slice(1))
  return globRoot(positive).startsWith(nRoot)
}

interface EagerGlobFinding {
  file: string
  call: string
}

function analyzeSource(source: string): string[] {
  const sanitized = sanitizeSource(source)
  const badCalls: string[] = []

  for (const match of sanitized.matchAll(GLOB_CALL_RE)) {
    const callStart = match.index ?? 0
    const args = match[1]!
    if (!EAGER_RE.test(args)) continue

    // Re-run pattern extraction on the RAW call text: patterns live inside
    // quotes, which sanitizeSource blanked, so use the original source.
    const rawCall = source.slice(callStart, callStart + match[0].length)
    const patterns = [...rawCall.matchAll(QUOTED_RE)].map((m) => m[1] ?? m[2]!)

    const uncovered = patterns.some(
      (positive) =>
        !positive.startsWith('!') &&
        canMatchTestFiles(lastSegment(positive)) &&
        !patterns.some((n) => negationCovers(positive, n)),
    )
    if (uncovered) badCalls.push(rawCall.replace(/\s+/g, ' '))
  }

  return badCalls
}

function collectFindings(): EagerGlobFinding[] {
  const findings: EagerGlobFinding[] = []
  for (const [path, source] of Object.entries(TEST_FILE_SOURCES)) {
    for (const call of analyzeSource(source)) {
      findings.push({ file: path, call })
    }
  }
  return findings
}

describe('eager-glob test-exclusion guard', () => {
  it('no eager import.meta.glob in a test file can match *.test.ts without a covering negation', () => {
    const findings = collectFindings()
    expect(
      findings.map((f) => `${f.file}: ${f.call}`),
      'eager glob can import test modules as data - add a !<same-root>/**/*.test.ts negation pattern ' +
        '(precedent: src/core/skilldef/LegacySkillCoverage.test.ts)',
    ).toEqual([])
  })

  describe('invariant: each risky positive needs a same-root *.test.ts negation', () => {
    const wrap = (patterns: string[]) =>
      `const m = import.meta.glob([${patterns.map((p) => `'${p}'`).join(', ')}], { eager: true })`

    it('PASS: positive + same-root negation', () => {
      expect(analyzeSource(wrap(['../../src/data/**/*.ts', '!../../src/data/**/*.test.ts']))).toEqual([])
    })

    it('PASS: negation rooted at a parent directory also covers', () => {
      expect(analyzeSource(wrap(['../../src/data/**/*.ts', '!../../src/**/*.test.ts']))).toEqual([])
    })

    it('FAIL: wrong-root negation (the Phase-1 mis-fix shape)', () => {
      expect(
        analyzeSource(wrap(['../../src/data/**/*.ts', '!../../data/**/*.test.ts'])).length,
      ).toBeGreaterThan(0)
    })

    it('FAIL: unrelated-directory negation', () => {
      expect(
        analyzeSource(wrap(['../../src/data/**/*.ts', '!../../foo/**/*.test.ts'])).length,
      ).toBeGreaterThan(0)
    })

    it('FAIL: risky positive with no negation at all', () => {
      expect(analyzeSource(wrap(['../../src/data/**/*.ts'])).length).toBeGreaterThan(0)
    })

    it('FAIL: two risky positives, only one covered', () => {
      expect(
        analyzeSource(
          wrap(['../../src/data/**/*.ts', '../../other/**/*.ts', '!../../src/data/**/*.test.ts']),
        ).length,
      ).toBeGreaterThan(0)
    })
  })

  it('ignores import.meta.glob text inside comments and strings', () => {
    const source = [
      '// const m = import.meta.glob(\'../../x/**/*.ts\', { eager: true })',
      '/* const m = import.meta.glob(\'../../x/**/*.ts\', { eager: true }) */',
      'const doc = "import.meta.glob(\'../../x/**/*.ts\', { eager: true })"',
      'const tpl = `import.meta.glob(\'../../x/**/*.ts\', { eager: true })`',
    ].join('\n')
    expect(analyzeSource(source)).toEqual([])
  })

  it('does not flag non-eager or non-risky globs', () => {
    const source = [
      'const a = import.meta.glob(\'../../x/**/*.ts\', { eager: false })',
      'const b = import.meta.glob([\'../../x/**/*Kit.ts\', \'../../x/**/*.test.ts\'], { eager: true })',
      'const c = import.meta.glob(\'../../x/**/*.png\', { eager: true })',
    ].join('\n')
    expect(analyzeSource(source)).toEqual([])
  })
})
