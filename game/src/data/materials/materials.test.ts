import { describe, expect, it } from 'vitest'
import { LUYEN_KHI_TINH_HOA_ID } from '@/core/equipment/TinhHoaMaterial'
import { materials } from './materials'

const RETIRED_EQUIPMENT_ESSENCE_IDS = [
  'tinh_hoa_pham_khi',
  'tinh_hoa_bao_khi',
  'tinh_hoa_linh_khi',
  'tinh_hoa_phap_khi',
  'tinh_hoa_phap_bao',
  'tinh_hoa_tien_bao',
  'tinh_hoa_chi_bao',
  'tinh_hoa_hon_don_chi_bao',
  'tinh_hoa_thien_dia_trong_khi',
] as const

describe('materials — Luyện Khí Tinh Hoa catalog', () => {
  it('registers one unified equipment essence, preserves Luyện Thể, and excludes retired ids', () => {
    const materialIds = materials.map((material) => material.id)

    expect(materialIds.filter((id) => id === LUYEN_KHI_TINH_HOA_ID)).toHaveLength(1)
    expect(materialIds).toContain('tinh_hoa_pham_the')

    for (const retiredId of RETIRED_EQUIPMENT_ESSENCE_IDS) {
      expect(materialIds).not.toContain(retiredId)
    }
  })

  it('registers Luyện Khí Tinh Hoa as a building-sourced currency-like stack', () => {
    const essence = materials.find((material) => material.id === LUYEN_KHI_TINH_HOA_ID)

    expect(essence).toMatchObject({
      name: 'Luyện Khí Tinh Hoa',
      category: 'essence',
      sourceType: 'building',
      stackLimit: Number.MAX_SAFE_INTEGER,
    })
  })
})
