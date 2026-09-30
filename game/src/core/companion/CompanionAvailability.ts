// CompanionAvailability (P7-M9, Mortal Chapter decision D4) - the
// Companion domain begins at Tru Co (foundation_establishment). Single
// authority for the realm gate: GameManagerCompanionOps, the Chi Hien
// Quan gacha tabs and the command-wheel slot all read this predicate.
// Grandfathered saves keep already-owned companions working in combat;
// the gate only blocks NEW acquisition and UI entry (no migration).
import { getRealmIndex } from '../realm/realmSystem'
import {
  isCompanionPullPoolEnabled,
  isRealmAvailable,
} from '../realm/ReleasePolicy'
import { BETA_COMPANIONS } from '../../data/companion/Companions'
import type { CompanionDefinition } from '../../data/companion/Companions'
import { BETA_COMPANION_CONTENT_ENABLED } from '../betaScope'

export const COMPANION_UNLOCK_REALM_ID = 'foundation_establishment'

export function isCompanionDomainUnlocked(realmId: string): boolean {
  // M-F-CEILING - composed with release policy (C2C-9 simple rule): NO
  // grandfathering beyond the ceiling - a persisted save whose realm is
  // unavailable hides the domain even though COMPANION_UNLOCK_REALM_ID
  // sits in-window.
  return (
    isRealmAvailable(COMPANION_UNLOCK_REALM_ID) &&
    isRealmAvailable(realmId) &&
    getRealmIndex(realmId) >= getRealmIndex(COMPANION_UNLOCK_REALM_ID)
  )
}

/**
 * BETA-SCOPE-LOCK - the companion GAMEPLAY authority: the realm gate
 * above AND the beta scope flag. Ops (pull/exchange/claim/feed), the
 * roster wheel slot, worker-lodge companion tabs, the currency HUD
 * chips, and formation deployment all gate here while the flag is
 * off. isCompanionDomainUnlocked stays the pure realm gate - UI uses
 * it to decide whether the companion surfaces exist at all (visible
 * but locked in beta vs hidden pre-Tru Co).
 */
export function isCompanionGameplayUnlocked(realmId: string): boolean {
  return BETA_COMPANION_CONTENT_ENABLED && isCompanionDomainUnlocked(realmId)
}

/**
 * The pool pull/exchange ops and UI may acquire from. M-F-COMPANION-GIFT:
 * Beta has NO active pull pool (isCompanionPullPoolEnabled = false), so
 * this is the explicit empty state - a valid contract, not a hidden
 * dead button: ops reject pool_unavailable and surfaces explain the
 * closed pool instead of pretending a pool exists. When a build
 * re-enables pulls, the Beta-authored pool flows through unchanged.
 */
export function companionAcquirablePool(): readonly CompanionDefinition[] {
  return isCompanionPullPoolEnabled() ? BETA_COMPANIONS : []
}
