/**
 * Mission C Task 10b — the ONE ailment-application-chance formula for
 * turn combat: base chance + the actor's elementApplicationPercent,
 * clamped to [0, 1]. The legacy real-time executors that carried this
 * formula were deleted in Mission G; this helper is the sole authority.
 */
export function resolveAilmentApplicationChance(
  baseChance: number,
  applicationPercent: number | undefined,
): number {
  return Math.max(0, Math.min(1, baseChance + (applicationPercent ?? 0)))
}
