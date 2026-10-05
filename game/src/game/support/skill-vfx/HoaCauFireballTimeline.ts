import type { ActorAnchorFact, SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'

export const HOA_CAU_HAND_RAISE_MS = 625
export const HOA_CAU_PORTAL_OPEN_MS = 800
export const HOA_CAU_CHARGE_MS = 1700
export const HOA_CAU_PORTAL_CLOSE_MS = 500
export const HOA_CAU_RELEASE_MS = HOA_CAU_HAND_RAISE_MS + HOA_CAU_PORTAL_OPEN_MS + HOA_CAU_CHARGE_MS
export const HOA_CAU_REFERENCE_IMPACT_MS = 3687.5

export function hoaCauTiming(impactMs: number) {
  const deadline = Number.isFinite(impactMs) && impactMs > 0 ? impactMs : HOA_CAU_REFERENCE_IMPACT_MS
  const phaseScale = Math.min(1, deadline / HOA_CAU_REFERENCE_IMPACT_MS)
  const portalStartMs = HOA_CAU_HAND_RAISE_MS * phaseScale
  const chargeStartMs = (HOA_CAU_HAND_RAISE_MS + HOA_CAU_PORTAL_OPEN_MS) * phaseScale
  const chargeDurationMs = HOA_CAU_CHARGE_MS * phaseScale
  const releaseMs = chargeStartMs + chargeDurationMs
  return {
    impactMs: deadline,
    portalStartMs,
    chargeStartMs,
    releaseMs,
    chargeDurationMs,
    closeDurationMs: HOA_CAU_PORTAL_CLOSE_MS * phaseScale,
    travelMs: deadline - releaseMs,
  }
}

export function sampleHoaCauTimeline(elapsedMs: number, impactMs: number) {
  const timing = hoaCauTiming(impactMs)
  const elapsed = Math.max(0, elapsedMs)
  const portal = elapsed < timing.portalStartMs
    ? 'none'
    : elapsed < timing.chargeStartMs
      ? 'open'
    : elapsed < timing.releaseMs
      ? 'active'
      : elapsed < timing.releaseMs + timing.closeDurationMs
        ? 'close'
        : 'none'
  // The charge sheet is authored for the full charge window (51 frames
  // over HOA_CAU_CHARGE_MS) so the sprite plays at authored rate.
  const chargeFrame = elapsed >= timing.chargeStartMs && elapsed < timing.releaseMs
    ? Math.min(50, Math.floor((elapsed - timing.chargeStartMs) / timing.chargeDurationMs * 51))
    : null
  const projectileProgress = elapsed >= timing.releaseMs && elapsed <= timing.impactMs
    ? Math.max(0, Math.min(1, (elapsed - timing.releaseMs) / Math.max(1, timing.travelMs)))
    : null
  return { portal, chargeFrame, projectileProgress } as const
}

export function landedHoaCauTargets(resolved: SkillPresentationResolved): readonly ActorAnchorFact[] {
  const seen = new Set<string>()
  const targets: ActorAnchorFact[] = []
  for (const group of resolved.groups) {
    if (group.role !== 'primary') continue
    for (const outcome of group.outcomes) {
      if (outcome.kind !== 'hit' || !outcome.landed || seen.has(outcome.target.entityId)) continue
      seen.add(outcome.target.entityId)
      targets.push(outcome.target)
    }
  }
  return targets
}
