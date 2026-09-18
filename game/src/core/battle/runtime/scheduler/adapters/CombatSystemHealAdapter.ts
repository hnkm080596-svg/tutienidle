// runtime/scheduler/adapters/CombatSystemHealAdapter.ts -- M3
// HealAuthority over the current engine's CombatSystem.
//
// Routes HealOperation payloads through CombatSystem.applyHealing: the
// vitals authority keeps the dead-entity boundary, the
// healingEffectivenessPercent scaling and the 'heal'/'entity_vitals_
// changed' event contract exactly as the legacy path produced them.
// payload.amount is always concrete by executor time (R-C7).
//
// result.after reads the entity's live currentHp -- the vitals authority
// owns the clamp, the adapter only reports it.
//
// ctx contributes the canonical sourceId for vitals-event attribution;
// ctx.events is intentionally unused (no new gameplay events in M3).

import type { CombatSystem } from '../../../../combat/CombatSystem'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { HealOperation } from '../../../contracts/operations'

import type { HealAuthority } from '../CombatAuthorityPorts'

import { requireLivingEntity, type CombatEntityLookup } from './lookups'

export class CombatSystemHealAdapter implements HealAuthority {
  constructor(
    private readonly combat: CombatSystem,
    private readonly resolveEntity: CombatEntityLookup,
  ) {}

  heal(
    payload: HealOperation['payload'],
    ctx: CombatAuthorityExecutionContext,
  ): { requested: number; healed: number; after: number } {
    // Dead-target invalidation is the adapter's: applyHealing would
    // silently return 0, but the contract wants the typed skip
    // (sec.51) instead of a phantom resolved-0.
    const target = requireLivingEntity(this.resolveEntity, payload.targetId)
    const healed = this.combat.applyHealing(target, payload.amount, ctx.origin.sourceId, 'healing')
    return { requested: payload.amount, healed, after: target.currentHp }
  }
}
