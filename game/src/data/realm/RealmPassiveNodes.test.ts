import { describe, expect, it } from 'vitest'
import { REALM_PASSIVE_NODES } from './RealmPassiveNodes'

describe('RealmPassiveNodes', () => {
  it('mở Nhập Đạo sau Phàm → Luyện Khí và Kiến Cơ sau Luyện Khí → Trúc Cơ', () => {
    expect(REALM_PASSIVE_NODES.slice(0, 2)).toMatchObject([
      { realmId: 'mortal', label: 'Nhập Đạo', unlockTier: 2 },
      { realmId: 'qi_refining', label: 'Kiến Cơ', unlockTier: 3 },
    ])
  })
})
