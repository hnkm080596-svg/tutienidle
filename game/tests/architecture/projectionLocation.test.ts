/**
 * Guard (V7) — grid projection is a PRESENTATION asset, not a Phaser one.
 *
 * Spec: docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md
 * §2.2 and §6/V7.
 *
 * The canvas draws with the projection and the DOM must hit-test with it, so
 * under §3.4 it cannot live in either layer: a DOM overlay importing from
 * `src/game/` would be the static layer reaching into the dynamic one. It lives
 * in `src/presentation/geometry/`, and this pins it there.
 *
 * Real violation at authoring time (2026-09-11): `BattleGridProjection.ts` and
 * `BattlefieldRenderMode.ts` were in `src/game/support/`, with nine consumers
 * importing them from there.
 *
 * Note on the corpus: `listAllTs` covers `.ts` only, and a `.vue` SFC can
 * import just as well, so the third check walks `.vue` separately. If a later
 * guard needs the same, that walk is worth lifting into `helpers/scanTs.ts`.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { listAllTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')
const GAME_DIR = join(SRC_DIR, 'game')
const GEOMETRY_DIR = join(SRC_DIR, 'presentation', 'geometry')

/** Reported paths stay relative to src/ and slash-separated, so failures read. */
function fromSrc(file: string): string {
  return relative(SRC_DIR, file).split(sep).join('/')
}

function listVue(dir: string): string[] {
  const out: string[] = []

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      out.push(...listVue(full))
    } else if (entry.endsWith('.vue')) {
      out.push(full)
    }
  }

  return out
}

// Walked ONCE at module scope, not per assertion. These guards run inside the
// full suite alongside r14's eslint-shelling guards, which sit close to their
// 60s budget under worker contention; three redundant tree walks are a cost
// with no benefit.
const ALL_TS = listAllTs(SRC_DIR)
const ALL_VUE = listVue(SRC_DIR)
const GAME_TS = ALL_TS.filter((file) => file.startsWith(GAME_DIR + sep))

describe('projection lives in presentation/geometry', () => {
  it(
    'no module under src/game/ defines a grid projection',
    () => {
      // A definition, not a use: the class, the factory, or the interface.
      // Renaming the class alone is still caught by the factory clause, and
      // vice versa — a single-clause grep would slip past a rename.
      const definesProjection =
        /(?:class\s+\w*GridProjection\b|export\s+function\s+createBattleGridProjection\b|export\s+interface\s+BattleGridProjection\b)/

      const offenders = GAME_TS.filter((file) => definesProjection.test(readTs(file)))

      expect(offenders.map(fromSrc)).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it(
    'the projection modules are exactly where the spec puts them',
    () => {
      const homes = ALL_TS.filter(
        (file) =>
          /(?:BattleGridProjection|BattlefieldRenderMode)\.ts$/.test(file) &&
          !file.endsWith('.test.ts'),
      )

      expect(homes.map(fromSrc).sort()).toEqual([
        'presentation/geometry/BattleGridProjection.ts',
        'presentation/geometry/BattlefieldRenderMode.ts',
      ])
    },
    SCAN_TIMEOUT,
  )

  it(
    'nothing still imports the projection from its old home',
    () => {
      const stale =
        /from\s+'(?:@\/game\/support|\.{1,2}(?:\/[\w.-]+)*)\/(?:BattleGridProjection|BattlefieldRenderMode)'/

      const offenders = [...ALL_TS, ...ALL_VUE]
        .filter((file) => !file.startsWith(GEOMETRY_DIR))
        .filter((file) => stale.test(readFileSync(file, 'utf8')))

      expect(offenders.map(fromSrc)).toEqual([])
    },
    SCAN_TIMEOUT,
  )
})
