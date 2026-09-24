import { describe, it, expect } from 'vitest'
import { ENEMIES } from './Enemies'
import { materials as MATERIALS } from '../materials/materials'
import { SPECIAL_ALCHEMY_RECIPES, alchemyRecipes } from '../alchemy/alchemyRecipes'
import { pills } from '../pill/pills'

describe('Quái ẩn + Yêu Đan (spec dot-pha-loi-kiep §4.1b/c)', () => {
  it('Huyết Mông tồn tại, realm Luyện Khí, KHÔNG boss/elite', () => {
    const beast = ENEMIES.find((e) => e.id === 'huyet_mong')
    expect(beast).toBeDefined()
    expect(beast!.realmId).toBe('qi_refining')
    expect(beast!.isElite).toBeUndefined()
    expect(beast!.isBoss).toBeUndefined()
  })

  // M-QI-10: the band map governs stage tables, not signature drops -
  // the hand-placed Pham catch-up valve survives the drop-band swap.
  it('Huyết Mông giữ signature Tinh Hoa Phàm Thể x12 (catch-up valve, M-QI-10 exception)', () => {
    const beast = ENEMIES.find((e) => e.id === 'huyet_mong')!
    const drop = beast.signatureDrops?.find((d) => d.itemId === 'tinh_hoa_pham_the')
    expect(drop).toBeDefined()
    expect(drop!.chance).toBe(1)
    expect(drop!.amount).toEqual({ min: 12, max: 12 })
  })

  it('mọi material mới khai báo trong MATERIALS (không mồ côi)', () => {
    const ids = new Set(MATERIALS.map((m) => m.id))
    expect(ids.has('yeu_dan_hung_giao')).toBe(true)
    // thien_dia_chi_kieu retired 2026-09-23 (hidden-perfection-lineage
    // sec.19): no census assert remains for it.
  })

  it('Hung Giao Xà (boss LK t10) rơi Yêu Đan 100% qua signatureDrops', () => {
    const boss = ENEMIES.find((e) => e.id === 'ferocious_flood_serpent')!
    const drop = boss.signatureDrops?.find((d) => d.itemId === 'yeu_dan_hung_giao')
    expect(drop).toBeDefined()
    expect(drop!.chance).toBe(1)
    expect(drop!.amount).toEqual({ min: 1, max: 1 })
    expect(drop!.requiresModifier).toBe('boss')
  })

  it('recipe Thông Mạch Đan + Trúc Cơ Đan tồn tại, nguyên liệu chính là Yêu Đan', () => {
    const thongMach = SPECIAL_ALCHEMY_RECIPES.find((r) => r.pillId === 'thong_mach_dan')
    expect(thongMach).toBeDefined()
    expect(thongMach!.specialIngredients?.some((s) => s.materialId === 'yeu_dan_hung_giao')).toBe(true)
    const trucCo = SPECIAL_ALCHEMY_RECIPES.find((r) => r.pillId === 'truc_co_dan')
    expect(trucCo).toBeDefined()
    expect(trucCo!.specialIngredients?.some((s) => s.materialId === 'yeu_dan_hung_giao')).toBe(true)
    // 2 recipe nam trong danh sach chung de UI/registry thay
    expect(alchemyRecipes.some((r) => r.pillId === 'thong_mach_dan')).toBe(true)
    expect(alchemyRecipes.some((r) => r.pillId === 'truc_co_dan')).toBe(true)
  })

  it('pill Thông Mạch Đan + Trúc Cơ Đan tồn tại (type material — không uống)', () => {
    const thongMach = pills.find((p) => p.id === 'thong_mach_dan')
    expect(thongMach).toBeDefined()
    expect(thongMach!.type).toBe('material')
    const trucCo = pills.find((p) => p.id === 'truc_co_dan')
    expect(trucCo).toBeDefined()
    expect(trucCo!.type).toBe('material')
  })
})
