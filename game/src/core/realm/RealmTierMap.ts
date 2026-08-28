/** Chín bậc nội dung dùng chung cho kinh tế và UI progression. */
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

/** Hợp Thể dùng chung tier kinh tế với Đại Thừa theo quyết định của plan. */
export function getRealmTier(realmId: string): number {
  if (realmId === 'body_integration') return 8
  const index = REALM_TIERS.indexOf(realmId as RealmTierId)
  return index < 0 ? 1 : index + 1
}

export function getRealmIdForTier(tier: number): RealmTierId {
  const normalized = Math.min(REALM_TIERS.length, Math.max(1, Math.floor(tier)))
  return REALM_TIERS[normalized - 1]!
}
