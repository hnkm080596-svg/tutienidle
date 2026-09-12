import type { Enemy } from './Enemy'
import type { Stats } from '../stats/StatBlock'

/**
 * Generic enemy tag contract (spec 2026-09-11 v3 D3). Tags are DATA
 * (registry entries in data/enemy/EnemyTags.ts) - this core layer never
 * hardcodes a specific tag id (A8).
 *
 * Scope rules locked by the spec:
 * - v1 tags do NOT touch rewards (D8): the authored rewards field stays
 *   untouched - a per-tag drop/reward system is recorded as roadmap debt.
 * - 'boss' is NOT a tag (D4): boss is a stage property applied by
 *   createBossVariant unconditionally on floor 10 - never via this applier.
 */
export interface EnemyTag {
  id: string

  /** Prepended to the enemy name; prefixes join in tag order. */
  namePrefix?: string

  /** Stat transform - reference the single stat owner (A9), e.g.
   * applyEliteMultiplier. Folded in priority order so tags stack
   * multiplicatively. */
  applyStat?: (stats: Stats) => Stats

  /** CombatEntity flag set when the tag is applied. */
  combatFlag?: 'isElite'

  /** Higher priority applies FIRST in the fold. Ties keep declaration
   * order (stable sort). Reserved for future tags (spec B3). */
  priority?: number
}

export type EnemyTagRegistry = ReadonlyMap<string, EnemyTag>

/**
 * Apply tags to a template enemy. Each tag applies at most once (dedupe);
 * tags fold in descending priority order (stable within ties) so their
 * stat multipliers stack. Unknown ids are skipped safely. The base enemy
 * is never mutated (spread copies). currentHp/maxHp follow the final
 * stats, mirroring the legacy variant functions. Rewards are untouched
 * in v1 (D8).
 */
export function applyEnemyTags(enemy: Enemy, tagIds: readonly string[], registry: EnemyTagRegistry): Enemy {
  const seen = new Set<string>()
  const ordered: Array<{ index: number; tag: EnemyTag }> = []

  tagIds.forEach((tagId, index) => {
    if (seen.has(tagId)) {
      return
    }

    const tag = registry.get(tagId)

    if (!tag) {
      return
    }

    seen.add(tagId)
    ordered.push({ index, tag })
  })

  // Priority desc; stable within ties (declaration order).
  ordered.sort((a, b) => (b.tag.priority ?? 0) - (a.tag.priority ?? 0) || a.index - b.index)

  let result = enemy

  for (const { tag } of ordered) {
    result = {
      ...result,
      stats: tag.applyStat ? tag.applyStat(result.stats) : result.stats,
      name: tag.namePrefix ? tag.namePrefix + result.name : result.name,
      isElite: tag.combatFlag === 'isElite' ? true : result.isElite,
    }
  }

  return { ...result, currentHp: result.stats.maxHp, maxHp: result.stats.maxHp }
}
