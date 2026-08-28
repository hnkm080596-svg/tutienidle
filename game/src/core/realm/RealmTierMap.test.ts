import { describe, expect, it } from 'vitest'
import { REALM_TIERS, getRealmIdForTier, getRealmTier } from './RealmTierMap'

describe('RealmTierMap', () => {
  it('có đúng 9 tier và gộp Hợp Thể vào Đại Thừa', () => {
    expect(REALM_TIERS).toHaveLength(9)
    expect(getRealmTier('body_integration')).toBe(8)
    expect(getRealmIdForTier(8)).toBe('mahayana')
  })
})
