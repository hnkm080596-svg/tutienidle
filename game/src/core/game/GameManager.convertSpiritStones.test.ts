import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import {
  SPIRIT_STONE_CONVERSION_RATIO,
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_MATERIAL_ID,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
} from '../material/SpiritStoneMaterial'

// T2 (economy-ecosystem-plan, review 2026-08-28): quy đổi Linh Thạch
// 1 CHIỀU LÊN — atomic, không nhân bản, không chiều ngược.
function setup() {
  const gameManager = new GameManager()

  gameManager.registerMaterials([
    SPIRIT_STONE_MATERIAL,
    SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
    SPIRIT_STONE_THUONG_PHAM_MATERIAL,
  ])

  return gameManager
}

describe('GameManager — quy đổi Linh Thạch lên phẩm (T2)', () => {
  it('100 Hạ đổi đúng 1 Trung, trừ đúng 100 Hạ', () => {
    const gameManager = setup()

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, SPIRIT_STONE_CONVERSION_RATIO)

    const result = gameManager.convertSpiritStonesUp(SPIRIT_STONE_MATERIAL_ID, 1)

    expect(result.ok).toBe(true)
    expect(result.gained).toBe(1)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(1)
  })

  it('100 Trung đổi đúng 1 Thượng', () => {
    const gameManager = setup()

    gameManager.materialBag.add(SPIRIT_STONE_TRUNG_PHAM_MATERIAL, SPIRIT_STONE_CONVERSION_RATIO)

    const result = gameManager.convertSpiritStonesUp(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID, 1)

    expect(result.ok).toBe(true)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(0)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID)).toBe(1)
  })

  it('không đủ 100 → từ chối, KHÔNG trừ gì (atomic)', () => {
    const gameManager = setup()

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, SPIRIT_STONE_CONVERSION_RATIO - 1)

    const result = gameManager.convertSpiritStonesUp(SPIRIT_STONE_MATERIAL_ID, 1)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('insufficient')
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(
      SPIRIT_STONE_CONVERSION_RATIO - 1,
    )
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(0)
  })

  it('times > 1 đổi theo lô: 300 Hạ → 3 Trung', () => {
    const gameManager = setup()

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, SPIRIT_STONE_CONVERSION_RATIO * 3)

    const result = gameManager.convertSpiritStonesUp(SPIRIT_STONE_MATERIAL_ID, 3)

    expect(result.ok).toBe(true)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(3)
  })

  it('Thượng phẩm là trần — không có phẩm cao hơn để đổi', () => {
    const gameManager = setup()

    gameManager.materialBag.add(SPIRIT_STONE_THUONG_PHAM_MATERIAL, SPIRIT_STONE_CONVERSION_RATIO)

    const result = gameManager.convertSpiritStonesUp(SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID, 1)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_higher_tier')
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID)).toBe(
      SPIRIT_STONE_CONVERSION_RATIO,
    )
  })

  it('times không hợp lệ (0/âm/lẻ) → từ chối, không đổi gì', () => {
    const gameManager = setup()

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, SPIRIT_STONE_CONVERSION_RATIO * 5)

    for (const times of [0, -1, 1.5, Number.NaN]) {
      expect(gameManager.convertSpiritStonesUp(SPIRIT_STONE_MATERIAL_ID, times).ok).toBe(false)
    }

    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(
      SPIRIT_STONE_CONVERSION_RATIO * 5,
    )
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(0)
  })

  it('materialId lạ → từ chối', () => {
    const gameManager = setup()

    const result = gameManager.convertSpiritStonesUp('linh_chi', 1)

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_higher_tier')
  })

  it('đổi liên tiếp 2 bậc KHÔNG tạo nhân bản (tổng giá trị bảo toàn 1 chiều)', () => {
    const gameManager = setup()

    gameManager.materialBag.add(SPIRIT_STONE_MATERIAL, SPIRIT_STONE_CONVERSION_RATIO ** 2)

    expect(gameManager.convertSpiritStonesUp(SPIRIT_STONE_MATERIAL_ID, SPIRIT_STONE_CONVERSION_RATIO).ok).toBe(true)
    expect(gameManager.convertSpiritStonesUp(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID, 1).ok).toBe(true)

    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(0)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID)).toBe(0)
    expect(gameManager.materialBag.getAmount(SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID)).toBe(1)
  })
})
