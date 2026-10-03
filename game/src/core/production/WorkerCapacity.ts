import { isScopeHidden } from '../betaScope'

/** Nhan cong toi da theo cap Chieu Hien Quan - cong thuc user chot
 *  (roadmap 6C: "Nhan cong toi da = 1 + cap Chieu Hien Quan x 2").
 *  Chua xay CHQ (level 0) = 0 nhan cong; cap 1 -> 3; cap 9 -> 19. */
export function getWorkerCapacityForLevel(chiHienQuanLevel: number): number {
  if (!Number.isFinite(chiHienQuanLevel) || chiHienQuanLevel <= 0) {
    return 0
  }

  return 1 + chiHienQuanLevel * 2
}

/**
 * Mission D (spec D5) - the ONE worker-pool split rule: decompose
 * claims `decomposeWorkers` from the CHQ pool FIRST; production
 * receives the remainder. Consumed by the online tick
 * (GameManagerTickOps), the offline restore settle
 * (GameManagerSaveRestore) and the UI read model (WorkforceView).
 * Callers never recompute `total - workers` inline (A9).
 */
export function resolveProductionWorkerCapacity(
  totalWorkerCapacity: number,
  decomposeWorkers: number,
): number {
  return sanitizeWorkerPoolInputs(totalWorkerCapacity, decomposeWorkers).available
}

/**
 * D3 - the ONE normalization for worker-pool inputs (finite, floored,
 * clamped at 0), shared by the split rule and the read model so a
 * policy change cannot drift UI away from the engine.
 */
export function sanitizeWorkerPoolInputs(
  totalWorkerCapacity: number,
  decomposeWorkers: number,
): { total: number; reserved: number; available: number } {
  const total = Number.isFinite(totalWorkerCapacity)
    ? Math.max(0, Math.floor(totalWorkerCapacity))
    : 0

  const reserved = Number.isFinite(decomposeWorkers)
    ? Math.max(0, Math.floor(decomposeWorkers))
    : 0

  return { total, reserved, available: Math.max(0, total - reserved) }
}

/**
 * Beta scope (sec.4C policy): `manualWorkforce` is scope-hidden - the
 * CHQ pool and its persisted assignments stay dormant, but authored
 * policy keeps automatic production running as a background system.
 * While hidden, every capacity consumer reads this flat auto pool
 * (CHQ level-1 equivalent: one lane per Thanh Van site) instead of the
 * CHQ-sourced `player.autoWorkerCapacity`, so fresh and carried saves
 * share the same live production economy. Value: 3 sites x 1 lane.
 */
export const BETA_BASELINE_WORKER_CAPACITY = 3

export function betaEffectiveWorkerCapacity(autoWorkerCapacity: number): number {
  if (isScopeHidden('manualWorkforce')) {
    return BETA_BASELINE_WORKER_CAPACITY
  }
  return autoWorkerCapacity
}
