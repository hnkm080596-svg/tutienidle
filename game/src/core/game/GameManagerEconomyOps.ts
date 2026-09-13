import { VendorSystem } from '../economy/VendorSystem'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import type { PlayerData } from '../player/Player'
import { getRealmTier } from '../realm/RealmTierMap'
import type { AlchemyRecipe } from '../alchemy/AlchemySystem'

/**
 * Vendor (Hoa Ban / Ky Bao Coc) economy operations. Extracted from
 * GameManager (large-file split); moved verbatim.
 *
 * Public access: `gameManager.economyOps.*` (no GameManager facade).
 */
export class GameManagerEconomyOps {
  constructor(
    private readonly deps: {
      materialRegistry: MaterialRegistry
      materialBag: MaterialBag
      getAlchemyRecipes: () => AlchemyRecipe[]
      notifyQuestMaterialGained: (materialId: string, amount: number) => void
    },
  ) {}

  /**
   * HOA BAN (economy-fixes-sinks-plan §3.2 B2, 2026-08-29) - sells spare
   * materials to the Vendor for same-tier spirit stones. VendorSystem is
   * created per-call (small, stateless) with the registry + the current
   * recipe list - the sole-ingredient guard needs every recipe's
   * herbVariants.
   */
  sellMaterialToVendor(
    materialId: string,
    amount: number,
    player: PlayerData,
  ): { ok: boolean; reason?: string; gained?: number } {
    const vendorSystem = new VendorSystem(this.deps.materialRegistry, this.deps.getAlchemyRecipes())

    const result = vendorSystem.sellMaterial(this.deps.materialBag, materialId, amount, player.realmId)

    if (result.ok && result.gained) {
      this.deps.notifyQuestMaterialGained(
        getSpiritStoneMaterialIdForRealmTier(getRealmTier(player.realmId)),
        result.gained,
      )
    }

    return result
  }

  /**
   * The list of materials the player OWNS and can sell to the Vendor
   * (Ky Bao Coc, 2026-08-30) - used by VendorPanel.vue for the UI list;
   * kept separate from sellMaterialToVendor() (the action) so the panel
   * does not duplicate the category/price filter logic.
   */
  getVendorSellableRows(
    player: PlayerData,
  ): Array<{ materialId: string; name: string; owned: number; unitPrice: number }> {
    const vendorSystem = new VendorSystem(this.deps.materialRegistry, this.deps.getAlchemyRecipes())

    const rows: Array<{ materialId: string; name: string; owned: number; unitPrice: number }> = []

    for (const stack of this.deps.materialBag.getAll()) {
      const unitPrice = vendorSystem.getUnitSellPrice(stack.material.id, player.realmId)

      if (unitPrice === undefined) {
        continue
      }

      rows.push({
        materialId: stack.material.id,
        name: stack.material.name,
        owned: stack.amount,
        unitPrice,
      })
    }

    return rows
  }
}
