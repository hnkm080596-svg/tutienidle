/**
 * Pill grant-channel funnel guard (ruling 2026-09-29, follow-up).
 *
 * PillSystem.useProfessionPill is the baseStats pill authority, but it
 * is a stateless public method: calling it directly mints stats with
 * zero gates - no bag ownership/consumption, no realm check, no
 * in_battle refusal, no cap preflight. Every semantic gate lives in
 * GameManagerPillOps.usePillDetailed, which is the ONLY sanctioned
 * production caller. This guard pins that funnel: a production file
 * invoking useProfessionPill outside the ops wrapper is a violation.
 *
 * Same lexical-scan bound as baseStatsWriteAuthority.test.ts: comments
 * are stripped and newlines collapsed before matching. Test/simulation
 * files are out of scope (they drive the authority directly to verify
 * it). player.ts is allowlisted in the write guard for the restore
 * fold only - it must not call the grant API either.
 */
import { describe, expect, it } from 'vitest'
import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'
import { srcCorpus, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')

const TEST_EXT_RE = /\.test\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/

// The ops wrapper is the single sanctioned production caller; the
// system file holds the definition itself.
const ALLOWED_CALLERS = new Set([
  'src/core/game/GameManagerPillOps.ts',
  'src/core/pill/PillSystem.ts',
])

const CALL_RE = /\buseProfessionPill\s*\(/g

const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^'"`:])\/\/.*/g, '$1')

describe('pill grant channel - ops wrapper is the only production caller', () => {
  it(
    'no production file invokes useProfessionPill outside GameManagerPillOps',
    { timeout: SCAN_TIMEOUT },
    () => {
      const offenders: string[] = []
      for (const file of srcCorpus(SRC_DIR)) {
        if (TEST_EXT_RE.test(file.path)) continue
        const rel = relative(GAME_ROOT, file.path).replaceAll('\\', '/')
        if (ALLOWED_CALLERS.has(rel)) continue
        const text = readFileSync(file.path, 'utf8')
        const normalized = stripComments(text).replace(/\n+/g, ' ')
        CALL_RE.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = CALL_RE.exec(normalized)) !== null) {
          offenders.push(`${rel}: ${m[0]}`)
        }
      }
      expect(
        offenders,
        'A production file called PillSystem.useProfessionPill directly - ' +
          'that mints baseStats with zero ownership/realm/battle/cap gates. ' +
          'Go through GameManagerPillOps.usePillDetailed.',
      ).toEqual([])
    },
  )
})
