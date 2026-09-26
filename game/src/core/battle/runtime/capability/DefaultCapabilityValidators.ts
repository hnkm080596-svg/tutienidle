// DefaultCapabilityValidators.ts -- megaplan M4: composition point
// registering every production capability validator the owner modules
// declare. The data BuffRegistry + BuffSystem fixture worlds validate
// grants against this registry; owners keep their schemas (spec sec.47 --
// buff core holds zero typed payloads).

import { createCapabilityValidatorRegistry } from './CapabilityValidatorRegistry'
import type { CapabilityValidatorRegistry } from './CapabilityValidatorRegistry'
import { registerProcCapabilities } from '../../../proc/ProcCapabilities'
import { registerMarkerCapabilities } from '../../../proc/MarkerCapabilities'
import { registerBodyCapabilities } from '../../../the-tu/TheTuCapabilities'
import { registerGaugeDeltaCapabilities } from '../../turn/GaugeDeltaHandler'
import { registerDotRecoveryCapabilities } from '../../../combat/DotRecoveryCapabilities'
import { registerPeriodicGrowthCapabilities } from '../../../buff2/PeriodicGrowthCapabilities'
import { registerReactionCapabilities } from '../../../reaction/ReactionCapabilities'

export function createDefaultCapabilityValidators(): CapabilityValidatorRegistry {
  const validators = createCapabilityValidatorRegistry()
  registerProcCapabilities(validators)
  registerMarkerCapabilities(validators)
  registerBodyCapabilities(validators)
  registerGaugeDeltaCapabilities(validators)
  registerDotRecoveryCapabilities(validators)
  registerPeriodicGrowthCapabilities(validators)
  registerReactionCapabilities(validators)
  return validators
}
