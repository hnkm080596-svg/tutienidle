// CompanionAvailability (P7-M9, Mortal Chapter decision D4) - the
// Companion domain begins at Tru Co (foundation_establishment). Single
// authority for the realm gate: GameManagerCompanionOps, the Chi Hien
// Quan gacha tabs and the command-wheel slot all read this predicate.
// Grandfathered saves keep already-owned companions working in combat;
// the gate only blocks NEW acquisition and UI entry (no migration).
import { getRealmIndex } from '../realm/realmSystem'
import { isRealmAvailable } from '../realm/ReleasePolicy'

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
