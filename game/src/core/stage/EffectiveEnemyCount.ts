// EffectiveEnemyCount (Combat Art Pipeline spec §7 addendum, 2026-09-05) —
// a boss stage has EXACTLY ONE enemy, ever (the boss). Mirrors
// StageWaveSystem.pickEnemyForSpawn()'s own boss-gate condition
// (floor === 10 && stage.bossEnemyId — bossEnemyId is reserved/metadata
// on floors 1-9, per Stage.ts's own comment) so wave/spawn/win-condition
// config can never drift out of sync with which stage actually spawns a
// boss. Isolated in its own file so both StageWaveSystem (legacy-bridge
// path) and GameManager (turn-based path) read the SAME single source of
// truth rather than duplicating the floor===10 condition inline twice.
import type { Stage } from './Stage'

export function effectiveTotalEnemyCount(stage: Stage): number {
  if (stage.floor === 10 && stage.bossEnemyId) {
    return 1
  }

  return stage.totalEnemyCount
}
