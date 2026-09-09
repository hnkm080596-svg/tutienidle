import type { Material } from './Material'

/**
 * R9 (AR-34) - explicit partial-delivery receipt for material/pill
 * acquisition. Reward orchestration publishes notices and quest facts
 * from DELIVERED amounts only; restore must not emit new-acquisition
 * receipts (A3/A9: "Do not emit new-acquisition events while rebuilding
 * a saved bag").
 */
export type AcquisitionReason =
  | 'loot'
  | 'craft'
  | 'quest_claim'
  | 'building_collect'
  | 'production_settle'
  | 'decompose'
  | 'restore'

export interface AcquisitionReceipt {
  /** Canonical material/pill id that was requested. */
  itemId: string
  requested: number
  /** Amount that actually entered the bag (requested - overflow). */
  delivered: number
  /** Amount lost to a full bag (0 when the delivery fit). */
  overflow: number
  reason: AcquisitionReason
}

/** Build a receipt from a bag.add() overflow return value. */
export function receiptFromOverflow(
  itemId: string,
  requested: number,
  overflow: number,
  reason: AcquisitionReason,
): AcquisitionReceipt {
  const safeRequested = Math.max(0, Math.floor(requested))
  const safeOverflow = Math.max(0, Math.floor(overflow))

  return {
    itemId,
    requested: safeRequested,
    delivered: Math.max(0, safeRequested - safeOverflow),
    overflow: safeOverflow,
    reason,
  }
}

/** Identity guard for Material/lookup wiring at receipt build sites. */
export function receiptItemId(material: Material | { id: string }): string {
  return material.id
}
