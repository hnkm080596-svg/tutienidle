/** Chin bac noi dung dung chung cho kinh te va UI progression. */
export const REALM_TIERS = [
  'mortal',
  'qi_refining',
  'foundation_establishment',
  'golden_core',
  'nascent_soul',
  'soul_transformation',
  'void_refinement',
  'mahayana',
  'tribulation',
] as const

export type RealmTierId = (typeof REALM_TIERS)[number]

/** Hop The dung chung tier kinh te voi Dai Thua theo quyet dinh cua plan. */
export function getRealmTier(realmId: string): number {
  if (realmId === 'body_integration') return 8
  const index = REALM_TIERS.indexOf(realmId as RealmTierId)
  return index < 0 ? 1 : index + 1
}

export function getRealmIdForTier(tier: number): RealmTierId {
  const normalized = Math.min(REALM_TIERS.length, Math.max(1, Math.floor(tier)))
  return REALM_TIERS[normalized - 1]!
}

/**
 * F-MAT-REALM producibility ceiling: a realm-bounded faucet may mint
 * materials up to this many realm tiers above the claimer/collector
 * tier (the lead authored no-gate collect quests tolerate). The save
 * validator and the production reward roll both read this constant -
 * one authority for the whole rule.
 */
export const PRODUCIBLE_REALM_TIER_LEAD = 1
