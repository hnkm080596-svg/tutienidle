import type { ProductionSiteState } from './ProductionTypes'
import { resolveProductionWorkerCapacity } from './WorkerCapacity'

/**
 * Mission D (spec D1) - the ONE authoritative workforce view.
 * Presentation renders it verbatim and never recomputes capacity or
 * the allocation itself (A2/A7/A9).
 */
export interface WorkforceView {
  /** Total CHQ worker capacity (autoWorkerCapacity on the player). */
  total: number

  /**
   * Workers reserved ahead of production. DIRECT DECOMPOSE REWORK
   * (2026-10-11): decompose retired its worker claim, so this is
   * always 0 today - the field stays so existing presentation
   * ("N worker(s) reserved") degrades to "never shown" instead of
   * breaking, and a future reservation source can reuse the slot.
   */
  reserved: number

  /** Pool left for production: max(0, total - reserved). */
  available: number

  /** Player-requested manual assignments: siteId -> count (auto sites absent). */
  requested: Record<string, number>

  /** Last allocator grant per site: siteId -> activeWorkerSlots. */
  effective: Record<string, number>

  /** Available workers not granted to any site on the last allocation pass. */
  idle: number
}

export function buildWorkforceView(
  totalWorkerCapacity: number,
  states: readonly ProductionSiteState[],
): WorkforceView {
  // D3 - pool inputs normalize through the ONE shared rule; the view
  // never re-sanitizes total on its own.
  const total = resolveProductionWorkerCapacity(totalWorkerCapacity)

  // No claimant reserves workers ahead of production today (see the
  // `reserved` field doc) - the whole pool is available.
  const reserved = 0
  const available = total

  const requested: Record<string, number> = {}
  const effective: Record<string, number> = {}

  for (const state of states) {
    if (state.assignedWorkers !== undefined) {
      requested[state.siteId] = state.assignedWorkers
    }
    effective[state.siteId] = state.activeWorkerSlots
  }
  const used = Object.values(effective).reduce((sum, count) => sum + count, 0)

  return {
    total,
    reserved,
    available,
    requested,
    effective,
    idle: Math.max(0, available - used),
  }
}
