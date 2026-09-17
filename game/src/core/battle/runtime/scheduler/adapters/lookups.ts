// runtime/scheduler/adapters/lookups.ts -- shared resolution helpers for
// the current-engine authority adapters (M3).
//
// Ports receive CombatEntityId; the current engine's authorities mutate
// live objects. The composition root injects a lookup that closes over
// the live battle roster (entities / participants) so ids resolve to
// the same objects the engine systems mutate -- the adapters never keep
// their own roster copy.
//
// An unresolvable (or dead) id is normal runtime invalidation, not a
// structural failure: the adapters signal it through CombatOperationSkip
// ('invalid_target_state', contract sec.51) and the executor converts it
// to a typed skipped result.

import type { CombatEntity } from '../../../../combat/CombatEntity'
import type { GaugeActor } from '../../../turn/ActionGauge'
import type { CombatEntityId } from '../../../contracts/ids'

import { CombatOperationSkip } from '../CombatOperationExecutor'

export type CombatEntityLookup = (id: CombatEntityId) => CombatEntity | undefined
export type GaugeActorLookup = (id: CombatEntityId) => GaugeActor | undefined

/** Resolve-or-skip: an absent entity is stale state (contract sec.51). */
export function requireEntity(
  resolve: CombatEntityLookup,
  id: CombatEntityId,
): CombatEntity {
  const entity = resolve(id)
  if (entity === undefined) {
    throw new CombatOperationSkip(
      'invalid_target_state',
      `entity '${id}' is not resolvable in the live battle roster`,
    )
  }
  return entity
}

/** requireEntity plus the dead-target invalidation shared by the
    damage/heal/shield channels. */
export function requireLivingEntity(
  resolve: CombatEntityLookup,
  id: CombatEntityId,
): CombatEntity {
  const entity = requireEntity(resolve, id)
  if (!entity.alive) {
    throw new CombatOperationSkip(
      'invalid_target_state',
      `entity '${id}' is dead`,
    )
  }
  return entity
}

/** Same invalidation for the gauge channel: a dead participant's gauge
    is inert, so pushing it is a dead-target skip. Liveness gates on the
    LIVE entity -- the participant `alive` flag is a cache synced only
    inside the pacing loop, so a just-killed participant can read
    stale-true mid-resolution (M4 review fix). */
export function requireLivingActor(
  resolveActor: GaugeActorLookup,
  resolveEntity: CombatEntityLookup,
  id: CombatEntityId,
): GaugeActor {
  requireLivingEntity(resolveEntity, id)
  const actor = resolveActor(id)
  if (actor === undefined) {
    throw new CombatOperationSkip(
      'invalid_target_state',
      `gauge actor '${id}' is not resolvable`,
    )
  }
  return actor
}
