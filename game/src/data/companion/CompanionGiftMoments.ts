// CompanionGiftMoments (M-F-COMPANION-GIFT) - the authored "mail" seam.
// A moment is a data row, not code: the game systems only fire triggers
// (realm entered, stage first-clear), and this registry decides which
// trigger hands out which companion. One companion per moment; a record
// written by a moment keeps the moment's id for dedupe + provenance.

export type CompanionGiftTrigger =
  | { kind: 'realm_entered'; realmId: string }
  | { kind: 'stage_completed'; stageId: string }

export interface CompanionGiftMoment {
  /** Stable unique id; becomes the issued record's id. */
  id: string
  trigger: CompanionGiftTrigger
  /** Must satisfy isBetaCompanionGift - enforced at fire time. */
  definitionId: string
}

export const COMPANION_GIFT_MOMENTS: readonly CompanionGiftMoment[] = [
  // DEFERRED (M-F-CONTENT-TC): provisional placements pin the seams -
  // the content pass owns the final authored moments.
  {
    id: 'gift_than_nong_foundation_entry',
    trigger: { kind: 'realm_entered', realmId: 'foundation_establishment' },
    definitionId: 'than_nong',
  },
  {
    id: 'gift_khai_minh_foundation_floor_10',
    trigger: { kind: 'stage_completed', stageId: 'foundation_floor_10' },
    definitionId: 'khai_minh',
  },
]
