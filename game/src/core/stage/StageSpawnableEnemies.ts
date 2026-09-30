import type { Stage } from './Stage'

/**
 * The set of enemy identities a stage may legally spawn (BETA SCOPE
 * LOCK v2 funnel): every enemyPool entry plus the declared
 * bossEnemyId. StageWaveSystem uses it to gate spawn sources that
 * bypass the pool roll (today: the hidden-beast substitution) - a
 * substituted identity may only enter a stage that itself declares it,
 * so a hidden beast can never materialize on a stage that did not opt
 * in. The set is computed per call: stage literals are frozen data but
 * callers may hold mutable fixtures.
 */
export function stageSpawnableEnemyIds(stage: Stage): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const entry of stage.enemyPool) {
    ids.add(entry.enemyId)
  }
  if (stage.bossEnemyId) {
    ids.add(stage.bossEnemyId)
  }
  return ids
}
