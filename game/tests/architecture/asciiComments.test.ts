/**
 * P15 ratchet guard (Mission D/E/F cross-mission finding, 2026-09-19):
 * comments in .ts/.vue/.js/.mjs/.cjs must be plain ASCII - no NEW
 * non-ASCII comment may enter the codebase. String literals, i18n
 * messages and user-facing text are exempt by P15 and are never
 * scanned: the TypeScript tokenizer yields only real comment tokens.
 *
 * Legacy violations are pinned in baselines/asciiComments.json
 * (regenerate with `node scripts/p15-baseline.mjs` after cleaning
 * comments). A file may only SHRINK its list - any violation text not
 * recorded there fails the suite, which is what makes P15 an
 * executable protection rule instead of prose.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { listSourceFiles, scanCommentViolations } from './helpers/asciiComments'
import { SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const BASELINE_PATH = join(GAME_ROOT, 'tests', 'architecture', 'baselines', 'asciiComments.json')

describe('P15 - comments stay ASCII (ratchet)', () => {
  it(
    'no comment token carries non-ASCII beyond the recorded baseline',
    { timeout: SCAN_TIMEOUT },
    () => {
      const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, string[]>
      const offenders: string[] = []

      for (const file of listSourceFiles(GAME_ROOT)) {
        const rel = relative(GAME_ROOT, file).split(sep).join('/')
        // Multiset semantics: each recorded violation is consumed once,
        // so duplicating an existing violation still counts as new.
        const allowed = [...(baseline[rel] ?? [])]
        for (const text of scanCommentViolations(file)) {
          const idx = allowed.indexOf(text)
          if (idx < 0) {
            offenders.push(`${rel}: ${text.slice(0, 100)}`)
          } else {
            allowed.splice(idx, 1)
          }
        }
      }

      expect(
        offenders,
        'P15 violation: new non-ASCII comments. Keep comments plain ' +
          'ASCII English (no em dashes/arrows/Vietnamese in .ts/.vue/.js ' +
          'comments); Vietnamese belongs in i18n/UI strings and docs.',
      ).toEqual([])
    },
  )
})
