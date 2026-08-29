import { getRealmTier } from '../realm/RealmTierMap'
import { getSpiritStoneMaterialIdForRealmTier } from '../material/SpiritStoneMaterial'
import { SPIRIT_STONE_CONVERSION_RATIO } from '../material/SpiritStoneMaterial'

// economy-fixes-sinks-plan §3.2 B1 (2026-08-29) — Tụ Linh Trận:
// đổi Linh Thạch lấy % tốc độ tu luyện tạm thời (buff 24h).
export const TU_LINH_TRAN_EFFECT_GROUP = 'tu_linh_tran'
export const TU_LINH_TRAN_DURATION_MS = 24 * 60 * 60 * 1000
export const TU_LINH_TRAN_BUFF_PERCENT = 0.25
export const TU_LINH_TRAN_COST_BASE = 50
export const TU_LINH_TRAN_COST_ESCALATION = 1.5
export const TU_LINH_TRAN_REALM_GROWTH_BASE = 3

export function getTuLinhTranCost(
  realmId: string,
  activeStacks: number,
): { materialId: string; amount: number } {
  const tier = getRealmTier(realmId)
  const tierIndex = tier - 1
  const rawInHa = Math.round(
    TU_LINH_TRAN_COST_BASE *
      Math.pow(TU_LINH_TRAN_COST_ESCALATION, activeStacks) *
      Math.pow(TU_LINH_TRAN_REALM_GROWTH_BASE, tierIndex),
  )
  const materialId = getSpiritStoneMaterialIdForRealmTier(tier)
  const factor = Math.pow(SPIRIT_STONE_CONVERSION_RATIO, Math.max(0, tier - 4))
  const amount = Math.max(1, Math.ceil(rawInHa / factor))

  return { materialId, amount }
}