// VendorSystem (economy-fixes-sinks-plan sec3.2 B2, 2026-08-29) - Hoa Ban:
// ban nguyen lieu thua (herb/wood/ore/essence/byproduct) lay Linh Thach
// dung pham theo realm. Giao dich atomic: tru material -> neu cong Linh
// Thach tran stack thi hoan lai material va tu choi.
// gp123 6G (2026-09-06): thu mua chi nhan material pham NGHE THAP HON
// canh gioi nguoi choi (gate sell-by-grade) - pham suy tu meta nghe
// profession.realmId qua PROFESSION_GRADE_BY_REALM, so bang
// PROFESSION_GRADE_ORDER. Dong pham hoac cao hon -> grade_not_below.
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

/** Thao DUY NHAT cua mot dan phuong - ban het thi dan phuong mat nguyen lieu. */
interface RecipeHerbVariant {
  materialId: string
}

/**
 * Pham nghe cua material suy tu meta nghe (nguon su that
 * PROFESSION_GRADE_BY_REALM - cung pattern DecomposeSystem.parseOre).
 * Essence/byproduct khong co meta nghe du tot -> undefined, khong the
 * chung minh "pham thap hon" -> bi gate loai.
 */
function getMaterialGrade(material: Material): ProfessionGrade | undefined {
  return material.profession?.realmId !== undefined
    ? PROFESSION_GRADE_BY_REALM[material.profession.realmId]
    : undefined
}

/**
 * Gate 6G: material chi ban duoc khi pham nghe NGHIEM NGAT thap hon pham
 * suy tu canh gioi nguoi choi. Material khong suy duoc pham -> false.
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

  /**
   * gp123 6G: getUnitSellPrice nhan realmId = CANH GIOI NGUOI CHOI (tu
   * GameManager thread player.$state.realmId). Tra undefined khi pham
   * material KHONG thap hon - caller dung no de loc rows nen gate tu
   * ap cho moi duong liet ke.
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
   * Material chi con lai MOT bien the thao trong DUNG 1 dan phuong nao do
   * (sole ingredient). Dan phuong se mat nguyen lieu duy nhat neu nguoi
   * choi ban het stack (remaining = 0) - chan giao dich do.
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
   * Single authority for the sell->stone conversion. unitPrice is
   * ha-pham-equivalent; the real grant is floor(raw / conversionFactor)
   * where the factor follows the realm-tier stone table (1/100/30000).
   * Returns null when the stack is too small to yield any stone.
   */
  private quoteStoneGrant(
    unitPrice: number,
    amount: number,
    realmId: string,
  ): { gainedStone: number; stoneMaterialId: string } | null {
    const tier = getRealmTier(realmId)
    const conversionFactor = tier >= 7 ? 30_000 : tier >= 4 ? 100 : 1
    const gainedStone = Math.floor((unitPrice * amount) / conversionFactor)

    if (gainedStone <= 0) {
      return null
    }

    return { gainedStone, stoneMaterialId: getSpiritStoneMaterialIdForRealmTier(tier) }
  }

  /**
   * Read-only preview of what a sale would grant. Covers sellMaterial's
   * gates that can flip the verdict at preview time: amount validity,
   * known/sellable material, the sole-recipe-ingredient guard (needs the
   * live bag). Omitted by construction: owned<amount (callers clamp to
   * bag contents), bag_full (spirit stones stackLimit=MAX_SAFE_INTEGER),
   * stone registry.has (catalog constant). null = not sellable for this
   * player; granted = 0 means the stack is too small to convert at this
   * realm tier.
   */
  previewSellGrant(
    bag: MaterialBag,
    materialId: string,
    amount: number,
    realmId: string,
  ): { granted: number; stoneMaterialId: string } | null {
    if (!Number.isInteger(amount) || amount <= 0) {
      return null
    }

    const unitPrice = this.getUnitSellPrice(materialId, realmId)

    if (unitPrice === undefined) {
      return null
    }

    if (this.isSoleRecipeIngredient(materialId, bag.getAmount(materialId) - amount)) {
      return null
    }

    const quote = this.quoteStoneGrant(unitPrice, amount, realmId)

    return quote === null ? { granted: 0, stoneMaterialId: '' } : { granted: quote.gainedStone, stoneMaterialId: quote.stoneMaterialId }
  }

  /**
   * Ban `amount` don vi material lay Linh Thach. Tra { ok: true, gained }
   * voi gained = so Linh Thach DA quy doi theo pham realm cua material.
   */
  sellMaterial(
    bag: MaterialBag,
    materialId: string,
    amount: number,
    realmId: string,
  ): { ok: boolean; reason?: string; gained?: number; stoneMaterialId?: string } {
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

    // gp123 6G - gate pham: dong pham hoac cao hon canh gioi nguoi choi
    // -> tu choi. Dat SAU price check de Linh Thach (spirit_stone) van
    // tra not_sellable nhu cu, khong doi reason cua danh muc ngoai gate.
    if (!isGradeBelowPlayer(material, realmId)) {
      return { ok: false, reason: 'grade_not_below' }
    }

    const owned = bag.getAmount(materialId)

    if (owned < amount) {
      return { ok: false, reason: 'invalid_amount' }
    }

    // Sole-ingredient guard - kiem tra "con lai sau khi ban" TRUOC khi tru.
    if (this.isSoleRecipeIngredient(materialId, owned - amount)) {
      return { ok: false, reason: 'sole_recipe_ingredient' }
    }

    const quote = this.quoteStoneGrant(unitPrice, amount, realmId)

    if (quote === null) {
      return { ok: false, reason: 'too_small' }
    }

    const { gainedStone, stoneMaterialId } = quote

    if (!this.registry.has(stoneMaterialId)) {
      return { ok: false, reason: 'unknown_material' }
    }

    // R9 (AR-22) - atomic exchange: preflight the FULL currency credit
    // BEFORE any mutation. A failed sale must leave all balances
    // unchanged (A9) - no debit-then-refund dance.
    const stoneMaterial = this.registry.get(stoneMaterialId)

    if (bag.canAcceptAmount(stoneMaterial, gainedStone) < gainedStone) {
      return { ok: false, reason: 'bag_full' }
    }

    bag.remove(materialId, amount)

    bag.add(stoneMaterial, gainedStone)

    return { ok: true, gained: gainedStone, stoneMaterialId }
  }
}
