import type { ProductionSiteState } from './ProductionTypes'
import { resolveProductionWorkerCapacity } from './WorkerCapacity'

/**
 * Mission D (spec D1) — the ONE authoritative workforce view.
 * Presentation renders it verbatim and never recomputes capacity,
 * the decompose reservation, or the allocation itself (A2/A7/A9).
 */
export interface WorkforceView {
  /** Total CHQ worker capacity (autoWorkerCapacity on the player). */
  total: number

  /** Workers claimed by decompose before production sees the pool. */
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
  decomposeWorkers: number,
  states: readonly ProductionSiteState[],
): WorkforceView {
  const total = Number.isFinite(totalWorkerCapacity)
    ? Math.max(0, Math.floor(totalWorkerCapacity))
    : 0

  const reserved = Number.isFinite(decomposeWorkers)
    ? Math.max(0, Math.floor(decomposeWorkers))
    : 0

  const requested: Record<string, number> = {}
  const effective: Record<string, number> = {}

  for (const state of states) {
    if (state.assignedWorkers !== undefined) {
      requested[state.siteId] = state.assignedWorkers
    }
    effective[state.siteId] = state.activeWorkerSlots
  }

  const available = resolveProductionWorkerCapacity(total, reserved)
  const used = Object.values(effective).reduce((sum, count) => sum + count, 0)

  return { total, reserved, available, requested, effective, idle: Math.max(0, available - used) }
}
