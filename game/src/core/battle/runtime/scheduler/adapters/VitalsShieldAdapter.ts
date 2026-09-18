// runtime/scheduler/adapters/VitalsShieldAdapter.ts -- M3
// ShieldAuthority over the vitals authority's ward grant.
//
// apply_shield maps to the NATIVE ward pool (entity.currentWard): the
// grant goes through EntityVitalsSystem.grantWard (M3 contract
// extension) -- direct field mutation is forbidden here (review r2
// HIGH 6: ward writes belong to the vitals authority alone).
// grantWard owns the wardMax ceiling, the dead-entity boundary and the
// 'entity_vitals_changed' emission with reason 'ward_grant'; the adapter
// only resolves the target and reports the outcome.
//
// External wards (entity.externalWard) are a different mechanism --
// source-tagged, replace-not-stack, exempt from wardMax -- owned by the
// The Tu external-ward contract; apply_shield does not route there.
//
// ctx contributes the canonical sourceId for vitals-event attribution;
// ctx.events is intentionally unused (no new gameplay events in M3).

import type { EntityVitalsSystem } from '../../../../combat/EntityVitalsSystem'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatEntityId } from '../../../contracts/ids'

import type { ShieldAuthority } from '../CombatAuthorityPorts'

import { requireLivingEntity, type CombatEntityLookup } from './lookups'

export class VitalsShieldAdapter implements ShieldAuthority {
  constructor(
    private readonly vitals: EntityVitalsSystem,
    private readonly resolveEntity: CombatEntityLookup,
  ) {}

  applyShield(
    targetId: CombatEntityId,
    amount: number,
    ctx: CombatAuthorityExecutionContext,
  ): { applied: number; shieldAfter: number } {
    const target = requireLivingEntity(this.resolveEntity, targetId)
    const applied = this.vitals.grantWard(target, amount, 'ward_grant', ctx.origin.sourceId)
    return { applied, shieldAfter: target.currentWard }
  }
}
