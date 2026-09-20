// ReactionCapabilities.ts -- canonical-seals/reaction megaplan S3.1
// (plan sec.9.1). Registers the validator for the
// 'elemental_reaction_enabled' capability type so the battle buff
// registry accepts van_phap_than_hoa's grant. The payload is an empty
// object: the capability itself is the whole contract (the gate only
// calls has()), so the validator pins shape, not content.

import type { CapabilityValidatorRegistry } from '../battle/runtime/capability/CapabilityValidatorRegistry'
import { ELEMENTAL_REACTION_CAPABILITY } from './ReactionTypes'

export function registerReactionCapabilities(
  validators: CapabilityValidatorRegistry,
): void {
  validators.register(ELEMENTAL_REACTION_CAPABILITY, (payload) => {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new Error(
        `reaction capability '${ELEMENTAL_REACTION_CAPABILITY}': payload must be a plain object`,
      )
    }
  })
}
