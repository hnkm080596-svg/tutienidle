// DotRecoveryCapabilities.ts -- megaplan M4 (r4 HIGH 3): 'dot_recovery'
// payload schema + validator. The grant is consumed INSIDE the 'legacy_dot'
// damage channel (CombatSystem.applyDotDamage -> DotRecovery.ts) -- damage
// side, never the proc system.
//
// Payload mirrors the retired DotRecoveryEffect fields exactly: an
// authored DoT-recovery trigger on the DoT SOURCE's own buff. When a DoT
// tick of a matching element lands, the living source heals
// healPercent * stacks of the damage dealt (stack-scaling applied by the
// consumer via the grant's instance stacks).

import type { ElementType } from '../element/ElementType'
import type {
  ActiveCapabilityGrant,
} from '../battle/contracts/capability'
import type { CapabilityValidatorRegistry } from '../battle/runtime/capability/CapabilityValidatorRegistry'

export interface DotRecoveryPayload {
  element?: ElementType | 'physical'
  healPercent: number
}

export function validateDotRecovery(payload: unknown): asserts payload is DotRecoveryPayload {
  const type = 'dot_recovery'
  if (typeof payload !== 'object' || payload === null) {
    throw new Error(`capability '${type}': payload must be an object`)
  }
  const record = payload as Record<string, unknown>
  if (
    record.element !== undefined &&
    typeof record.element !== 'string'
  ) {
    throw new Error(`capability '${type}': element must be a string`)
  }
  if (typeof record.healPercent !== 'number' || !Number.isFinite(record.healPercent)) {
    throw new Error(`capability '${type}': healPercent must be a finite number`)
  }
}

export function asDotRecovery(grant: ActiveCapabilityGrant): DotRecoveryPayload | undefined {
  return grant.capability.type === 'dot_recovery'
    ? (grant.capability.payload as DotRecoveryPayload)
    : undefined
}

export function registerDotRecoveryCapabilities(validators: CapabilityValidatorRegistry): void {
  validators.register('dot_recovery', validateDotRecovery)
}
