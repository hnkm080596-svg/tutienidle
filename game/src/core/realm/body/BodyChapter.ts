// P7-M5 - Unified BodyProgression authority: the canonical contract for
// body progression chapters (Luyen The tiers, Bat Mach one-shot openings,
// and the M-F-CHU-THIEN Chu Thien circulation; future body chapters join
// the same registry). One PlayerData field, `bodyProgression`, is the
// single persisted record - the retired flat fields
// (bodyRefinementCompletedTiers /
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
//
// M-F-BODY-CORE - chapter KIND is first-class: `chapterKind` is the
// authored game-design classification (refinement | meridian |
// zhou_tian), orthogonal to the emission `kind` discriminant. The Chu
// Thien chapter (M-F-CHU-THIEN) declares chapterKind 'zhou_tian' and
// reuses the shared contract + registry without touching dispatch;
// per-kind contract extensions attach beside this field as authored.
import type { PlayerData } from '../../player/Player'
import type { StatType } from '../../stats/StatTypes'
import {
  getPhysiqueGradeIndex,
  isPhysiqueGradeId,
  PHYSIQUE_GRADES,
  type PhysiqueGradeId,
} from '../../../data/realm/PhysiqueLadder'
import { physiqueEssenceGradeOf } from '../../../data/realm/PhysiqueEssence'
import { bodyRefinementChapter } from './BodyRefinementChapter'
import { meridianChapter } from './MeridianChapter'
import { zhouTianChapter } from './ZhouTianChapter'

export type BodyChapterId = 'body_refinement' | 'meridian' | 'zhou_tian'

// M-F-BODY-CORE - the chapter-kind vocabulary. 'zhou_tian' was declared
// ahead of M-F-CHU-THIEN; the Chu Thien chapter now owns that rung.
export const BODY_CHAPTER_KINDS = ['refinement', 'meridian', 'zhou_tian'] as const

export type BodyChapterKind = (typeof BODY_CHAPTER_KINDS)[number]

const BODY_CHAPTER_KIND_SET: ReadonlySet<string> = new Set(BODY_CHAPTER_KINDS)

export function isBodyChapterKind(value: unknown): value is BodyChapterKind {
  return typeof value === 'string' && BODY_CHAPTER_KIND_SET.has(value)
}

// M-F-BODY-CORE - expected classification per authored chapter id.
// Registry validation pins every listed id to this kind (a mis-tagged
// chapter fails authoring validation); ids absent from the map are
// unpinned until authored with their own expected kind.
export const EXPECTED_BODY_CHAPTER_KIND: Readonly<
  Partial<Record<string, BodyChapterKind>>
> = {
  body_refinement: 'refinement',
  meridian: 'meridian',
  zhou_tian: 'zhou_tian',
}

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

export interface ZhouTianChapterState {
  circulation: number
}

export interface BodyProgressionState {
  body_refinement: BodyRefinementChapterState
  meridian: MeridianChapterState
  zhou_tian: ZhouTianChapterState
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
  // M-F-BODY-CORE - authored chapter classification; drives nothing yet
  // beyond classification + registry validation (per-kind contracts
  // extend beside it as later missions author them).
  readonly chapterKind: BodyChapterKind
  readonly currency: BodyChapterCurrency
  readonly auxCurrency?: BodyChapterCurrency
  // M-F-CHU-THIEN (C2C-59) - authored sequential prerequisites: chapter
  // ids that must be COMPLETE before this chapter may be invested.
  // Registry validation pins every entry to a strictly-earlier chapter
  // (backward-only refs); the system dispatch gates invest on them and
  // restore-preflight pins the persisted coherence invariant. Absent on
  // chapters with no authored predecessor (body_refinement).
  readonly unlocksAfterChapters?: readonly BodyChapterId[]
  // M-QI-07 - absent on chapters that never transform the physique
  // (meridian declares none; only body_refinement binds pham -> bao).
  readonly physiqueAdvancement?: PhysiqueAdvancement
  // M-F-BODY-CORE - the body-owned base-stat channel: ANY chapter kind
  // may contribute flat base-stat deltas into assembledBase via
  // collectBodyBaseStatDeltas. Optional capability on the shared
  // contract so later missions (BODY-PERFECTION +10pp, CHU-THIEN values)
  // ride it without a new emission kind; 'baseStat' chapters re-declare
  // it required. Magnitudes stay deferred to the balance phase - this
  // owns only the contribution path.
  readonly collectBaseStatDeltas?: (
    player: PlayerData,
  ) => Partial<Record<StatType, number>>
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
// invest/restore. `collectBaseStatDeltas` is REQUIRED here (a baseStat
// chapter's whole emission IS the delta channel); other kinds may
// additionally opt in via the shared optional slot.
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
    zhou_tian: { circulation: 0 },
  }
}

