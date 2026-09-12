import type { EnemyTag, EnemyTagRegistry } from '../../core/enemy/EnemyTag'
import { applyEliteMultiplier } from '../../core/enemy/EnemyStatInput'

/**
 * v1 tag registry (spec 2026-09-11 v3): a single additive modifier tag.
 * It reproduces the retired createEliteVariant's stat/flag/name behavior
 * exactly - the stat formula is REFERENCED, not copied (A9).
 *
 * Rewards are intentionally NOT switched here (v3 D8): tags keep the
 * authored rewards; the per-tag drop/reward system is roadmap debt.
 *
 * Future tags (Hap Huyet / Cuong No / Than Phu ...) are new entries in
 * this registry only - no core code change.
 */
export const ENEMY_TAGS: EnemyTagRegistry = new Map<string, EnemyTag>([
  [
    'tinh_anh',
    {
      id: 'tinh_anh',
      namePrefix: 'Tinh Anh ',
      applyStat: applyEliteMultiplier,
      combatFlag: 'isElite',
    },
  ],
])
