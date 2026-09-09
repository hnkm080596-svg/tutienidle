import type { EquipmentBag } from './EquipmentBag'
import type { EquipmentInstance } from './EquipmentInstance'
import { ITEM_QUALITY_ESSENCE_RANGE } from './ItemQualityBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'

export interface DissolveResult {
  ok: boolean

  reason?: string

  rewards?: Array<{ materialId: string; amount: number }>
}

/**
 * HÓA LUYỆN (plan §7.5) — chuyển đổi hàng loạt equipment instance thành
 * Luyện Khí Tinh Hoa. Tách khỏi EquipmentSystem (Task 9, perf-optimize-pass
 * Phase 5, sibling-file split) — hành vi giữ NGUYÊN 1:1, chỉ đổi chỗ ở.
 *
 * Guards (§7.5): item đang trang bị / locked / favorite bị từ chối.
 * Số Tinh Hoa theo bảng ITEM_QUALITY_ESSENCE_RANGE; mọi Phẩm trang bị
 * cùng trả một loại Luyện Khí Tinh Hoa.
 *
 * `discardRefinePreview` là callback do EquipmentSystem truyền vào — huỷ
 * pending Refine preview (state của EquipmentSystem, KHÔNG thuộc dissolve)
 * trước khi item bị xoá khỏi túi, giữ đúng hành vi gốc mà không cần
 * dissolve biết về pendingRefinePreview.
 */
export function dissolveInstances(
  instanceIds: readonly string[],
  inventory: EquipmentBag,
  discardRefinePreview: (instanceId: string) => void,
  random: () => number = Math.random,
): DissolveResult {
  if (instanceIds.length === 0) {
    return { ok: false, reason: 'empty_selection' }
  }

  // Dedupe — selection trùng id (UI double-submit/race) từng khiến pass 1
  // tính reward 2 lần trong khi pass 2 chỉ remove 1 lần → nhân bản Tinh
  // Hoa (review 2026-08-28).
  const uniqueIds = Array.from(new Set(instanceIds))

  const instances: EquipmentInstance[] = []

  const rewards: Array<{ materialId: string; amount: number }> = []

  // Pass 1 — validate TOÀN BỘ selection + tính trước rewards.
  for (const instanceId of uniqueIds) {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return { ok: false, reason: 'not_found' }
    }

    if (instance.equipped) {
      return { ok: false, reason: 'equipped' }
    }

    if (instance.locked) {
      return { ok: false, reason: 'locked' }
    }

    if (instance.favorite) {
      return { ok: false, reason: 'favorite' }
    }

    const range = ITEM_QUALITY_ESSENCE_RANGE[instance.quality]

    if (!range) {
      return { ok: false, reason: 'no_conversion_rule' }
    }

    const amount = Math.floor(range.min + random() * (range.max - range.min + 1))

    instances.push(instance)

    rewards.push({ materialId: LUYEN_KHI_TINH_HOA_ID, amount })
  }

  // Pass 2 — all-or-nothing transaction: xoá đúng item rồi cộng
  // Tinh Hoa trong cùng thao tác (§7.5).
  for (const instance of instances) {
    discardRefinePreview(instance.instanceId)
    inventory.remove(instance.instanceId)
  }

  return { ok: true, rewards }
}

/**
 * R9 (AR-23 4d) — authoritative dissolve quote. Same validation as
 * dissolveInstances (dedupe + rejection), aggregation into per-material
 * min/max ranges; read-only (no state mutation, no preview discard).
 */
export function quoteDissolveRewards(
  instanceIds: readonly string[],
  inventory: EquipmentBag,
): { ok: boolean; reason?: string; totals?: Array<{ materialId: string; minAmount: number; maxAmount: number }> } {
  if (instanceIds.length === 0) {
    return { ok: false, reason: 'empty_selection' }
  }

  // Dedupe - same selection semantics as the commit path.
  const uniqueIds = Array.from(new Set(instanceIds))

  const totals = new Map<string, { min: number; max: number }>()

  for (const instanceId of uniqueIds) {
    const instance = inventory.get(instanceId)

    if (!instance) {
      return { ok: false, reason: 'not_found' }
    }

    if (instance.equipped) {
      return { ok: false, reason: 'equipped' }
    }

    if (instance.locked) {
      return { ok: false, reason: 'locked' }
    }

    if (instance.favorite) {
      return { ok: false, reason: 'favorite' }
    }

    const range = ITEM_QUALITY_ESSENCE_RANGE[instance.quality]

    if (!range) {
      return { ok: false, reason: 'no_conversion_rule' }
    }

    const entry = totals.get(LUYEN_KHI_TINH_HOA_ID) ?? { min: 0, max: 0 }

    entry.min += range.min

    entry.max += range.max

    totals.set(LUYEN_KHI_TINH_HOA_ID, entry)
  }

  return {
    ok: true,
    totals: Array.from(totals, ([materialId, value]) => ({
      materialId,
      minAmount: value.min,
      maxAmount: value.max,
    })),
  }
}
