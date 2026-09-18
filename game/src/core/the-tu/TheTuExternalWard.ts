import type { CombatEntity } from '../combat/CombatEntity'
import type { BuffInstanceSnapshot } from '../buff2/BuffInstance'
import type { BuffRegistry } from '../buff2/BuffRegistry'
import type { MarkerPayload } from '../proc/MarkerCapabilities'

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
 * every buff mutation that can touch a participant: apply, lifecycle
 * expiry, remove, CC clear) so reconcile stays a single choke
 * point rather than a call site per mutation kind.
 *
 * buff2 M4 — reads canonical instance snapshots; the marker grant is a
 * capability payload on the resolved definition (the `marker`
 * capability owner validates `grantsExternalWard`).
 */
export function reconcileExternalWard(
  entity: CombatEntity,
  instances: readonly BuffInstanceSnapshot[],
  registry: BuffRegistry | undefined,
): void {
  const ward = entity.externalWard

  if (!ward) {
    return
  }

  const stillOwned = instances.some((instance) => {
    if (instance.sourceId !== ward.sourceId) {
      return false
    }

    const definition = registry?.tryGet(instance.definitionId)

    return (
      definition?.capabilities?.some(
        (capability) =>
          capability.type === 'marker' &&
          (capability.payload as MarkerPayload).grantsExternalWard === true,
      ) ?? false
    )
  })

  if (!stillOwned) {
    entity.externalWard = undefined
  }
}
