// BuffSystemCapabilityQuery.ts -- canonical-seals/reaction megaplan
// S3.3 (plan sec.9.3). The production CombatCapabilityQuery: reads
// live capability grants off BuffSystem so
// 'elemental_reaction_enabled' follows van_phap_than_hoa instances --
// the switch is a live buff grant, never a static latch.

import type {
  ActiveCapabilityGrant,
  CombatCapabilityQuery,
} from '../../contracts/capability'
import type { CombatEntityId } from '../../contracts/ids'

export class BuffSystemCapabilityQuery implements CombatCapabilityQuery {
  constructor(
    private readonly getCapabilities: (
      entityId: CombatEntityId,
    ) => readonly ActiveCapabilityGrant[],
  ) {}

  has(entityId: CombatEntityId, capabilityId: string): boolean {
    return this.getCapabilities(entityId).some(
      (grant) => grant.capability.type === capabilityId,
    )
  }
}
