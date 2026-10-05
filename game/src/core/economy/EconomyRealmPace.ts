import { getRealmTier } from '../realm/RealmTierMap'

// Economy pace retune (2026-10-05, beta pace-floor wave): every
// spirit-stone-denominated cost scales with the realm tier whose income
// unlocks it. Measured auto-farm income grows ~x5 mortal->qi and ~x4
// qi->foundation; costs grow ~1.5x faster than income so funding the
// per-floor upgrade path takes hours at Luyen Khi and days at Truc Co
// instead of one session (Minh directive: progression must not be
// maxable in a few sessions). Post-beta tiers continue x3/tier as a
// fallback until their own playtest pass lands.
const ECONOMY_REALM_STONE_COST_FACTOR_BY_TIER: Record<number, number> = {
  1: 1, // mortal (Pham Nhan) - tutorial baseline
  2: 8, // qi_refining (Luyen Khi)
  3: 50, // foundation_establishment (Truc Co)
}

export function stoneCostRealmFactor(realmId: string): number {
  const tier = getRealmTier(realmId)

  const authored = ECONOMY_REALM_STONE_COST_FACTOR_BY_TIER[tier]
  if (authored !== undefined) {
    return authored
  }

  if (tier > 3) {
    return 50 * Math.pow(3, tier - 3)
  }

  return 1
}
