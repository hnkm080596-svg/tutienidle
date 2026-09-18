// contracts/capability.ts -- narrow read port for entity capability flags
// (contract sec.24: reaction capability is runtime metadata, not a buff
// field).

import type { BuffDefinitionId, BuffInstanceId, CombatEntityId } from './ids'

export interface CombatCapabilityQuery {
  has(entityId: CombatEntityId, capabilityId: string): boolean
}

export const ELEMENTAL_REACTION_CAPABILITY = 'elemental_reaction_enabled' as const

/** v7.2 -- spec sec.47 generic capability grant: the ONLY capability shape
    Buff core knows. Typed payloads are owned and registered by the
    CONSUMING domains (core/proc/, core/path/the-tu/, ...) -- buff
    stores/exposes the grant, never interprets the payload.
    `CapabilityType` stays open (string); payload validity is enforced by
    registered validators (runtime/capability/CapabilityValidatorRegistry),
    not by a closed union living in buff vocabulary. */
export type CapabilityType = string

export interface CapabilityGrantDefinition {
  id: string
  type: CapabilityType
  payload: unknown
}

export interface ActiveCapabilityGrant {
  instanceId: BuffInstanceId
  definitionId: BuffDefinitionId
  capability: CapabilityGrantDefinition
  /** Instance context (M4 consumer cutover): capability consumers like
      dot_recovery scale on live stacks and ward-economy consumers match
      on sourceId -- carrying them on the grant keeps the descriptor
      self-contained (no instance re-query). */
  sourceId: CombatEntityId
  targetId: CombatEntityId
  stacks: number
}
