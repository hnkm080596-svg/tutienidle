// Turn-Based Combat — wave-spawn decision (spec:
// 2026-09-06-turn-based-wave-spawn-vfx-design.md). shouldSpawnNextEnemy()
// (1 enemy at a time) is REPLACED by shouldStartNextWave() (whole wave at
// once) — the old function is deleted, not deprecated, since nothing else
// calls it after TurnBattleSystem.ts (Task 3) migrates.

/**
 * True iff the arena is fully clear (no living enemy, no pending
 * telegraph) AND there is another wave left to spawn.
 */
export function shouldStartNextWave(
  aliveCount: number,
  pendingCount: number,
  waveIndex: number,
  waveCount: number,
): boolean {
  return aliveCount === 0 && pendingCount === 0 && waveIndex < waveCount
}

/**
 * True iff every enemy in the stage has already spawned, the arena is
 * currently empty, AND no enemy is still telegraphing. The pendingCount
 * check prevents victory from firing while the final wave's enemies are
 * still mid-telegraph (invisible, not yet real, but about to materialize).
 */
export function isStageComplete(
  spawnedCount: number,
  totalEnemyCount: number,
  aliveCount: number,
  pendingCount: number,
): boolean {
  return spawnedCount >= totalEnemyCount && aliveCount === 0 && pendingCount === 0
}
