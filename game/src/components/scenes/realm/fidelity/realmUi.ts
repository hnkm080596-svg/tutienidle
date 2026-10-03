export interface RealmUiRequirement {
  id: string
  /** Resolved label (e.g. "Luyen Khi tang 12"). */
  label: string
  /** Domain gate flag - presentation only marks the row. */
  met: boolean
}

export interface RealmUiPassive {
  id: string
  name: string
  description: string
  effectLines: readonly string[]
}

export interface RealmUiModel {
  name: string
  currentFloor: number
  /** realm.maxLevel (12 for CORE realms, 18 extended) - bounds markers. */
  maxFloor: number
  progress: number
  progressLabel: string
  cultivation: string
  rate: string
  requirements: readonly RealmUiRequirement[]
  /** Granted realm passives (grantedRealmPassiveIds) - real state, kept
      even though the reference omits them (compact list under the
      breakthrough block). */
  passives: readonly RealmUiPassive[]
  nextRealmName: string
  ctaLabel: string
  /** Beta ceiling reached -> the CTA + requirements block hide. */
  ctaVisible: boolean
  /** canTriggerBreakthrough - the CTA is lit only when the gate opens. */
  ctaEnabled: boolean
}

// Normalized anchors on the complete six-landing artwork, not gameplay data.
export const realmMapAnchors = [
  [55, 88], [58, 82], [62, 71], [49, 65], [39, 60], [33, 55],
  [47, 50], [50, 46], [51, 42], [62, 39], [67, 36], [69, 32],
  [61, 29], [52, 26], [49, 22.5], [57, 21], [61, 18.5], [63, 15.5],
] as const
