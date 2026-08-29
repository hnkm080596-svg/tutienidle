import { describe, it, expect } from 'vitest'
import { ENEMIES } from './Enemies'
import { materials as MATERIALS } from '../materials/materials'
import { SPECIAL_ALCHEMY_RECIPES, alchemyRecipes } from '../alchemy/alchemyRecipes'
import { pills } from '../pill/pills'

describe('Quái ẩn + Yêu Đan + Thiên Địa Chi Kiều (spec dot-pha-loi-kiep §4.1b/c)', () => {
  it('Huyết Mông tồn tại, realm Luyện Khí, KHÔNG boss/elite', () => {
    const beast = ENEMIES.find((e) => e.id === 'huyet_mong')
    expect(beast).toBeDefined()
    expect(beast!.realmId).toBe('qi_refining')
    expect(beast!.isElite).toBeUndefined()
    expect(beast!.isBoss).toBeUndefined()
  })

  it('Huyết Mông rơi Thiên Địa Chi Kiều 5%', () => {
    const beast = ENEMIES.find((e) => e.id === 'huyet_mong')!
    const drop = beast.rewards.itemDrops?.find((d) => d.itemId === 'thien_dia_chi_kieu')
    expect(drop).toBeDefined()
    expect(drop!.chance).toBe(0.05)
  })

  it('mọi material mới khai báo trong MATERIALS (không mồ côi)', () => {
    const ids = new Set(MATERIALS.map((m) => m.id))
    expect(ids.has('yeu_dan_hung_giao')).toBe(true)
    expect(ids.has('thien_dia_chi_kieu')).toBe(true)
  })

  it('Hung Giao Xà (boss LK t10) rơi Yêu Đan 100% qua bossRewards', () => {
    const boss = ENEMIES.find((e) => e.id === 'ferocious_flood_serpent')!
    const drop = boss.bossRewards?.itemDrops?.find((d) => d.itemId === 'yeu_dan_hung_giao')
    expect(drop).toBeDefined()
    expect(drop!.chance).toBe(1)
    expect(drop!.amount).toBe(1)
  })

  it('recipe Thông Mạch Đan + Trúc Cơ Đan tồn tại, nguyên liệu chính là Yêu Đan', () => {
    const thongMach = SPECIAL_ALCHEMY_RECIPES.find((r) => r.pillId === 'thong_mach_dan')
    expect(thongMach).toBeDefined()
    expect(thongMach!.specialIngredients?.some((s) => s.materialId === 'yeu_dan_hung_giao')).toBe(true)
    const trucCo = SPECIAL_ALCHEMY_RECIPES.find((r) => r.pillId === 'truc_co_dan')
    expect(trucCo).toBeDefined()
    expect(trucCo!.specialIngredients?.some((s) => s.materialId === 'yeu_dan_hung_giao')).toBe(true)
    // 2 recipe nằm trong danh sách chung để UI/registry thấy
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
