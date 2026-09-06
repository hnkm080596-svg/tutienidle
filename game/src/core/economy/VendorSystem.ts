// VendorSystem (economy-fixes-sinks-plan §3.2 B2, 2026-08-29) — Hóa Bán:
// bán nguyên liệu thừa (herb/wood/ore/essence/byproduct) lấy Linh Thạch
// đúng phẩm theo realm. Giao dịch atomic: trừ material → nếu cộng Linh
// Thạch tràn stack thì hoàn lại material và từ chối.
// gp123 6G (2026-09-06): thu mua chỉ nhận material phẩm NGHỀ THẤP HƠN
// cảnh giới người chơi (gate sell-by-grade) — phẩm suy từ meta nghề
// profession.realmId qua PROFESSION_GRADE_BY_REALM, so bằng
// PROFESSION_GRADE_ORDER. Đồng phẩm hoặc cao hơn → grade_not_below.
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { MaterialBag } from '../material/MaterialBag'
import type { Material } from '../material/Material'
import { getUnitSellPrice } from './VendorBalance'
import { getRealmTier } from '../realm/RealmTierMap'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import {
  PROFESSION_GRADE_ORDER,
  PROFESSION_GRADE_BY_REALM,
  type ProfessionGrade,
} from '../profession/ProfessionGrade'

/** Thảo DUY NHẤT của một đan phương — bán hết thì đan phương mất nguyên liệu. */
interface RecipeHerbVariant {
  materialId: string
}

/**
 * Phẩm nghề của material suy từ meta nghề (nguồn sự thật
 * PROFESSION_GRADE_BY_REALM — cùng pattern DecomposeSystem.parseOre).
 * Essence/byproduct không có meta nghề đủ tốt → undefined, không thể
 * chứng minh "phẩm thấp hơn" → bị gate loại.
 */
function getMaterialGrade(material: Material): ProfessionGrade | undefined {
  return material.profession?.realmId !== undefined
    ? PROFESSION_GRADE_BY_REALM[material.profession.realmId]
    : undefined
}

/**
 * Gate 6G: material chỉ bán được khi phẩm nghề NGHIÊM NGẶT thấp hơn phẩm
 * suy từ cảnh giới người chơi. Material không suy được phẩm → false.
 */
function isGradeBelowPlayer(material: Material, playerRealmId: string): boolean {
  const itemGrade = getMaterialGrade(material)

  if (itemGrade === undefined) {
    return false
  }

  const playerGrade = PROFESSION_GRADE_BY_REALM[playerRealmId]

  if (playerGrade === undefined) {
    return false
  }

  return PROFESSION_GRADE_ORDER.indexOf(itemGrade) < PROFESSION_GRADE_ORDER.indexOf(playerGrade)
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

  /**
   * gp123 6G: getUnitSellPrice nhận realmId = CẢNH GIỚI NGƯỜI CHƠI (từ
   * GameManager thread player.$state.realmId). Trả undefined khi phẩm
   * material KHÔNG thấp hơn — caller dùng nó để lọc rows nên gate tự
   * áp cho mọi đường liệt kê.
   */
  getUnitSellPrice(materialId: string, realmId: string): number | undefined {
    if (!this.registry.has(materialId)) {
      return undefined
    }

    const material = this.registry.get(materialId)

    if (!isGradeBelowPlayer(material, realmId)) {
      return undefined
    }

    return getUnitSellPrice(material, realmId)
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

    // gp123 6G — gate phẩm: đồng phẩm hoặc cao hơn cảnh giới người chơi
    // → từ chối. Đặt SAU price check để Linh Thạch (spirit_stone) vẫn
    // trả not_sellable như cũ, không đổi reason của danh mục ngoài gate.
    if (!isGradeBelowPlayer(material, realmId)) {
      return { ok: false, reason: 'grade_not_below' }
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
