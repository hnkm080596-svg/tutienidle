// Hidden Perfection Lineage (design 2026-09-23, master spec sec.2.4) - the
// AUTHORED registry of realms that carry a hidden body. Any realm not
// listed owns no hidden progression: unknown realm ids yield undefined
// state, no interface, and zero cap contribution.
//
// mechanicKind is a TAG (the sibling-mission seam): the mission owning
// the realm authors its mechanism code against this id and registers a
// persisted-state validator under HIDDEN_MECHANIC_STATE_VALIDATORS
// (core/realm/hidden/HiddenPerfection.ts). The skeleton ships no
// mechanism state and no validators.
//
// strict-prefix rule (design sec.3.5/sec.7): every earlier authored body
// realm must be completed before a later realm's hidden body may
// progress.
import { getRealmIndex } from '../../core/realm/realmSystem'

export const HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL = 'ancient_beast_trial'
export const HIDDEN_MECHANIC_QUAN_THE = 'quan_the'
export const HIDDEN_MECHANIC_NGHICH_CHU_TIAN = 'nghich_chu_tian'

export interface HiddenBodyRealmDefinition {
  /** Realm the hidden body belongs to - the tag's source of truth. */
  realmId: string
  /** Mechanism tag the owning sibling mission binds its code to. */
  mechanicKind: string
}

// Realm order = authored body order (strict prefix). A missing or
// misordered entry corrupts the whole derivation - assertHiddenBodyRealmRegistry
// walks it.
export const HIDDEN_BODY_REALMS: readonly HiddenBodyRealmDefinition[] = [
  { realmId: 'mortal', mechanicKind: HIDDEN_MECHANIC_ANCIENT_BEAST_TRIAL },
  { realmId: 'qi_refining', mechanicKind: HIDDEN_MECHANIC_QUAN_THE },
  { realmId: 'foundation_establishment', mechanicKind: HIDDEN_MECHANIC_NGHICH_CHU_TIAN },
]

const HIDDEN_BODY_REALM_ID_SET = new Set(HIDDEN_BODY_REALMS.map((r) => r.realmId))

const HIDDEN_BODY_REALM_INDEX = new Map(
  HIDDEN_BODY_REALMS.map((r, index) => [r.realmId, index] as const),
)

export function isAuthoredHiddenRealm(realmId: string): boolean {
  return HIDDEN_BODY_REALM_ID_SET.has(realmId)
}

/** Registry position of an authored body realm; -1 for non-hidden realms. */
export function hiddenBodyRealmIndex(realmId: string): number {
  return HIDDEN_BODY_REALM_INDEX.get(realmId) ?? -1
}

/**
 * The next uncompleted authored body realm IN lineage order, or
 * undefined when every authored body is done. This is the single
 * strict-prefix progression target: a realm may only progress its
 * hidden body while it IS this realm (and the lineage remains open -
 * callers check isHiddenLineageOpen separately).
 */
export function nextUncompletedHiddenBodyRealm(
  completedRealmIds: readonly string[],
): HiddenBodyRealmDefinition | undefined {
  const completed = new Set(completedRealmIds)
  return HIDDEN_BODY_REALMS.find((realm) => !completed.has(realm.realmId))
}

/** Module-load guard: authored entries must resolve against the realm
 * catalog AND appear in non-decreasing realm-index order so the strict
 * prefix follows the game's progression axis. Throws at import time on
 * a malformed table - a bad registry must never reach the suite. */
export function assertHiddenBodyRealmRegistry(): void {
  const indices = HIDDEN_BODY_REALMS.map((realm) => {
    const index = getRealmIndex(realm.realmId)
    if (index === -1) {
      throw new Error(`HIDDEN_BODY_REALMS: realm '${realm.realmId}' khong ton tai trong catalog`)
    }
    return index
  })
  for (let i = 1; i < indices.length; i++) {
    if ((indices[i] ?? 0) <= (indices[i - 1] ?? 0)) {
      throw new Error('HIDDEN_BODY_REALMS: realm ids phai theo thu tu tien trinh tang dan')
    }
  }
  if (HIDDEN_BODY_REALM_ID_SET.size !== HIDDEN_BODY_REALMS.length) {
    throw new Error('HIDDEN_BODY_REALMS: realmId lap lai')
  }
}

assertHiddenBodyRealmRegistry()
