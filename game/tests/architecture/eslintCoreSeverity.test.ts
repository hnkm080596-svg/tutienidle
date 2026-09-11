/**
 * R14.1a guard (AR-33) — effective ESLint severity for `src/core/**`.
 *
 * Mission 0 AR-33 evidence: the later `src/**` rule block in eslint.config.js
 * matches the same files as the earlier `src/core/**` block and downgrades
 * `@typescript-eslint/no-explicit-any` / `no-unused-vars` from 'error' back
 * to 'warn' — so the stricter core rules were never effective. This guard
 * lints real probe strings through the actual ESLint resolution (flat-config
 * merge included) and asserts the EFFECTIVE severity, so a future re-overlap
 * fails the suite even if `npm run lint` is not a CI gate.
 *
 * Guard rule (R14 charter): enforcement asserts effective behavior, never
 * the declared configuration.
 */
import { describe, expect, it } from 'vitest'
import { loadESLint } from 'eslint'

interface LintMessage {
  ruleId: string | null
  severity: 1 | 2
}

interface LintResult {
  messages: LintMessage[]
}

async function lintProbe(code: string, filePath: string): Promise<LintResult[]> {
  // loadESLint() resolves the flat-config ESLint class itself (not a module
  // object) in ESLint 9+/10.
  const FlatESLint = (await loadESLint()) as unknown as new (opts: {
    cwd: string
  }) => { lintText: (c: string, o: { filePath: string }) => Promise<LintResult[]> }
  const eslint = new FlatESLint({ cwd: process.cwd() })
  return eslint.lintText(code, { filePath })
}

function severityOf(results: LintResult[], ruleId: string): 0 | 1 | 2 {
  for (const result of results) {
    const hit = result.messages.find((m) => m.ruleId === ruleId)
    if (hit) return hit.severity
  }
  return 0
}

const ANY_PROBE = 'export function probe(): any {\n  return null\n}\n'

describe('R14.1a — AR-33: declared core lint severity is the effective one', () => {
  // ESLint + vue-tsc plugin resolution is heavyweight (~2-4s standalone,
  // more under full-suite load); the suite default 5s is not enough.
  const LINT_GUARD_TIMEOUT = 60_000

  it('no-explicit-any is an ERROR (severity 2) for src/core files', { timeout: LINT_GUARD_TIMEOUT }, async () => {
    const results = await lintProbe(ANY_PROBE, 'src/core/probe.ts')
    // severity 2 = error, 1 = warn, 0 = rule did not fire
    expect(severityOf(results, '@typescript-eslint/no-explicit-any')).toBe(2)
  })

  it('no-explicit-any stays a WARNING (severity 1) outside core — core must be stricter, not equal or looser', { timeout: LINT_GUARD_TIMEOUT }, async () => {
    const results = await lintProbe(ANY_PROBE, 'src/composables/probe.ts')
    expect(severityOf(results, '@typescript-eslint/no-explicit-any')).toBe(1)
  })
})
