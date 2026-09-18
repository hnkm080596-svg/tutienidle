// DamageProfiles.ts -- production BuffDamageProfileCatalog: the closed
// list of damage profiles the combat damage authority knows how to
// resolve (stats/mitigation/crit channel). The BuffRegistry validates
// every periodic def's damageProfile against this catalog at load --
// unknown profile = malformed data, throws at dev time.
//
// 'legacy_dot' is the M4 migration profile for the retired `dot` effect
// (dpsRatio coefficient, dynamic scaling -- the DamageSystem resolves
// the same formula the legacy calculateDamagePerTurn used).
// 'reaction' is declared for the reaction engine's payoff steps
// (data/reaction/*) even though those validate through ReactionRegistry.

import type { BuffDamageProfileCatalog } from '../buff2/BuffRegistry'

const PROFILES: Readonly<Record<string, readonly string[]>> = {
  legacy_dot: [],
  reaction: [],
}

export function createDamageProfileCatalog(): BuffDamageProfileCatalog {
  return {
    has(profileId: string): boolean {
      return Object.prototype.hasOwnProperty.call(PROFILES, profileId)
    },
    snapshotFields(profileId: string): readonly string[] {
      return PROFILES[profileId] ?? []
    },
  }
}
