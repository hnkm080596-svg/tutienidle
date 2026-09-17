import type { CombatCapabilityQuery } from '../../contracts/capability'
import type { CombatEntityId } from '../../contracts/ids'

/**
 * StaticCapabilityQuery -- immutable per-battle snapshot of entity
 * capability flags (contract sec.24). Built once by the composition root;
 * `has` is a pure lookup with no side effects, keeping CombatRng-free
 * deterministic gating.
 */
export class StaticCapabilityQuery implements CombatCapabilityQuery {
  private readonly capabilities: ReadonlyMap<CombatEntityId, ReadonlySet<string>>

  constructor(
    capabilities: ReadonlyMap<CombatEntityId, ReadonlySet<string>> = new Map(),
  ) {
    this.capabilities = capabilities
  }

  has(entityId: CombatEntityId, capabilityId: string): boolean {
    return this.capabilities.get(entityId)?.has(capabilityId) ?? false
  }
}
