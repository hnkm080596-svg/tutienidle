/**
 * R14 guard (R11/AR-29 scene-helper ownership contract).
 *
 * The three rendering mechanisms named by AR-29 must own their state and
 * take narrow host capabilities — never the full `CombatScene`:
 *
 * - `combat-cast-bar.ts`      — owns `castBarsMap`, takes `CastBarHost`.
 * - `combat-position-interpolation.ts` — owns `interpolationsMap`, takes
 *   only a `now()` clock.
 * - `combat-telegraph.ts`     — owns target/shown/segment/snapshotAt, takes
 *   `TelegraphHost` (clock + read-only handle map).
 *
 * The regression class: a helper that imports or references `CombatScene`
 * can reach every scene member — the "extracted but still coupled" shape
 * AR-29 calls out. Conversely, the scene must not re-declare the telegraph
 * chase fields the module now owns.
 *
 * Deliberately scoped to the three named helpers: coordinators like
 * combat-snapshot-reconcile still legitimately take the scene — they drive
 * several owners at once, which is their job.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs } from './helpers/scanTs'

const COMBAT_DIR = join(process.cwd(), 'src/game/scenes/combat')

const NARROW_HELPERS = [
  'combat-cast-bar.ts',
  'combat-position-interpolation.ts',
  'combat-telegraph.ts',
]

/** Strip line + block comments so historical references don't false-positive. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('R14 — AR-29 scene helpers take narrow host contracts', () => {
  for (const file of NARROW_HELPERS) {
    it(`${file} never touches the full CombatScene`, () => {
      const source = stripComments(readTs(join(COMBAT_DIR, file)))

      expect(
        source.includes('CombatScene'),
        `${file} references CombatScene — AR-29 helpers take narrow host interfaces only`,
      ).toBe(false)
    })
  }

  it('combat-telegraph.ts owns its chase state (no host.telegraph* writes)', () => {
    const source = readTs(join(COMBAT_DIR, 'combat-telegraph.ts'))

    expect(
      /host\.(telegraph|target|shown|segment|snapshotAt)/.test(source),
      'combat-telegraph writes chase state onto its host — the state moved into the module',
    ).toBe(false)
    expect(source.includes('private targetValue')).toBe(true)
    expect(source.includes('private shownValue')).toBe(true)
    expect(source.includes('private segment')).toBe(true)
  })

  it('CombatScene.ts does not re-declare the module-owned telegraph fields', () => {
    const scene = readTs(join(process.cwd(), 'src/game/scenes/CombatScene.ts'))

    expect(
      /telegraph(Segment|SnapshotAt)/.test(scene),
      'CombatScene re-declares telegraphSegment/telegraphSnapshotAt — owned by combat-telegraph.ts',
    ).toBe(false)
    // Field-style writable declarations of the passthroughs would bypass the
    // module-owned state (the getters are the allowed read path).
    expect(/^\s*telegraph(Target|Shown)\s*=/m.test(scene)).toBe(false)
  })
})
