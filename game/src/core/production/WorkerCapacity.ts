/** Nhân công tối đa theo cấp Chiêu Hiền Quán — công thức user chốt
 *  (roadmap 6C: "Nhân công tối đa = 1 + cấp Chiêu Hiền Quán × 2").
 *  Chưa xây CHQ (level 0) = 0 nhân công; cấp 1 → 3; cấp 9 → 19. */
export function getWorkerCapacityForLevel(chiHienQuanLevel: number): number {
  if (!Number.isFinite(chiHienQuanLevel) || chiHienQuanLevel <= 0) {
    return 0
  }

  return 1 + chiHienQuanLevel * 2
}

/**
 * Mission D (spec D5) — the ONE worker-pool split rule: decompose
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
  const total = Number.isFinite(totalWorkerCapacity)
    ? Math.max(0, Math.floor(totalWorkerCapacity))
    : 0

  const reserved = Number.isFinite(decomposeWorkers)
    ? Math.max(0, Math.floor(decomposeWorkers))
    : 0

  return Math.max(0, total - reserved)
}
