// MarkerCapabilities.ts -- megaplan M4: 'marker' payload schema +
// validator. Marker flags are READ-ONLY descriptors -- consumers are
// path/proc/presentation queries (displacement-immune checks, externalWard
// grant keys); no system executes them.
//
// Payload mirrors the retired MarkerEffectTemplate fields exactly.

import type {
  ActiveCapabilityGrant,
} from '../battle/contracts/capability'
import type { CapabilityValidatorRegistry } from '../battle/runtime/capability/CapabilityValidatorRegistry'

export interface MarkerPayload {
  displacementImmune?: boolean
  grantsExternalWard?: boolean
}

export function validateMarker(payload: unknown): asserts payload is MarkerPayload {
  const type = 'marker'
  if (typeof payload !== 'object' || payload === null) {
    throw new Error(`capability '${type}': payload must be an object`)
  }
  const record = payload as Record<string, unknown>
  if (record.displacementImmune !== undefined && typeof record.displacementImmune !== 'boolean') {
    throw new Error(`capability '${type}': displacementImmune must be a boolean`)
  }
  if (record.grantsExternalWard !== undefined && typeof record.grantsExternalWard !== 'boolean') {
    throw new Error(`capability '${type}': grantsExternalWard must be a boolean`)
  }
}

export function asMarker(grant: ActiveCapabilityGrant): MarkerPayload | undefined {
  return grant.capability.type === 'marker'
    ? (grant.capability.payload as MarkerPayload)
    : undefined
}

export function registerMarkerCapabilities(validators: CapabilityValidatorRegistry): void {
  validators.register('marker', validateMarker)
}
