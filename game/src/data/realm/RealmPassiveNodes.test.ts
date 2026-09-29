import { describe, expect, it } from 'vitest'
import { REALM_PASSIVE_NODES } from './RealmPassiveNodes'

describe('RealmPassiveNodes', () => {
  // FE-12 - nodes carry the DESTINATION realm label: the Truc Co node
  // lights when the player reaches Truc Co, and only realms above the
  // release ceiling show the coming-soon state.
  it('mở Kiến Cơ sau Phàm → Luyện Khí và Trúc Cơ sau Luyện Khí → Trúc Cơ', () => {
    expect(REALM_PASSIVE_NODES.slice(0, 2)).toMatchObject([
      { realmId: 'qi_refining', label: 'Kiến Cơ', unlockTier: 2, comingSoon: false },
      { realmId: 'foundation_establishment', label: 'Trúc Cơ', unlockTier: 3, comingSoon: false },
    ])
  })

  it('chỉ các node trên trần release (Kim Đan+) mới mang cờ sắp ra mắt', () => {
    const goldenCoreNode = REALM_PASSIVE_NODES.find((node) => node.realmId === 'golden_core')
    expect(goldenCoreNode).toMatchObject({ unlockTier: 4, comingSoon: true })
    expect(REALM_PASSIVE_NODES.every((node) => node.comingSoon === (node.unlockTier > 3))).toBe(true)
  })
})
