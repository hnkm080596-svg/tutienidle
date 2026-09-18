import { BuffRegistry } from '../../core/buff2/BuffRegistry'
import { createDamageProfileCatalog } from '../../core/combat/DamageProfiles'
import { createDefaultCapabilityValidators } from '../../core/battle/runtime/capability/DefaultCapabilityValidators'
import { buffs as LIVE_BUFFS } from './buffs'

// buff2 migration (M4) — the legacy `toBuffDefinition` load-time
// converter is gone: every data file now authors the canonical
// BuffDefinition shape directly (stacking/lifetime/application/
// periodic/statModifiers/controls/capabilities). The registry validates
// every def at construction (spec sec.56) and freezes them at seal().

function buildRegistry(): BuffRegistry {
  const registry = new BuffRegistry({
    damageProfiles: createDamageProfileCatalog(),
    capabilityValidators: createDefaultCapabilityValidators(),
  })
  for (const definition of LIVE_BUFFS) {
    registry.register(definition)
  }
  registry.seal()
  return registry
}

export const BUFF_REGISTRY: BuffRegistry = buildRegistry()

// buff2 M4 -- the persistent (out-of-battle) pool's catalog. BuffPersistence
// rejects registries containing periodic defs at construction: no scheduler
// barrier exists out of battle, so periodic requests could never settle.
// The persistent lane therefore registers only non-periodic defs -- Kiep
// Thuong-family debuffs and any future non-periodic persistent apply ride
// this; a periodic def applied here fails closed as "unknown definition".
function buildPersistentRegistry(): BuffRegistry {
  const registry = new BuffRegistry({
    damageProfiles: createDamageProfileCatalog(),
    capabilityValidators: createDefaultCapabilityValidators(),
  })
  for (const definition of LIVE_BUFFS) {
    if ((definition.periodic?.length ?? 0) === 0) {
      registry.register(definition)
    }
  }
  registry.seal()
  return registry
}

export const PERSISTENT_BUFF_REGISTRY: BuffRegistry = buildPersistentRegistry()
