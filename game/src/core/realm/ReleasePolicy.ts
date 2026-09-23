// ReleasePolicy (M-F-CEILING, ruling set S49-51) - the ONE authority for
// the release window: which realms a player may occupy, which realm
// transitions may be attempted, and whether breakthrough-scoped
// acquisition is live.
//
// Beta window: Truc Co (foundation_establishment) is the fully playable
// ceiling. Realms above it stay AUTHORED but DORMANT - their tribulation
// chapters, drop tables, recipes, realm rewards and unlock thresholds
// remain in data; the policy suppresses activation, never deletes
// content. Gates consult these predicates instead of re-deriving the
// ceiling from realm order or table presence. Domain unlock predicates
// (isCompanionDomainUnlocked / isFormationUnlocked /
// isArtifactDomainUnlocked) compose it as
// `isRealmAvailable(unlockRealmId) && isRealmAvailable(realmId) &&
// reached(unlockRealmId)` - the SIMPLE rule (C2C-9): no grandfathering
// beyond the ceiling, a persisted save whose realm is unavailable hides
// the domain even though the unlock realm itself is in-window.
//
// Single-check invariant: the policy is consulted exactly once at reward
// eligibility/origination (admission gates, authored acquisition routes,
// realm-entry grants). Persistence restore and deterministic delivery of
// an already-authorized reward (bag.add, save reload, alchemy job
// completion) never re-check AND never delete: restore normalization
// preserves persisted ownership (e.g. normalizeArtifactProgress keeps a
// matching artifact even when its domain is release-hidden) - stripping
// owned state on load would be data loss. Access is disabled at the
// domain/progression seam (isArtifactDomainUnlocked gates the wheel slot
// and artifact EXP feed), never by mutating the save.
//
// Tag completeness: breakthrough-scoped resources are census'd in
// src/data/breakthrough/BreakthroughScopedResources.ts; every census id
// must carry breakthroughRealmId and every tagged record must be in the
// census (the integrity test asserts both directions).
import { REALMS } from '../../data/realms/realm'
import { getRealmIndex } from './realmSystem'

/** Highest realm a player may occupy in this release. Beta: Truc Co. */
export const progressionCeilingRealmId = 'foundation_establishment'

function ceilingIndex(): number {
  return getRealmIndex(progressionCeilingRealmId)
}

/**
 * Realm exists and sits at or below the release ceiling.
 * Unknown realm ids fail closed (getRealmIndex returns -1).
 */
export function isRealmAvailable(realmId: string): boolean {
  const index = getRealmIndex(realmId)
  return index !== -1 && index <= ceilingIndex()
}

/**
 * A realm that exists but sits above the release ceiling: authored,
 * dormant. Unknown realm ids are not "beyond" - they are simply
 * unavailable (isRealmAvailable is the allow-check; this reports
 * dormancy only).
 */
export function isBeyondReleaseCeiling(realmId: string): boolean {
  const index = getRealmIndex(realmId)
  return index !== -1 && index > ceilingIndex()
}

/**
 * Whether the transition fromRealmId -> toRealmId may be attempted.
 * ADJACENT-ONLY funnel contract (C2C-12): the target must be exactly the
 * next realm AND available, so the TC -> KD tribulation stays closed
 * while its target realm data remains authored, and malformed skip
 * transitions (mortal -> Truc Co) are rejected at the single funnel
 * instead of being admitted. Unknown endpoints fail closed.
 */
export function isRealmTransitionEnabled(fromRealmId: string, toRealmId: string): boolean {
  return (
    getRealmIndex(fromRealmId) !== -1 &&
    getRealmIndex(toRealmId) === getRealmIndex(fromRealmId) + 1 &&
    isRealmAvailable(toRealmId)
  )
}

/**
 * Whether acquisition scoped to the breakthrough INTO `targetRealmId`
 * is live - e.g. KD breakthrough-specific resources stay suppressed
 * while the TC -> KD transition is closed. Derived from the CANONICAL
 * predecessor -> target transition so the resource gate can never drift
 * from the tribulation gate (C2C-12): with adjacency pinned on
 * isRealmTransitionEnabled this is provably equivalent to
 * isRealmAvailable(targetRealmId) for any authored target, but binding
 * it to the transition keeps the two gates structurally identical.
 * A realm with no predecessor (index 0) has no breakthrough INTO it, so
 * the gate degrades to availability; unknown ids fail closed the same
 * way. Resources carrying no breakthroughRealmId tag are not
 * breakthrough-scoped and are never suppressed (undefined -> true).
 */
export function isBreakthroughAcquisitionEnabled(targetRealmId?: string): boolean {
  if (targetRealmId === undefined) {
    return true
  }

  const predecessorId = REALMS[getRealmIndex(targetRealmId) - 1]?.id
  return predecessorId === undefined
    ? isRealmAvailable(targetRealmId)
    : isRealmTransitionEnabled(predecessorId, targetRealmId)
}

// M-F-COMPANION-GIFT: Beta rules that NO companion pull pool is active.
// Companion acquisition in this build arrives only through the authored
// mail/gift channel; the pull/exchange architecture stays in place,
// flagged off rather than deleted, so a future build re-enables it by
// flipping this one predicate.
export function isCompanionPullPoolEnabled(): boolean {
  return false
}

/**
 * Material ids whose recurring sources exist only to feed the companion
 * pull. The census is the authority - same bind pattern as the
 * breakthrough census in BreakthroughScopedResources: suppression lives
 * here, not spread across drop tables.
 */
export const COMPANION_PULL_TOKEN_MATERIAL_IDS = ['chieu_hien_lenh'] as const

/**
 * Whether recurring `itemId` sources are suppressed at origination while
 * the pull pool is closed (quest unlock + claim item filter + loot
 * delivery all consult this). Banked balances are never re-checked - a
 * suppressed source is a faucet turned off, not a clawback, matching
 * the same single-check invariant the breakthrough surface above
 * follows. Sources of non-token items are unaffected.
 */
export function isCompanionPullTokenSourceSuppressed(itemId: string): boolean {
  return (
    !isCompanionPullPoolEnabled() &&
    (COMPANION_PULL_TOKEN_MATERIAL_IDS as readonly string[]).includes(itemId)
  )
}
