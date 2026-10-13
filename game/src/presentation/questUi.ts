import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

export type QuestRowStatus = 'doing' | 'complete' | 'ready' | 'pending'

export function questRowStatus(row: BetaQuestSurfaceModel): QuestRowStatus {
  if (row.lockedPreview) return 'pending'
  if (row.claim.claimed) return 'complete'
  if (row.claim.available) return 'ready'
  return 'doing'
}

export function selectVisibleQuestId(
  rows: readonly BetaQuestSurfaceModel[],
  selectedId: string | null,
): string | null {
  if (rows.some((row) => row.id === selectedId && !row.lockedPreview)) return selectedId
  return trackedHomeQuest(rows)?.id ?? rows.find((row) => !row.lockedPreview)?.id ?? null
}

export function trackedHomeQuest(rows: readonly BetaQuestSurfaceModel[]): BetaQuestSurfaceModel | null {
  return rows.find((row) => !row.lockedPreview && row.claim.available)
    ?? rows.find((row) => !row.lockedPreview && !row.claim.claimed)
    ?? null
}
