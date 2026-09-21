// P7-M5 - the single BodyProgression authority. Stateless dispatch over
// BODY_CHAPTERS: every invest / modifier rebuild / progress read /
// derived count / persisted-state validation / integrity check flows
// through here. Consumers (tick op, ritual grade, breakthrough resolver,
// panel, save boundary) call these functions - they never reach into
// `player.bodyProgression.*` slices or reimplement chapter rules.
import type { PlayerData } from '../../player/Player'
import {
  BODY_CHAPTERS,
  getBodyChapterDefinition,
  type BodyChapterId,
  type BodyProgressionIssue,
} from './BodyChapter'
import { computeRefinementBreakthroughGrade } from './BodyRefinementChapter'

// Unified invest: chapter-owned mutation, then the chapter's modifier
// rebuild exactly once - and ONLY on a successful mutation (consumed > 0)
// per spec sec.3.5. Returns the currency units actually consumed so the
// calling op can debit the right bag.
export function investBodyChapterState(
  player: PlayerData,
  chapterId: BodyChapterId,
  available: number,
  auxOwned = 0,
): number {
  const chapter = getBodyChapterDefinition(chapterId)
  const consumed = chapter.invest(player, available, auxOwned)

  if (consumed > 0) {
    chapter.applyModifiers(player)
  }

  return consumed
}

// Restore-time rehydration: chapter state is authoritative - persisted
// player.modifiers body slices are rebuilt from it, correcting stale or
// missing entries. Exactly one rebuild per chapter per restore.
export function applyAllBodyModifiers(player: PlayerData): void {
  for (const chapter of BODY_CHAPTERS) {
    chapter.applyModifiers(player)
  }
}

export function getBodyChapterProgress(
  player: PlayerData,
  chapterId: BodyChapterId,
): { completed: number; total: number } {
  return getBodyChapterDefinition(chapterId).progress(player)
}

// Derived body facts - the canonical reads consumers (ritual snapshot,
// breakthrough resolver) use instead of touching chapter state.
export function getBodyRefinementCompletedTiers(player: PlayerData): number {
  return getBodyChapterDefinition('body_refinement').progress(player).completed
}

export function getOpenedMeridianCount(player: PlayerData): number {
  return getBodyChapterDefinition('meridian').progress(player).completed
}

// Bac Nhap Dao grade (1-6) - canonical read kept under the system so the
// ritual call-site vocabulary survives the engine move.
export function computeBreakthroughGrade(player: PlayerData): number {
  return computeRefinementBreakthroughGrade(player)
}

// Integrity gate - every chapter's live-state invariants, thrown as one
// error. Preflight calls this once before any owner mutation; a corrupt
// slice fails closed.
export function assertBodyProgressionIntegrity(player: PlayerData): void {
  const issues: string[] = []

  // Fail closed on a malformed record: a missing slice is an integrity
  // violation itself, not a TypeError on the way to the thrown error.
  const record = player.bodyProgression as unknown

  if (typeof record !== 'object' || record === null) {
    issues.push('bodyProgression missing or not an object')
  } else {
    for (const chapter of BODY_CHAPTERS) {
      const slice = (record as Record<string, unknown>)[chapter.id]

      if (typeof slice !== 'object' || slice === null) {
        issues.push(`${chapter.id} missing or not an object`)
      } else {
        issues.push(...chapter.integrityIssues(player))
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(`BodyProgression integrity violation: ${issues.join('; ')}`)
  }
}

// Re-export the persisted-state validator so the save boundary has ONE
// body import surface (delegation target per spec sec.3.7).
export { validateBodyProgressionPersistedState } from './BodyChapter'
export type { BodyProgressionIssue }