// Canonical registry - iteration order IS the canonical chapter order
// AND the sequential progression chain (each chapter may only name
// predecessors listed before it). A future body chapter appends here
// (and to BodyChapterId + the state record) - nothing else needs to
// learn about it.
export const BODY_CHAPTERS: readonly BodyChapterDefinition[] = [
  bodyRefinementChapter,
  meridianChapter,
  zhouTianChapter,
]

// M-F-BODY-CORE - registry validation: the chapter catalog is authored
// data, so malformed structure fails closed (duplicates, undeclared
// kinds, emission-contract gaps, a chapterKind outside the vocabulary,
// a persisted-state slice with no chapter or a chapter with no slice,
// a non-contiguous physiqueAdvancement chain). Tests exercise the
// validator with synthetic catalogs; assertBodyChapterRegistry runs it
// over the real registry once at module load - corrupt authoring throws
// at import instead of silently reaching invest/restore.
export function validateBodyChapterRegistry(
  chapters: readonly BodyChapterDefinition[],
): BodyProgressionIssue[] {
  const issues: BodyProgressionIssue[] = []
  const seenIds = new Set<string>()
  const froms = new Set<PhysiqueGradeId>()

  for (const chapter of chapters) {
    const path = `bodyChapters.${chapter.id}`

    if (seenIds.has(chapter.id)) {
      issues.push({ path, message: `duplicate chapter id '${chapter.id}'` })
    }
    seenIds.add(chapter.id)

    if (!isBodyChapterKind(chapter.chapterKind)) {
      issues.push({
        path: `${path}.chapterKind`,
        message: `unknown chapter kind '${String(chapter.chapterKind)}'`,
      })
    } else if (
      EXPECTED_BODY_CHAPTER_KIND[chapter.id] !== undefined &&
      chapter.chapterKind !== EXPECTED_BODY_CHAPTER_KIND[chapter.id]
    ) {
      // Authored-id pin: a chapter claiming a known id must carry that
      // chapter's expected classification - a mis-tagged chapterKind on
      // an authored chapter fails authoring validation, not just the
      // vocabulary check. Ids outside the map (future chapters) are
      // unpinned until their own expected kind is declared with them.
      issues.push({
        path: `${path}.chapterKind`,
        message: `chapter '${chapter.id}' must be kind '${EXPECTED_BODY_CHAPTER_KIND[chapter.id]}', got '${chapter.chapterKind}'`,
      })
    }

    // Runtime twin of the emission-kind discriminant: a modifier
    // chapter must emit modifiers, a baseStat chapter must implement
    // both halves of its channel.
    if (chapter.kind === 'modifier') {
      if (typeof chapter.applyModifiers !== 'function') {
        issues.push({ path: `${path}.applyModifiers`, message: 'modifier chapter must implement applyModifiers' })
      }
    } else if (chapter.kind === 'baseStat') {
      if (typeof chapter.collectBaseStatDeltas !== 'function') {
        issues.push({ path: `${path}.collectBaseStatDeltas`, message: 'baseStat chapter must implement collectBaseStatDeltas' })
      }
      if (typeof chapter.scrubLegacyModifiers !== 'function') {
        issues.push({ path: `${path}.scrubLegacyModifiers`, message: 'baseStat chapter must implement scrubLegacyModifiers' })
      }
    } else {
      issues.push({
        path: `${path}.kind`,
        message: `unknown emission kind '${String((chapter as { kind: unknown }).kind)}'`,
      })
    }

    const advancement = chapter.physiqueAdvancement

    if (advancement !== undefined) {
      // INV-9 (M-QI-07, enforced as registry validation): one chapter
      // owns one transition; a transition spans exactly one rung.
      if (froms.has(advancement.from)) {
        issues.push({
          path: `${path}.physiqueAdvancement`,
          message: `advancement source '${advancement.from}' already owned by another chapter`,
        })
      }
      froms.add(advancement.from)

      if (!isPhysiqueGradeId(advancement.from) || !isPhysiqueGradeId(advancement.to)) {
        issues.push({
          path: `${path}.physiqueAdvancement`,
          message: 'advancement rungs must be physique ladder members',
        })
      } else if (getPhysiqueGradeIndex(advancement.to) !== getPhysiqueGradeIndex(advancement.from) + 1) {
        issues.push({
          path: `${path}.physiqueAdvancement`,
          message: 'advancement must span exactly one ladder rung',
        })
      }
    }
  }

  // INV-9 contiguity: the 'from' set must be exactly the first N ladder
  // rungs - a chain that skips a rung or does not start at 'pham' is
  // dead authored data (derivePhysiqueGrade could never walk past the
  // gap, so it also stays unreached at runtime).
  const sortedFroms = [...froms].sort(
    (a, b) => getPhysiqueGradeIndex(a) - getPhysiqueGradeIndex(b),
  )
  const expectedFroms = PHYSIQUE_GRADES.slice(0, sortedFroms.length).map(def => def.id)

  if (sortedFroms.some((from, index) => from !== expectedFroms[index])) {
    issues.push({
      path: 'bodyChapters.physiqueAdvancement',
      message: 'advancement sources must form a contiguous prefix from pham',
    })
  }

  // State-record coherence: every registered chapter owns exactly one
  // persisted slice and no orphan slice exists (dispatch, defaults,
  // persisted validation and integrity all assume the 1:1 keying).
  const defaultKeys = new Set<string>(Object.keys(createDefaultBodyProgression()))

  for (const chapter of chapters) {
    if (!defaultKeys.has(chapter.id)) {
      issues.push({
        path: `bodyProgression.${chapter.id}`,
        message: 'registered chapter has no default state slice',
      })
    }
  }

  // M-F-CHU-THIEN - sequential-prereq validation: every declared
  // unlocksAfterChapters entry must name a chapter STRICTLY EARLIER in
  // canonical order - the chain only ever points backward (no self-,
  // forward-, or unknown references).
  chapters.forEach((chapter, selfIndex) => {
    const path = `bodyChapters.${chapter.id}`

    for (const prereq of chapter.unlocksAfterChapters ?? []) {
      const prereqIndex = chapters.findIndex(candidate => candidate.id === prereq)

      if (prereqIndex === -1) {
        issues.push({
          path: `${path}.unlocksAfterChapters`,
          message: `unknown prerequisite chapter '${prereq}'`,
        })
      } else if (prereqIndex >= selfIndex) {
        issues.push({
          path: `${path}.unlocksAfterChapters`,
          message: `prerequisite '${prereq}' must precede '${chapter.id}' in canonical order`,
        })
      }
    }
  })

  for (const key of defaultKeys) {
    if (!chapters.some(chapter => chapter.id === key)) {
      issues.push({
        path: `bodyProgression.${key}`,
        message: `default state slice '${key}' has no registered chapter`,
      })
    }
  }

  return issues
}

