// runtime/capability/CapabilityValidatorRegistry.ts -- spec sec.47/56:
// owner modules register validators at composition time; the buff registry
// validates every grant's (type known -> payload valid) at definition
// load. Unknown type -> throw, no silent pass.

import type { CapabilityType } from '../../contracts/capability'

export interface CapabilityValidatorRegistry {
  /** Throws when the payload is invalid for the registered type. */
  register(type: CapabilityType, validate: (payload: unknown) => void): void
  /** Unknown type -> throw; delegates to the registered validator. */
  validate(type: CapabilityType, payload: unknown): void
}

export function createCapabilityValidatorRegistry(): CapabilityValidatorRegistry {
  const validators = new Map<CapabilityType, (payload: unknown) => void>()
  return {
    register(type, validate) {
      if (typeof type !== 'string' || type.length === 0) {
        throw new Error('CapabilityValidatorRegistry: blank capability type')
      }
      if (validators.has(type)) {
        throw new Error(
          `CapabilityValidatorRegistry: duplicate validator for type '${type}'`,
        )
      }
      validators.set(type, validate)
    },
    validate(type, payload) {
      const validator = validators.get(type)
      if (validator === undefined) {
        throw new Error(
          `CapabilityValidatorRegistry: unknown capability type '${type}'`,
        )
      }
      validator(payload)
    },
  }
}
