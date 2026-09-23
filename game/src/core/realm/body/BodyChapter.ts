// P7-M5 - Unified BodyProgression authority: the canonical contract for
// body progression chapters (Luyen The tiers + Bat Mach one-shot openings
// today; future body chapters join the same registry). One PlayerData
// field, `bodyProgression`, is the single persisted record - the retired
// flat fields (bodyRefinementCompletedTiers /
// bodyRefinementCurrentTierProgress / openedMeridianIds) are gone at v72.
//
// A BodyChapterDefinition is the chapter-local contract: the chapter owns
// its invest rule, stat-effect emission, progress read, persisted-state
// shape validation, and integrity checks. BodyProgressionSystem
// dispatches over BODY_CHAPTERS - consumers never reach into
// `bodyProgression.*` slices.
//
// P7-M-F (D1) - the emission contract splits by kind: a MODIFIER chapter
// (meridian) emits StatModifier percent entries into player.modifiers; a
// BASE-STAT chapter (body_refinement) contributes flat base-stat deltas
// via collectBaseStatDeltas - assembled into the pipeline base by
// resolvePlayerStatAssembly, never persisted into player.baseStats and
// never emitted as modifiers.
import type { PlayerData } from '../../player/Player'
import type { StatType } from '../../stats/StatTypes'
import type { PhysiqueGradeId } from '../../../data/realm/PhysiqueLadder'
import { physiqueEssenceGradeOf } from '../../../data/realm/PhysiqueEssence'
import { bodyRefinementChapter } from './BodyRefinementChapter'
import { meridianChapter } from './MeridianChapter'

export type BodyChapterId = 'body_refinement' | 'meridian'

// M-QI-07 (QI-D4) - a chapter may declare ONE physique advancement:
// completing it moves player.physiqueGrade exactly from -> to (one
// rung). Authored transitions must form a contiguous, gapless prefix
// starting at 'pham' (adjacent pairs, unique 'from') - the ladder
// test guards the authored shape.
export interface PhysiqueAdvancement {
  from: PhysiqueGradeId
  to: PhysiqueGradeId
}

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

// M-QI-08 (QI-D4b) - namespace-aware physique-essence predicate. The
// bag selects the bag namespace FIRST: only a 'material' currency can
// be physique essence. A pill whose id coincidentally equals a family
// material id must NOT classify - PhysiqueEssence is a material-id
// registry and has no authority over pill-bag contents.
export function bodyChapterEssenceGrade(
  currency: BodyChapterCurrency,
): PhysiqueGradeId | undefined {
  return currency.bag === 'material'
    ? physiqueEssenceGradeOf(currency.id)
    : undefined
}

export interface BodyProgressionIssue {
  path: string
  message: string
}

// Shared chapter contract: invest/progress/persisted-validation/integrity
// are identical for both emission kinds.
interface BodyChapterShared {
  readonly id: BodyChapterId
  readonly currency: BodyChapterCurrency
  readonly auxCurrency?: BodyChapterCurrency
  // M-QI-07 - absent on chapters that never transform the physique
  // (meridian declares none; only body_refinement binds pham -> bao).
  readonly physiqueAdvancement?: PhysiqueAdvancement
  // Applies available currency units to the chapter state, returns the
  // amount actually consumed. Does NOT rebuild stat effects - the system
  // dispatch owns the exactly-once rebuild after a successful mutation.
  invest(player: PlayerData, available: number, auxOwned: number): number
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

// Modifier chapter: emits StatModifier percent entries under its id
// prefix into player.modifiers; the system rebuilds the slice exactly
// once per invest/restore.
export interface ModifierBodyChapter extends BodyChapterShared {
  readonly kind: 'modifier'
  readonly modifierPrefix: string
  applyModifiers(player: PlayerData): void
}

// Base-stat chapter (D1): contributes flat base-stat deltas, derived on
// the fly from canonical chapter state - never emitted as modifiers and
// never written into player.baseStats. `scrubLegacyModifiers` removes
// stale prefix-owned slices left by the retired percent model so the
// "chapter state is the only authority" invariant still holds at
// invest/restore.
export interface BaseStatBodyChapter extends BodyChapterShared {
  readonly kind: 'baseStat'
  readonly legacyModifierPrefix: string
  collectBaseStatDeltas(player: PlayerData): Partial<Record<StatType, number>>
  scrubLegacyModifiers(player: PlayerData): void
}

export type BodyChapterDefinition = ModifierBodyChapter | BaseStatBodyChapter

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
