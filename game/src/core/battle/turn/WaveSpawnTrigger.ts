// Turn-Based Combat — wave-spawn decision (spec: 2026-09-04-wave-spawn-
// trigger-design.md). Ported from StageWaveSystem.update()'s spawn/
// victory conditions, with the real-seconds spawnCountdown throttle
// dropped: turn-based combat has no real-time "too fast" to guard
// against, so the only rule left is "spawn the moment the arena is
// empty."

/**
 * True iff the stage still has an enemy left to spawn AND the arena is
 * currently empty (no living or pending enemy occupying it).
 */
export function shouldSpawnNextEnemy(
  spawnedCount: number,
  totalEnemyCount: number,
  aliveCount: number,
): boolean {
  return spawnedCount < totalEnemyCount && aliveCount === 0
}

/**
 * True iff every enemy in the stage has already spawned AND the arena
 * is currently empty — mirrors StageWaveSystem.update()'s existing
 * victory-check condition (`active.spawnedCount >= stage.totalEnemyCount
 * && aliveCount === 0`).
 */
export function isStageComplete(
  spawnedCount: number,
  totalEnemyCount: number,
  aliveCount: number,
): boolean {
  return spawnedCount >= totalEnemyCount && aliveCount === 0
}
