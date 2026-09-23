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
// `isRealmAvailable(unlockRealmId) && reached(unlockRealmId)`.
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
 * Only forward transitions into an available realm are enabled, so the
 * TC -> KD tribulation stays closed while its target realm data remains
 * authored. Unknown endpoints fail closed.
 */
export function isRealmTransitionEnabled(fromRealmId: string, toRealmId: string): boolean {
  return (
    getRealmIndex(fromRealmId) !== -1 &&
    getRealmIndex(toRealmId) > getRealmIndex(fromRealmId) &&
    isRealmAvailable(toRealmId)
  )
}

/**
 * Whether acquisition scoped to the breakthrough INTO `targetRealmId`
 * is live - e.g. KD breakthrough-specific resources stay suppressed
 * while the TC -> KD transition is closed. Resources carrying no
 * breakthroughRealmId tag are not breakthrough-scoped and are never
 * suppressed (undefined -> true).
 */
export function isBreakthroughAcquisitionEnabled(targetRealmId?: string): boolean {
  return targetRealmId === undefined || isRealmAvailable(targetRealmId)
}
