import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_REALM_ESSENCE_MATERIAL,
  equipmentEssenceMaterialId,
} from './RefinementBalance'
import { REALM_TIERS } from '../realm/RealmTierMap'
import { materials } from '../../data/materials/materials'

// T1 (economy-ecosystem-plan, review 2026-08-28): mapping Tinh Hoa phải
// phủ ĐỦ 9 realm, không còn fallback im lặng về tinh_hoa_pham_khi.
describe('RefinementBalance — mapping Tinh Hoa theo realm (T1)', () => {
  it('mọi realm trong REALM_TIERS đều có essence materialId', () => {
    for (const realmId of REALM_TIERS) {
      expect(equipmentEssenceMaterialId(realmId), realmId).toBeDefined()
      expect(equipmentEssenceMaterialId(realmId), realmId).not.toBe('')
    }
  })

  it('body_integration (Hợp Thể) dùng chung essence với mahayana (Đại Thừa)', () => {
    expect(equipmentEssenceMaterialId('body_integration')).toBe(
      equipmentEssenceMaterialId('mahayana'),
    )
  })

  it('realm chưa map trả undefined — KHÔNG fallback im lặng', () => {
    expect(equipmentEssenceMaterialId('realm_khong_ton_tai')).toBeUndefined()
  })

  it('mỗi realm một essence id riêng (không realm nào dùng chung, trừ Hợp Thể)', () => {
    const ids = REALM_TIERS.map((realmId) => EQUIPMENT_REALM_ESSENCE_MATERIAL[realmId])

    expect(new Set(ids).size).toBe(REALM_TIERS.length)
  })

  it('mọi essence id trong mapping đều được khai báo trong materials', () => {
    const declared = new Set(materials.map((material) => material.id))

    for (const [realmId, essenceId] of Object.entries(EQUIPMENT_REALM_ESSENCE_MATERIAL)) {
      expect(declared.has(essenceId), `${realmId} → ${essenceId}`).toBe(true)
    }
  })
})
