import { getRealmTier } from '../realm/RealmTierMap'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
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

/**
 * Active cultivation-speed bonus from tu_linh_tran effects - the
 * domain-owned read (Mission G Task 39): group-filtered AND
 * deadline-checked, matching activateTuLinhTran's group-stack
 * accounting. Stray cultivationSpeedPercent on other groups is ignored.
 */
export function getActiveCultivationSpeedPercent(
  effects: readonly PersistentTimedEffect[],
  nowMs: number,
): number {
  return effects
    .filter((e) => e.effectGroup === TU_LINH_TRAN_EFFECT_GROUP && e.expiresAtMs > nowMs)
    .reduce((sum, e) => sum + (e.cultivationSpeedPercent ?? 0), 0)
}

export interface CultivationSpeedSegment {
  seconds: number
  /** Sum of cultivationSpeedPercent live at this segment's start. */
  percent: number
}

/**
 * EM-02 - split the offline window [windowStartMs, windowEndMs] into
 * segments at each effect's expiry boundary: every segment carries the
 * percent live at its own start (getActiveCultivationSpeedPercent;
 * expiresAtMs > start counts as live). The saved cultivationPerSecond
 * snapshot only reflects buffs at save time - a buff expiring mid-window
 * must not be stretched across the whole window.
 */
export function splitCultivationSpeedWindow(
  effects: readonly PersistentTimedEffect[],
  windowStartMs: number,
  windowEndMs: number,
): CultivationSpeedSegment[] {
  const bounds = new Set<number>([windowStartMs, windowEndMs])

  for (const effect of effects) {
    if (
      effect.effectGroup === TU_LINH_TRAN_EFFECT_GROUP &&
      effect.expiresAtMs > windowStartMs &&
      effect.expiresAtMs < windowEndMs
    ) {
      bounds.add(effect.expiresAtMs)
    }
  }

  const sorted = [...bounds].sort((a, b) => a - b)
  const segments: CultivationSpeedSegment[] = []

  for (let index = 0; index + 1 < sorted.length; index += 1) {
    const start = sorted[index]!

    segments.push({
      seconds: (sorted[index + 1]! - start) / 1000,
      percent: getActiveCultivationSpeedPercent(effects, start),
    })
  }

  return segments
}
