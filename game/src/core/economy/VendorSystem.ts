// VendorSystem (economy-fixes-sinks-plan §3.2 B2, 2026-08-29) — Hóa Bán:
// bán nguyên liệu thừa (herb/wood/ore/essence/byproduct) lấy Linh Thạch
// đúng phẩm theo realm. Giao dịch atomic: trừ material → nếu cộng Linh
// Thạch tràn stack thì hoàn lại material và từ chối.
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { MaterialBag } from '../material/MaterialBag'
import { getUnitSellPrice } from './VendorBalance'
import { getRealmTier } from '../realm/RealmTierMap'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'

/** Thảo DUY NHẤT của một đan phương — bán hết thì đan phương mất nguyên liệu. */
interface RecipeHerbVariant {
  materialId: string
}

export class VendorSystem {
  constructor(
    private readonly registry: MaterialRegistry,

    private readonly alchemyRecipes: readonly {
      herbVariants: readonly RecipeHerbVariant[]
    }[],
  ) {}

  isSellable(materialId: string): boolean {
    if (!this.registry.has(materialId)) {
      return false
    }

    return getUnitSellPrice(this.registry.get(materialId), 'mortal') !== undefined
  }

  getUnitSellPrice(materialId: string, realmId: string): number | undefined {
    if (!this.registry.has(materialId)) {
      return undefined
    }

    return getUnitSellPrice(this.registry.get(materialId), realmId)
  }

  /**
   * Material chỉ còn lại MỘT biến thể thảo trong ĐÚNG 1 đan phương nào đó
   * (sole ingredient). Đan phương sẽ mất nguyên liệu duy nhất nếu người
   * chơi bán hết stack (remaining = 0) — chặn giao dịch đó.
   */
  private isSoleRecipeIngredient(materialId: string, remainingAfterSale: number): boolean {
    if (remainingAfterSale > 0) {
      return false
    }

    return this.alchemyRecipes.some(
      (recipe) =>
        recipe.herbVariants.length === 1 && recipe.herbVariants[0]!.materialId === materialId,
    )
  }

  /**
   * Bán `amount` đơn vị material lấy Linh Thạch. Trả { ok: true, gained }
   * với gained = số Linh Thạch ĐÃ quy đổi theo phẩm realm của material.
   */
  sellMaterial(
    bag: MaterialBag,
    materialId: string,
    amount: number,
    realmId: string,
  ): { ok: boolean; reason?: string; gained?: number } {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: false, reason: 'invalid_amount' }
    }

    if (!this.registry.has(materialId)) {
      return { ok: false, reason: 'unknown_material' }
    }

    const material = this.registry.get(materialId)

    const unitPrice = getUnitSellPrice(material, realmId)

    if (unitPrice === undefined) {
      return { ok: false, reason: 'not_sellable' }
    }

    const owned = bag.getAmount(materialId)

    if (owned < amount) {
      return { ok: false, reason: 'invalid_amount' }
    }

    // Sole-ingredient guard — kiểm tra "còn lại sau khi bán" TRƯỚC khi trừ.
    if (this.isSoleRecipeIngredient(materialId, owned - amount)) {
      return { ok: false, reason: 'sole_recipe_ingredient' }
    }

    const tier = getRealmTier(realmId)

    // conversionFactor: 1 (hạ), 100 (trung), 30000 (thượng) — khớp
    // getSpiritStoneMaterialIdForRealmTier (trung bắt đầu tier 4, thượng
    // tier 7). Plan dẫn công thức Math.pow(RATIO, tier-4) nhưng bảng 1/100/
    // 30000 không sinh ra từ luỹ thừa của 100 — theo đúng BẢNG (intent).
    const conversionFactor = tier >= 7 ? 30_000 : tier >= 4 ? 100 : 1

    const rawHa = unitPrice * amount

    const gainedStone = Math.floor(rawHa / conversionFactor)

    if (gainedStone <= 0) {
      return { ok: false, reason: 'too_small' }
    }

    const stoneMaterialId = getSpiritStoneMaterialIdForRealmTier(tier)

    if (!this.registry.has(stoneMaterialId)) {
      return { ok: false, reason: 'unknown_material' }
    }

    bag.remove(materialId, amount)

    const overflow = bag.add(this.registry.get(stoneMaterialId), gainedStone)

    if (overflow > 0) {
      // Hoàn lại toàn bộ material — atomic, không để người chơi mất trắng.
      bag.add(material, amount)

      return { ok: false, reason: 'bag_full' }
    }

    return { ok: true, gained: gainedStone }
  }
}
