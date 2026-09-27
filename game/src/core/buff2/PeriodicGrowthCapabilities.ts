// PeriodicGrowthCapabilities.ts -- Phap Tu Reimagined (spec D11):
// 'periodic_growth' payload schema + validator. The grant is consumed by
// BuffSystem.emitLifecycleUnit itself: a marker buff on the periodic
// instance's HOLDER carries it; when the matching periodic unit ticks,
// the ticking instance gains `stacks` (clamped to maxStacks) and the
// marker is removed when `consume` is set (Sinh Co: +1 doc_can stack,
// once per window).
//
// The payload references the ticking buff's BuffDefinitionId -- the
// marker def declares which periodic it feeds, so one marker can never
// inflate an unrelated tick.

import type {
  ActiveCapabilityGrant,
  CapabilityGrantDefinition,
} from '../battle/contracts/capability'
import type { CapabilityValidatorRegistry } from '../battle/runtime/capability/CapabilityValidatorRegistry'

export const PERIODIC_GROWTH_CAPABILITY = 'periodic_growth' as const

export interface PeriodicGrowthPayload {
  /** The periodic-carrying definition this marker feeds (e.g. doc_can). */
  definitionId: string
  /** Stacks added to the ticking instance before its unit computes. */
  stacks: number
  /** When true the marker instance is consumed by the feed. */
  consume?: boolean
}

export function validatePeriodicGrowth(payload: unknown): asserts payload is PeriodicGrowthPayload {
  const type = PERIODIC_GROWTH_CAPABILITY
  if (typeof payload !== 'object' || payload === null) {
    throw new Error(`capability '${type}': payload must be an object`)
  }
  const record = payload as Record<string, unknown>
  if (typeof record.definitionId !== 'string' || record.definitionId.length === 0) {
    throw new Error(`capability '${type}': definitionId must be a non-empty string`)
  }
  if (typeof record.stacks !== 'number' || !Number.isFinite(record.stacks)) {
    throw new Error(`capability '${type}': stacks must be a finite number`)
  }
  if (record.consume !== undefined && typeof record.consume !== 'boolean') {
    throw new Error(`capability '${type}': consume must be a boolean`)
  }
}

export function asPeriodicGrowth(
  grant: ActiveCapabilityGrant,
): PeriodicGrowthPayload | undefined {
  return grant.capability.type === PERIODIC_GROWTH_CAPABILITY
    ? (grant.capability.payload as PeriodicGrowthPayload)
    : undefined
}

/** Definition-level reader -- BuffSystem scans a marker def's declared
    capabilities, not active grants. */
export function periodicGrowthPayloadOf(
  capability: CapabilityGrantDefinition,
): PeriodicGrowthPayload | undefined {
  return capability.type === PERIODIC_GROWTH_CAPABILITY
    ? (capability.payload as PeriodicGrowthPayload)
    : undefined
}

export function registerPeriodicGrowthCapabilities(
  validators: CapabilityValidatorRegistry,
): void {
  validators.register(PERIODIC_GROWTH_CAPABILITY, validatePeriodicGrowth)
}
