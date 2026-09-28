// runtime/scheduler/adapters/ActionGaugeAdapter.ts -- M3
// GaugeAuthority over the current engine's ActionGauge module.
//
// pushGauge's fractionOfMax is a SIGNED fraction of GAUGE_MAX -- positive
// accelerates toward the ready threshold, negative pushes back. The
// applied delta goes through refundGauge, which already IS the engine's
// signed additive-delta primitive: it clamps into [min(0, gauge),
// GAUGE_MAX] -- a negative pushback floors at 0 for non-debtors and can
// never invert an Ung-Tre debtor's residue into haste; a positive push
// repays debt first. consumeGaugeAfterAction stays a separate concern --
// this port only pushes deltas.
//
// Result units are fraction-of-max (the port's own unit, matching the
// fractionOfMax input): before/after are actionGauge / GAUGE_MAX -- so
// `before` may exceed 1 when the unclamped advanceGauge overshot, while
// `after` is always inside [0, 1] post-clamp.

import { GAUGE_MAX, refundGauge, type GaugeActor } from '../../../turn/ActionGauge'

import type { CombatAuthorityExecutionContext } from '../../../contracts/context'
import type { CombatEntityId } from '../../../contracts/ids'

import type { GaugeAuthority } from '../CombatAuthorityPorts'

import {
  requireLivingActor,
  type CombatEntityLookup,
  type GaugeActorLookup,
} from './lookups'

export class ActionGaugeAdapter implements GaugeAuthority {
  constructor(
    private readonly resolveActor: GaugeActorLookup,
    // The liveness gate reads the LIVE entity; the GaugeActor's own
    // `alive` is the participant cache and can be stale mid-resolution.
    private readonly resolveEntity: CombatEntityLookup,
  ) {}

  pushGauge(
    targetId: CombatEntityId,
    fractionOfMax: number,
    _ctx: CombatAuthorityExecutionContext,
  ): { before: number; requestedDelta: number; appliedDelta: number; after: number } {
    const actor: GaugeActor = requireLivingActor(
      this.resolveActor,
      this.resolveEntity,
      targetId,
    )

    const before = actor.actionGauge
    refundGauge(actor, fractionOfMax * GAUGE_MAX)
    const after = actor.actionGauge

    return {
      before: before / GAUGE_MAX,
      requestedDelta: fractionOfMax,
      appliedDelta: (after - before) / GAUGE_MAX,
      after: after / GAUGE_MAX,
    }
  }
}
