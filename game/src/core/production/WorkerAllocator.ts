/**
 * R7 (AR-07) — single workforce distribution rule.
 *
 * One pure function consumed by EVERY settlement path (online
 * ProductionSystem.tickWorkers + offline settleWorkersOffline).
 * Neither path may contain its own distribution loop.
 *
 * Rules (spec §6):
 * 1. capacity is floored at >= 0.
 * 2. Manual sites (assignment present) take min(assigned, remaining)
 *    in activeSiteIds order.
 * 3. Remainder round-robins across sites WITHOUT an assignment, in
 *    activeSiteIds order. If that set is empty the remainder stays
 *    IDLE — never crashes, never invents a second rule.
 * 4. Every active site appears in the result (0 when it got nothing).
 */
export function allocateWorkerSlots(
  activeSiteIds: readonly string[],
  assignments: ReadonlyMap<string, number>,
  capacity: number,
): Map<string, number> {
  const slots = new Map<string, number>()

  for (const siteId of activeSiteIds) {
    slots.set(siteId, 0)
  }

  let remaining = Math.max(0, Math.floor(capacity))

  const manual = activeSiteIds.filter((siteId) => assignments.has(siteId))
  const auto = activeSiteIds.filter((siteId) => !assignments.has(siteId))

  for (const siteId of manual) {
    if (remaining <= 0) {
      break
    }

    const assigned = Math.max(0, Math.floor(assignments.get(siteId) ?? 0))
    const take = Math.min(assigned, remaining)

    slots.set(siteId, take)
    remaining -= take
  }

  for (let index = 0; index < remaining; index++) {
    const siteId = auto[index % auto.length]

    if (siteId === undefined) {
      // No unassigned site: remainder stays idle (AR-07 fix).
      break
    }

    slots.set(siteId, (slots.get(siteId) ?? 0) + 1)
  }

  return slots
}
