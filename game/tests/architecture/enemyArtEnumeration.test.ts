/**
 * R14 guard (R12/AR-30 enemy-art enumeration ownership).
 *
 * `MORTAL_ENEMY_TEMPLATE_IDS` in `src/game/support/EnemyArt.ts` is the single
 * canonical enumeration of mortal enemy template art. Both consumers —
 * `CombatPreload` (transitional preload net) and
 * `CombatPresentationCatalogue` (animation presentation catalogue) — must
 * import it rather than declare their own copy. The defect this protects:
 * three identical 20-entry id lists drifting apart when a new enemy is
 * added (preload loads a texture the catalogue never presents, or the
 * reverse).
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs } from './helpers/scanTs'
import { MORTAL_ENEMY_TEMPLATE_IDS } from '@/game/support/EnemyArt'

const SRC = join(process.cwd(), 'src')

const CONSUMERS = [
  'game/support/CombatPreload.ts',
  'presentation/art/CombatPresentationCatalogue.ts',
]

describe('R14 — mortal enemy template ids have one canonical owner', () => {
  it('EnemyArt.ts declares the canonical list once', () => {
    expect(MORTAL_ENEMY_TEMPLATE_IDS.length).toBeGreaterThan(0)
    expect(new Set(MORTAL_ENEMY_TEMPLATE_IDS).size).toBe(MORTAL_ENEMY_TEMPLATE_IDS.length)
  })

  for (const rel of CONSUMERS) {
    it(`${rel} consumes MORTAL_ENEMY_TEMPLATE_IDS and declares no id literals`, () => {
      const source = readTs(join(SRC, rel))

      expect(
        source.includes('MORTAL_ENEMY_TEMPLATE_IDS'),
        `${rel} must consume MORTAL_ENEMY_TEMPLATE_IDS from EnemyArt`,
      ).toBe(true)

      const literalIds = MORTAL_ENEMY_TEMPLATE_IDS.filter(
        (id) => source.includes(`'${id}'`) || source.includes(`"${id}"`),
      )

      expect(
        literalIds,
        `${rel} re-declares ${literalIds.length} template id(s) — the list belongs to EnemyArt only`,
      ).toEqual([])
    })
  }
})
