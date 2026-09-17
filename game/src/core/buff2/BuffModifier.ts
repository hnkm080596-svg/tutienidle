// BuffModifier.ts -- spec sec.29/sec.33 modifier types.
//
// The authored shape is the contract's BuffModifierPayload (operations.ts):
// {id, appliedBy?, channel, operation, value, reapply, priority, lifetime}.
// An instance-stored modifier additionally carries the runtime identity the
// modifier engine mints at attach time (spec sec.29/33): every reservation,
// removal and settled-event correlation keys on modifierRuntimeId, NOT the
// authored id -- two generations of the same authored modifierId on one
// instance are distinct entries (reapply:'stack' duplicates, replacement
// generations).

import type { BuffModifierPayload } from '../battle/contracts/operations'
import type { BuffInstanceId } from '../battle/contracts/ids'

export interface BuffModifier extends BuffModifierPayload {
  /** Minted at attach: `bmr.${instanceId}.${n}` -- unique per entry on the
      instance. Public surface: buff_modifier_added/removed events and the
      pending periodic `uses` reservation key on it. */
  readonly modifierRuntimeId: string
  /** Owning instance (reverse link for diagnostics/trace). */
  readonly instanceId: BuffInstanceId
  /** Runtime reservation (spec addendum v1.2): while set, this entry is
      reserved for the named in-flight periodic request and folds into
      NOTHING -- cleared when PeriodicOperationSettled finalizes the mark
      (resolved -> consume a use; otherwise -> release). */
  pendingRequestId?: string
}
