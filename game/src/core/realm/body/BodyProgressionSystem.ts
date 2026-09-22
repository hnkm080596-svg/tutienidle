// P7-M5 - the single BodyProgression authority. Stateless dispatch over
// BODY_CHAPTERS: every invest / modifier rebuild / progress read /
// derived count / persisted-state validation / integrity check flows
// through here. Consumers (tick op, ritual grade, breakthrough resolver,
// panel, save boundary) call these functions - they never reach into
// `player.bodyProgression.*` slices or reimplement chapter rules.
import type { PlayerData } from '../../player/Player'
import type { StatType } from '../../stats/StatTypes'
import {
  BODY_CHAPTERS,
  getBodyChapterDefinition,
  type BodyChapterDefinition,
  type BodyChapterId,
  type BodyProgressionIssue,
} from './BodyChapter'
import { computeRefinementBreakthroughGrade } from './BodyRefinementChapter'

// P7-M-F (D1) - the post-invest "rebuild" is kind-aware: modifier
// chapters re-emit their StatModifier slice; base-stat chapters own no
// modifier channel, so their rebuild is a scrub of the retired prefix
// (keeps chapter state the sole authority over its old slice).
function applyChapterEffect(player: PlayerData, chapter: BodyChapterDefinition): void {
  if (chapter.kind === 'modifier') {
    chapter.applyModifiers(player)
  } else if (chapter.kind === 'baseStat') {
    chapter.scrubLegacyModifiers(player)
  } else {
    // Exhaustive over the kind union - a future chapter kind must name
    // its emission contract here instead of falling through silently.
    throw new Error(`BodyProgression: unknown chapter kind '${(chapter as BodyChapterDefinition).kind}'`)
  }
}

// Unified invest: chapter-owned mutation, then the chapter's stat-effect
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
    applyChapterEffect(player, chapter)
  }

  return consumed
}

// Restore-time rehydration: chapter state is authoritative - persisted
// player.modifiers body slices are rebuilt from it (modifier chapters)
// or scrubbed (base-stat chapters emit none since D1), correcting stale
// or missing entries. Exactly one rebuild per chapter per restore.
export function applyAllBodyModifiers(player: PlayerData): void {
  for (const chapter of BODY_CHAPTERS) {
    applyChapterEffect(player, chapter)
  }
}

// D1 - flat base-stat deltas from every base-stat chapter, summed per
// stat. Consumed once by resolvePlayerStatAssembly to build the
// ephemeral assembledBase; never persisted, never emitted as modifiers.
export function collectBodyBaseStatDeltas(
  player: PlayerData,
): Partial<Record<StatType, number>> {
  const deltas: Partial<Record<StatType, number>> = {}

  for (const chapter of BODY_CHAPTERS) {
    if (chapter.kind !== 'baseStat') {
      continue
    }

    for (const [stat, delta] of statDeltaEntries(chapter.collectBaseStatDeltas(player))) {
      deltas[stat] = (deltas[stat] ?? 0) + delta
    }
  }

  return deltas
}

// Typed iteration seam for Partial<Record<StatType, number>> - the
// single narrow so consumers never ad-hoc cast Object.entries.
export function statDeltaEntries(
  deltas: Partial<Record<StatType, number>>,
): [StatType, number][] {
  return Object.entries(deltas) as [StatType, number][]
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