export function assertBodyChapterRegistry(): void {
  const issues = validateBodyChapterRegistry(BODY_CHAPTERS)

  // The by-id map is hand-authored beside the list - it must resolve
  // every chapter and hold nothing else.
  for (const chapter of BODY_CHAPTERS) {
    if (BODY_CHAPTER_BY_ID[chapter.id] !== chapter) {
      issues.push({
        path: `bodyChapters.${chapter.id}`,
        message: 'BODY_CHAPTER_BY_ID does not resolve to the registered chapter',
      })
    }
  }

  const listedIds = new Set<string>(BODY_CHAPTERS.map(chapter => chapter.id))

  for (const key of Object.keys(BODY_CHAPTER_BY_ID)) {
    if (!listedIds.has(key)) {
      issues.push({
        path: `bodyChapters.${key}`,
        message: 'BODY_CHAPTER_BY_ID holds an unregistered chapter',
      })
    }
  }

  if (issues.length > 0) {
    throw new Error(
      `BodyProgression registry violation: ${issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`,
    )
  }
}

export const BODY_CHAPTER_BY_ID: Readonly<Record<BodyChapterId, BodyChapterDefinition>> = {
  body_refinement: bodyRefinementChapter,
  meridian: meridianChapter,
  zhou_tian: zhouTianChapter,
}

export function getBodyChapterDefinition(id: BodyChapterId): BodyChapterDefinition {
  const chapter = BODY_CHAPTER_BY_ID[id]

  if (!chapter) {
    throw new Error(`BodyProgression: unknown body chapter '${id}'`)
  }

  return chapter
}

// Module-load registry gate (fail-closed authored-data rule): runs once
// at import - corrupt authoring throws here, never silently at
// invest/restore.
assertBodyChapterRegistry()

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
