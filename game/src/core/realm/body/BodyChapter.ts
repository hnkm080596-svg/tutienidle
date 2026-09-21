// P7-M5 - Unified BodyProgression authority: the canonical contract for
// body progression chapters (Luyen The tiers + Bat Mach one-shot openings
// today; future body chapters join the same registry). One PlayerData
// field, `bodyProgression`, is the single persisted record - the retired
// flat fields (bodyRefinementCompletedTiers /
// bodyRefinementCurrentTierProgress / openedMeridianIds) are gone at v72.
//
// A BodyChapterDefinition is the chapter-local contract: the chapter owns
// its invest rule, modifier emission, progress read, persisted-state shape
// validation, and integrity checks. BodyProgressionSystem dispatches over
// BODY_CHAPTERS - consumers never reach into `bodyProgression.*` slices.
import type { PlayerData } from '../../player/Player'
import { bodyRefinementChapter } from './BodyRefinementChapter'
import { meridianChapter } from './MeridianChapter'

export type BodyChapterId = 'body_refinement' | 'meridian'

export interface BodyRefinementChapterState {
  completedTiers: number
  currentTierProgress: number
}

export interface MeridianChapterState {
  openedIds: string[]
}

export interface BodyProgressionState {
  body_refinement: BodyRefinementChapterState
  meridian: MeridianChapterState
}

// Currency channel descriptor - which bag a chapter's invest currency
// lives in (tinh_hoa_pham_the is a material; thong_mach_dan is a
// type:'material' PILL in pillBag, not a material bag item).
export interface BodyChapterCurrency {
  bag: 'material' | 'pill'
  id: string
}

export interface BodyProgressionIssue {
  path: string
  message: string
}

export interface BodyChapterDefinition {
  readonly id: BodyChapterId
  readonly modifierPrefix: string
  readonly currency: BodyChapterCurrency
  readonly auxCurrency?: BodyChapterCurrency
  // Applies available currency units to the chapter state, returns the
  // amount actually consumed. Does NOT rebuild modifiers - the system
  // dispatch owns the exactly-once rebuild after a successful mutation.
  invest(player: PlayerData, available: number, auxOwned: number): number
  applyModifiers(player: PlayerData): void
  progress(player: PlayerData): { completed: number; total: number }
  isComplete(player: PlayerData): boolean
  // Chapter-owned persisted-shape validation for its own slice; emits
  // issues via the callback (P1-M6 module-dispatch convention).
  validatePersistedState(
    slice: unknown,
    basePath: string,
    emit: (issue: BodyProgressionIssue) => void,
  ): void
  // Chapter-owned integrity checks over LIVE state; messages only (the
  // system wraps them into the thrown preflight error).
  integrityIssues(player: PlayerData): string[]
}

export function createDefaultBodyProgression(): BodyProgressionState {
  // Canonical zero-state lives here (the record owner). A future chapter
  // with non-trivial defaults may declare its own factory.
  return {
    body_refinement: { completedTiers: 0, currentTierProgress: 0 },
    meridian: { openedIds: [] },
  }
}

// Canonical registry - iteration order IS the canonical chapter order.
// A future body chapter appends here (and to BodyChapterId + the state
// record) - nothing else needs to learn about it.
export const BODY_CHAPTERS: readonly BodyChapterDefinition[] = [
  bodyRefinementChapter,
  meridianChapter,
]

export const BODY_CHAPTER_BY_ID: Readonly<Record<BodyChapterId, BodyChapterDefinition>> = {
  body_refinement: bodyRefinementChapter,
  meridian: meridianChapter,
}

export function getBodyChapterDefinition(id: BodyChapterId): BodyChapterDefinition {
  const chapter = BODY_CHAPTER_BY_ID[id]

  if (!chapter) {
    throw new Error(`BodyProgression: unknown body chapter '${id}'`)
  }

  return chapter
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Module-owned persisted-shape validation (P1-M6 module-dispatch
// convention): the authority validates its WHOLE slice - presence of the
// top-level record, then each chapter validates its own slice. The save
// boundary delegates here; it never inspects chapter internals.
export function validateBodyProgressionPersistedState(
  playerPayload: unknown,
  emit: (issue: BodyProgressionIssue) => void,
): void {
  if (!isRecord(playerPayload)) {
    emit({ path: 'player', message: 'player phai la object' })
    return
  }

  const record = playerPayload.bodyProgression

  if (!isRecord(record)) {
    emit({ path: 'player.bodyProgression', message: 'bodyProgression phai la object' })
    return
  }

  for (const chapter of BODY_CHAPTERS) {
    chapter.validatePersistedState(
      record[chapter.id],
      `player.bodyProgression.${chapter.id}`,
      emit,
    )
  }
}
