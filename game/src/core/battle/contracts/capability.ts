// contracts/capability.ts -- narrow read port for entity capability flags
// (contract sec.24: reaction capability is runtime metadata, not a buff
// field).

import type { CombatEntityId } from './ids'

export interface CombatCapabilityQuery {
  has(entityId: CombatEntityId, capabilityId: string): boolean
}

export const ELEMENTAL_REACTION_CAPABILITY = 'elemental_reaction_enabled' as const
