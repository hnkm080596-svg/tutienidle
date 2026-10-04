import { describe, expect, it } from 'vitest'

import { ENEMIES } from './Enemies'
import { STAGES } from '../stage/Stages'

/**
 * Cheap balance invariant (docs/balance/enemies-review.md, 2026-10-04):
 * the chapter-normal species is the wall a fresh-realm player faces on
 * floor 1, so its EHP/damage jump over the previous chapter's normal
 * must stay inside a bounded ratio - the authored difficulty ramp is
 * the enemy-count ladder + eliteChance, not species strength.
 *
 * History: foundation_spirit_wolf shipped at formula tier 4 (684 hp /
 * 64 might) = 5.3x hp / 4.9x might over the qi normal (bandit 130/13),
 * which made every foundation floor an unkillable wall for an honest
 * Truc Co kit. Retuned to 190/30/15 = 1.46x / 2.31x.
 *
 * Ratios measured against normalized template stats (post-spawn
 * multipliers like elite x2.5 / boss x7 stay runtime modifiers).
 */
const REALM_JUMP_HP_CAP = 3
const REALM_JUMP_MIGHT_CAP = 3.5

function chapterNormal(realmId: string): string {
  const stage = STAGES.find(
    (entry) =>
      entry.requiredRealmId === realmId &&
      entry.floor === 1 &&
      entry.enemyPool.length === 1 &&
      !entry.bossEnemyId,
  )
  if (!stage) throw new Error(`no normal floor-1 stage found for realm ${realmId}`)
  const entry = stage.enemyPool[0]
  if (!entry) throw new Error(`floor-1 pool empty for realm ${realmId}`)
  return entry.enemyId
}

function normalStats(realmId: string): { maxHp: number; might: number } {
  const template = ENEMIES.find((entry) => entry.id === chapterNormal(realmId))
  if (!template) throw new Error(`roster normal for ${realmId} missing in ENEMIES`)
  return { maxHp: template.stats.maxHp, might: template.stats.might }
}

describe('enemy realm-jump invariant', () => {
  const order: Array<[string, string]> = [
    ['mortal', 'qi_refining'],
    ['qi_refining', 'foundation_establishment'],
  ]

  it.each(order)(
    '%s -> %s normal stays inside the realm-jump budget',
    (previousRealm, nextRealm) => {
      const previous = normalStats(previousRealm)
      const next = normalStats(nextRealm)
      const hpRatio = next.maxHp / previous.maxHp
      const mightRatio = next.might / previous.might

      expect(hpRatio).toBeGreaterThan(1)
      expect(mightRatio).toBeGreaterThan(1)
      expect(hpRatio).toBeLessThanOrEqual(REALM_JUMP_HP_CAP)
      expect(mightRatio).toBeLessThanOrEqual(REALM_JUMP_MIGHT_CAP)
    },
  )
})
