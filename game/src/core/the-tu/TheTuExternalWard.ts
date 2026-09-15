import type { CombatEntity } from '../combat/CombatEntity'
import type { BuffPool } from '../buff/BuffPool'
import type { BuffDefinitionCatalog } from '../buff/BuffTypes'

/**
 * The Tu Reimagined (plan Task 11, review P1.1) — the externalWard pool
 * is EXISTENCE-BOUND to the marker instance that granted it, keyed to
 * the ward's CURRENT sourceId: the pool survives only while a
 * grantsExternalWard-carrying marker instance from that same source
 * still lives in the holder's pool. This must never degrade to "any
 * marker with the same id" — a surviving source-A marker must not
 * resurrect source-B's spent pool.
 *
 * Called at the stat-refresh seam (refreshParticipantStats runs after
 * every pool mutation that can touch a participant: apply, update
 * expiry, remove, clearCcEffects) so reconcile stays a single choke
 * point rather than a call site per mutation kind.
 */
export function reconcileExternalWard(
  entity: CombatEntity,
  pool: BuffPool,
  registry: BuffDefinitionCatalog | undefined,
): void {
  const ward = entity.externalWard

  if (!ward) {
    return
  }

  const stillOwned = pool.getAll().some((buff) => {
    if (buff.sourceId !== ward.sourceId) {
      return false
    }

    let definition

    try {
      definition = registry?.get(buff.id)
    } catch {
      definition = undefined
    }

    return (
      definition?.effects.some(
        (effect) => effect.type === 'marker' && effect.grantsExternalWard === true,
      ) ?? false
    )
  })

  if (!stillOwned) {
    entity.externalWard = undefined
  }
}
