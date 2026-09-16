/**
 * Mission C Task 10b — the ONE ailment-application-chance formula for
 * turn combat: base chance + the actor's elementApplicationPercent,
 * clamped to [0, 1]. The legacy formula lives in the dormant real-time
 * executors (SkillEffectSystem.ts:294 / SkillActionRegistry.ts:99 —
 * Mission G deletes them); this helper is the surviving authority.
 */
export function resolveAilmentApplicationChance(
  baseChance: number,
  applicationPercent: number | undefined,
): number {
  return Math.min(1, baseChance + (applicationPercent ?? 0))
}
