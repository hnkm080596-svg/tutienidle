export interface QuestProgress {
  questId: string

  progress: number

  claimed: boolean

  // Only allOf rows carry this versioned slice. Keys are authored stable
  // leaf IDs, not positions. Legacy scalar progress stays compatible.
  objectiveVersion?: 1
  objectives?: Record<string, number>

  // Manager-derived, non-enumerable runtime view; never serialized.
  readonly claimInProgress?: boolean
}
