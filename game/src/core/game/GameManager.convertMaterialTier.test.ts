import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { materials } from '../../data/materials/materials'
import { MATERIAL_TIER_CONVERSION_RATIO } from '../material/MaterialTierConversionBalance'
import type { Material } from '../material/Material'

// Quy đổi cảnh giới Linh Mộc/Linh Khoáng (2026-08-28): gộp LÊN 10 bậc thấp
// → 1 bậc cao theo thang Phàm Nhân → Luyện Khí → Trúc Cơ. Atomic, không
// nhân bản, không chiều ngược. Quáng giữ PHẨM khi lên cảnh giới.
function setup() {
  const gameManager = new GameManager()

  gameManager.registerMaterials(materials)

  return gameManager
}

function materialById(id: string): Material {
  const material = materials.find((entry) => entry.id === id)

  if (!material) {
    throw new Error(`Material not found in registry: ${id}`)
  }

  return material
}

describe('GameManager — quy đổi cảnh giới Linh Mộc/Linh Khoáng', () => {
  it('10 gỗ Phàm Nhân đổi đúng 1 gỗ Luyện Khí, trừ đúng 10', () => {
    const gameManager = setup()

    gameManager.materialBag.add(materialById('mortal_wood'), MATERIAL_TIER_CONVERSION_RATIO)

    const result = gameManager.convertMaterialTier('mortal_wood', 1)

    expect(result.ok).toBe(true)
    expect(result.gained).toBe(1)
    expect(gameManager.materialBag.getAmount('mortal_wood')).toBe(0)
    expect(gameManager.materialBag.getAmount('qi_refining_wood')).toBe(1)
  })

  it('10 gỗ Luyện Khí đổi đúng 1 gỗ Trúc Cơ', () => {
    const gameManager = setup()

    gameManager.materialBag.add(materialById('qi_refining_wood'), MATERIAL_TIER_CONVERSION_RATIO)

    const result = gameManager.convertMaterialTier('qi_refining_wood', 1)

    expect(result.ok).toBe(true)
    expect(gameManager.materialBag.getAmount('qi_refining_wood')).toBe(0)
    expect(gameManager.materialBag.getAmount('foundation_establishment_wood')).toBe(1)
  })

  it('gỗ Trúc Cơ là trần — không có cảnh giới cao hơn để đổi', () => {
    const gameManager = setup()

    gameManager.materialBag.add(
      materialById('foundation_establishment_wood'),
      MATERIAL_TIER_CONVERSION_RATIO,
    )

    const result = gameManager.convertMaterialTier('foundation_establishment_wood', 1)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_higher_tier')
    expect(gameManager.materialBag.getAmount('foundation_establishment_wood')).toBe(
      MATERIAL_TIER_CONVERSION_RATIO,
    )
  })

  it('quáng lên cảnh giới GIỮ PHẨM: 10 mortal_ore_huyen → 1 qi_refining_ore_huyen', () => {
    const gameManager = setup()

    gameManager.materialBag.add(materialById('mortal_ore_huyen'), MATERIAL_TIER_CONVERSION_RATIO)

    const result = gameManager.convertMaterialTier('mortal_ore_huyen', 1)

    expect(result.ok).toBe(true)
    expect(gameManager.materialBag.getAmount('mortal_ore_huyen')).toBe(0)
    expect(gameManager.materialBag.getAmount('qi_refining_ore_huyen')).toBe(1)
  })

  it('quáng phẩm hoang: 10 qi_refining_ore_hoang → 1 foundation_establishment_ore_hoang', () => {
    const gameManager = setup()

    gameManager.materialBag.add(
      materialById('qi_refining_ore_hoang'),
      MATERIAL_TIER_CONVERSION_RATIO,
    )

    const result = gameManager.convertMaterialTier('qi_refining_ore_hoang', 1)

    expect(result.ok).toBe(true)
    expect(gameManager.materialBag.getAmount('qi_refining_ore_hoang')).toBe(0)
    expect(gameManager.materialBag.getAmount('foundation_establishment_ore_hoang')).toBe(1)
  })

  it('quáng Trúc Cơ là trần — không đổi lên được nữa', () => {
    const gameManager = setup()

    gameManager.materialBag.add(
      materialById('foundation_establishment_ore_dia'),
      MATERIAL_TIER_CONVERSION_RATIO,
    )

    const result = gameManager.convertMaterialTier('foundation_establishment_ore_dia', 1)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_higher_tier')
  })

  it('không đủ 10 → từ chối, KHÔNG trừ gì (atomic)', () => {
    const gameManager = setup()

    gameManager.materialBag.add(materialById('mortal_wood'), MATERIAL_TIER_CONVERSION_RATIO - 1)

    const result = gameManager.convertMaterialTier('mortal_wood', 1)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('insufficient')
    expect(gameManager.materialBag.getAmount('mortal_wood')).toBe(
      MATERIAL_TIER_CONVERSION_RATIO - 1,
    )
    expect(gameManager.materialBag.getAmount('qi_refining_wood')).toBe(0)
  })

  it('times > 1 đổi theo lô: 30 gỗ Phàm Nhân → 3 gỗ Luyện Khí', () => {
    const gameManager = setup()

    gameManager.materialBag.add(materialById('mortal_wood'), MATERIAL_TIER_CONVERSION_RATIO * 3)

    const result = gameManager.convertMaterialTier('mortal_wood', 3)

    expect(result.ok).toBe(true)
    expect(gameManager.materialBag.getAmount('mortal_wood')).toBe(0)
    expect(gameManager.materialBag.getAmount('qi_refining_wood')).toBe(3)
  })

  it('times không hợp lệ (0/âm/lẻ/NaN) → từ chối, không đổi gì', () => {
    const gameManager = setup()

    gameManager.materialBag.add(materialById('mortal_wood'), MATERIAL_TIER_CONVERSION_RATIO * 5)

    for (const times of [0, -1, 1.5, Number.NaN]) {
      expect(gameManager.convertMaterialTier('mortal_wood', times).ok).toBe(false)
    }

    expect(gameManager.materialBag.getAmount('mortal_wood')).toBe(
      MATERIAL_TIER_CONVERSION_RATIO * 5,
    )
    expect(gameManager.materialBag.getAmount('qi_refining_wood')).toBe(0)
  })

  it('biến thể phẩm của gỗ (mortal_wood_huyen) KHÔNG quy đổi', () => {
    const gameManager = setup()

    gameManager.materialBag.add(materialById('mortal_wood_huyen'), MATERIAL_TIER_CONVERSION_RATIO)

    const result = gameManager.convertMaterialTier('mortal_wood_huyen', 1)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_higher_tier')
    expect(gameManager.materialBag.getAmount('mortal_wood_huyen')).toBe(
      MATERIAL_TIER_CONVERSION_RATIO,
    )
  })

  it('material không phải gỗ/quáng (tinh_hoa_pham_the) → từ chối', () => {
    const gameManager = setup()

    gameManager.materialBag.add(materialById('tinh_hoa_pham_the'), MATERIAL_TIER_CONVERSION_RATIO)

    const result = gameManager.convertMaterialTier('tinh_hoa_pham_the', 1)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_higher_tier')
  })

  it('đổi liên tiếp 2 bậc KHÔNG tạo nhân bản (100 gỗ Phàm → 1 gỗ Trúc Cơ)', () => {
    const gameManager = setup()

    gameManager.materialBag.add(materialById('mortal_wood'), MATERIAL_TIER_CONVERSION_RATIO ** 2)

    expect(gameManager.convertMaterialTier('mortal_wood', MATERIAL_TIER_CONVERSION_RATIO).ok).toBe(
      true,
    )
    expect(gameManager.convertMaterialTier('qi_refining_wood', 1).ok).toBe(true)

    expect(gameManager.materialBag.getAmount('mortal_wood')).toBe(0)
    expect(gameManager.materialBag.getAmount('qi_refining_wood')).toBe(0)
    expect(gameManager.materialBag.getAmount('foundation_establishment_wood')).toBe(1)
  })
})
