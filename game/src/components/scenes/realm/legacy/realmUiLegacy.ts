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
  /** Quan Khi entry (R13 ruling: moved out of Nhan Vat into Canh Gioi)
      - sword-path players re-open the Kiem Tu panel from here. */
  quanKhiEntry: boolean
}

// Normalized anchors on the complete six-landing artwork, not gameplay data.
// Dang Tien Lo spacing pass (2026-10-03): each flight now carries its two
// minor steps at arc-length 1/3 and 2/3 along the painted stair run so the
// 18 steps read evenly; the major landings stay pinned to their ovals.
export const realmMapAnchors = [
  [49, 86.5], [53.4, 80.2], [62, 71.5], [48.9, 62.8], [43.6, 60], [32.5, 55.5],
  [40.1, 48.9], [44.1, 46.2], [50, 40.5], [56.6, 38.6], [62.4, 35.3], [71, 30.5],
  [58.4, 26.8], [53.7, 25.1], [46, 21.5], [54.6, 17.9], [57.3, 16.9], [63.5, 15],
] as const
