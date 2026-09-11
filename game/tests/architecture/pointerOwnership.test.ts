/**
 * Guard (V3) — canvas-side pointer input stays a declared, short list.
 *
 * Spec: docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md
 * §3.5 and §7.
 *
 * §3.5 does NOT say the DOM receives every pointer event — an earlier draft did,
 * and it was wrong: a world-anchored icon should be hit-tested where its
 * geometry lives, which is the canvas. So this guard is not a prohibition. It is
 * an allowlist, and its job is to make each canvas-side interaction a decision
 * somebody wrote down rather than one that accumulated.
 *
 * Measured at authoring time (2026-09-11), Phaser took pointer input at exactly
 * one site in the whole tree. Adding a second is allowed; adding one without
 * editing this list is not.
 *
 * Scope limit: source-shaped. A handler registered through a variable
 * (`obj[name](...)`) or inside a helper that takes the event name as an argument
 * would slip past it.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { SCAN_TIMEOUT, srcCorpus } from './helpers/scanTs'

const SRC_DIR = join(process.cwd(), 'src')

/**
 * Files under `src/game/` that may take pointer input, each with the reason.
 * Paths are relative to `src/`.
 */
const ALLOWLIST: Record<string, string> = {
  'game/scenes/combat/combat-vfx-spawner.ts':
    'Status icon tooltip. World-anchored, so the canvas owns its geometry and ' +
    'therefore its hit-test (spec §6/V3). Moving only the tooltip RENDERING to ' +
    'the DOM is an open, deferred follow-up.',
}

const GAME_FILES = srcCorpus(SRC_DIR).filter(
  (file) => file.fromSrc.startsWith('game/') && !file.fromSrc.endsWith('.test.ts'),
)

/** `setInteractive(`, or an `on('pointer…')` / `once('pointer…')` subscription. */
const TAKES_POINTER = /\bsetInteractive\s*\(|\b(?:on|once)\s*\(\s*['"]pointer\w*['"]/

describe('pointer ownership', () => {
  it(
    'has files to police — a guard over an empty corpus proves nothing',
    () => {
      expect(GAME_FILES.length).toBeGreaterThan(20)
    },
    SCAN_TIMEOUT,
  )

  it(
    'only allowlisted files under src/game/ take pointer input',
    () => {
      const offenders = GAME_FILES.filter((file) => TAKES_POINTER.test(file.text))
        .map((file) => file.fromSrc)
        .filter((path) => !(path in ALLOWLIST))

      expect(offenders).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'every allowlist entry is still a real one',
    () => {
      // An allowlist that outlives its reason is worse than none: it reads as
      // permission that was examined, when nobody has looked in months.
      const stale = Object.keys(ALLOWLIST).filter((path) => {
        const file = GAME_FILES.find((candidate) => candidate.fromSrc === path)

        return !file || !TAKES_POINTER.test(file.text)
      })

      expect(stale).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'each allowlist entry carries a reason, not just a path',
    () => {
      const unexplained = Object.entries(ALLOWLIST)
        .filter(([, reason]) => reason.trim().length < 40)
        .map(([path]) => path)

      expect(unexplained).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
