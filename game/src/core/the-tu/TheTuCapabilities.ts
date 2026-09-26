// TheTuCapabilities.ts -- megaplan M4 (r4 HIGH 3, BLOCKER 3): typed
// payload schemas + validators for the The Tu economy capability types.
// Path economy stays in the path module -- TheEconomy consumes these
// grants at its existing gain seams via the narrowers below.
//
// Payloads mirror the retired TheEconomyEffect / ReactiveEconomyEffect
// fields exactly.

import type { BuffDefinitionId } from '../battle/contracts/ids'
import type {
  ActiveCapabilityGrant,
} from '../battle/contracts/capability'
import type { CapabilityValidatorRegistry } from '../battle/runtime/capability/CapabilityValidatorRegistry'

// --- the_economy (legacy TheEconomyEffect) ---
// Ung The beta: income exists ONLY as observation -- Tham The landed
// (gainOnBasicHit) and an observed enemy completing a normal action
// (gainOnObservedAction). The taken/evade/round channels are retired
// (design Part II: no passive income, no hit-outcome income).

export interface TheEconomyPayload {
  gainOnBasicHit?: number
  gainOnObservedAction?: number
}

// --- reactive_economy (legacy ReactiveEconomyEffect) ---

export interface ReactiveEconomyPayload {
  procCostFlatDelta?: number
  freeProcs?: boolean
  payloadAilments?: {
    buffDefinitionId: BuffDefinitionId
    chance: number
    stacks?: number
  }[]
}

// --- validators ---

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function optionalFiniteNumber(value: unknown, field: string, type: string): void {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`capability '${type}': ${field} must be a finite number`)
  }
}

export function validateTheEconomy(payload: unknown): asserts payload is TheEconomyPayload {
  const type = 'the_economy'
  if (!isRecord(payload)) throw new Error(`capability '${type}': payload must be an object`)
  optionalFiniteNumber(payload.gainOnBasicHit, 'gainOnBasicHit', type)
  optionalFiniteNumber(payload.gainOnObservedAction, 'gainOnObservedAction', type)
}

export function validateReactiveEconomy(payload: unknown): asserts payload is ReactiveEconomyPayload {
  const type = 'reactive_economy'
  if (!isRecord(payload)) throw new Error(`capability '${type}': payload must be an object`)
  optionalFiniteNumber(payload.procCostFlatDelta, 'procCostFlatDelta', type)
  if (payload.freeProcs !== undefined && typeof payload.freeProcs !== 'boolean') {
    throw new Error(`capability '${type}': freeProcs must be a boolean`)
  }
  if (payload.payloadAilments !== undefined) {
    if (!Array.isArray(payload.payloadAilments)) {
      throw new Error(`capability '${type}': payloadAilments must be an array`)
    }
    for (const entry of payload.payloadAilments) {
      if (!isRecord(entry)) {
        throw new Error(`capability '${type}': payloadAilments[] entries must be objects`)
      }
      if (typeof entry.buffDefinitionId !== 'string' || entry.buffDefinitionId.length === 0) {
        throw new Error(`capability '${type}': payloadAilments[].buffDefinitionId must be a non-empty string`)
      }
      if (typeof entry.chance !== 'number' || !Number.isFinite(entry.chance)) {
        throw new Error(`capability '${type}': payloadAilments[].chance must be a finite number`)
      }
      if (entry.stacks !== undefined && (typeof entry.stacks !== 'number' || !Number.isFinite(entry.stacks))) {
        throw new Error(`capability '${type}': payloadAilments[].stacks must be a finite number`)
      }
    }
  }
}

// --- grant narrowers ---

export function asTheEconomy(grant: ActiveCapabilityGrant): TheEconomyPayload | undefined {
  return grant.capability.type === 'the_economy'
    ? (grant.capability.payload as TheEconomyPayload)
    : undefined
}

export function asReactiveEconomy(grant: ActiveCapabilityGrant): ReactiveEconomyPayload | undefined {
  return grant.capability.type === 'reactive_economy'
    ? (grant.capability.payload as ReactiveEconomyPayload)
    : undefined
}

/** Registers every The Tu economy capability validator. */
export function registerBodyCapabilities(validators: CapabilityValidatorRegistry): void {
  validators.register('the_economy', validateTheEconomy)
  validators.register('reactive_economy', validateReactiveEconomy)
}
