import type { MaterialReceipt } from '../material/MaterialReceipt'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import type { PlayerData } from '../player/Player'
import type { AlchemyRecipe } from '../alchemy/AlchemySystem'

// Legacy command compatibility. The Vendor remains an art-only building.
export class GameManagerEconomyOps {
  constructor(_deps: {
    materialRegistry: MaterialRegistry
    materialBag: MaterialBag
    getAlchemyRecipes: () => AlchemyRecipe[]
    notifyMaterialGained: (materialId: string, amount: number, receipt: MaterialReceipt | null) => void
  }) {}

  sellMaterialToVendor(
    _materialId: string,
    _amount: number,
    _player: PlayerData,
  ): { ok: boolean; reason?: string; gained?: number; stoneMaterialId?: string } {
    return { ok: false, reason: 'retired' }
  }

  previewVendorSale(
    _materialId: string,
    _amount: number,
    _player: PlayerData,
  ): { granted: number; stoneName: string } | null {
    return null
  }

  getVendorSellableRows(
    _player: PlayerData,
  ): Array<{ materialId: string; name: string; owned: number; unitPrice: number }> {
    return []
  }
}
