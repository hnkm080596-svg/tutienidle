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
// a `*.test.ts` negation in the same call.

const TEST_FILE_SOURCES = import.meta.glob(
  ['../../src/**/*.test.ts', '../../tests/**/*.test.ts'],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>

const GLOB_CALL_RE = /import\.meta\.glob\s*\(([\s\S]*?)\)/g
const EAGER_RE = /\beager\s*:\s*true\b/
const QUOTED_RE = /'([^'\n]*)'|"([^"\n]*)"/g

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

interface EagerGlobFinding {
  file: string
  call: string
}

function collectFindings(): EagerGlobFinding[] {
  const findings: EagerGlobFinding[] = []

  for (const [path, source] of Object.entries(TEST_FILE_SOURCES)) {
    for (const match of source.matchAll(GLOB_CALL_RE)) {
      const args = match[1]!
      if (!EAGER_RE.test(args)) continue

      const patterns = [...args.matchAll(QUOTED_RE)].map((m) => m[1] ?? m[2]!)
      const risky = patterns.some(
        (p) => !p.startsWith('!') && canMatchTestFiles(lastSegment(p)),
      )
      const hasNegation = patterns.some((p) => p.startsWith('!') && p.endsWith('.test.ts'))

      if (risky && !hasNegation) {
        findings.push({ file: path, call: match[0].replace(/\s+/g, ' ') })
      }
    }
  }

  return findings
}

describe('eager-glob test-exclusion guard', () => {
  it('no eager import.meta.glob in a test file can match *.test.ts without a negation', () => {
    const findings = collectFindings()
    expect(
      findings.map((f) => `${f.file}: ${f.call}`),
      'eager glob can import test modules as data - add a !**/*.test.ts negation pattern ' +
        '(precedent: src/core/skilldef/LegacySkillCoverage.test.ts)',
    ).toEqual([])
  })
})
