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
  type PhysiqueAdvancement,
} from './BodyChapter'
import { computeRefinementBreakthroughGrade } from './BodyRefinementChapter'
import {
  getPhysiqueGradeIndex,
  isPhysiqueGradeId,
  type PhysiqueGradeId,
} from '../../../data/realm/PhysiqueLadder'
import { getBodyPerfectionMultiplier } from './BodyPerfection'

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

// M-QI-07 (QI-D4) - the physique source-grade gate (INV-5): a chapter
// whose physiqueAdvancement names 'from' can only receive investment
// while the player's grade is at or past that rung. Pure/testable so
// synthetic future transitions (e.g. bao -> phap) can be exercised
// without a real chapter; investBodyChapterState delegates here.
export function canProgressPhysiqueChapter(
  player: PlayerData,
  advancement: PhysiqueAdvancement,
): boolean {
  return getPhysiqueGradeIndex(player.physiqueGrade) >= getPhysiqueGradeIndex(advancement.from)
}

// M-QI-07 (QI-D4) - the exact physique grade reachable from the
// authored transition chain: start at 'pham', walk the contiguous
// authored prefix in ladder order, advance across a transition only
// while its owning chapter is complete, stop at the first incomplete
// or non-adjacent one. Restore/preflight compares the persisted grade
// to this derivation - it never recomputes or repairs the save.
export function derivePhysiqueGrade(player: PlayerData): PhysiqueGradeId {
  const advancements = BODY_CHAPTERS
    .flatMap(chapter =>
      chapter.physiqueAdvancement === undefined
        ? []
        : [{ chapter, advancement: chapter.physiqueAdvancement }],
    )
    .sort((a, b) =>
      getPhysiqueGradeIndex(a.advancement.from) - getPhysiqueGradeIndex(b.advancement.from),
    )

  let derived: PhysiqueGradeId = 'pham'

  for (const { chapter, advancement } of advancements) {
    if (advancement.from !== derived || !chapter.isComplete(player)) {
      break
    }
    derived = advancement.to
  }

  return derived
}

// Canonical physique read - the ONLY supported read for consumers
// (panel, future essence gating). Never reach into player.physiqueGrade
// for derived semantics.
export function getPhysiqueGrade(player: PlayerData): PhysiqueGradeId {
  return player.physiqueGrade
}

// M-F-BODY-CORE - the completion-advance hook, callable from ANY chapter
// completion path (the invest dispatch calls it today; a future
// zhou_tian chapter whose completion is not invest-driven calls the same
// seam). One completed NORMAL chapter = exactly one rung, once: the
// exact-'from' source guard is the idempotence key - an already
// transformed or further-advanced grade is never rewritten, and a
// chapter that declares no physiqueAdvancement (or is not complete) is
// a no-op. Late completion is valid - the hook is unconditional on
// realm.
//
// NORMATIVE (restore contract): this seam runs ONLY on live completion
// paths (invest today, zhou_tian tomorrow) - NEVER on restore/rebuild
// (applyAllBodyModifiers). The persisted physiqueGrade is authoritative
// at load: a completed chapter whose grade was already written is
// accepted as-is, and a torn state (completed chapter + behind grade)
// is a hard error that assertBodyProgressionIntegrity rejects at
// preflight via derivePhysiqueGrade exact-equality (INV-8). Restore
// must reject the torn save, never silently re-fire this advancement.
export function applyPhysiqueAdvancement(
  player: PlayerData,
  chapter: BodyChapterDefinition,
): void {
  const advancement = chapter.physiqueAdvancement

  if (
    advancement !== undefined &&
    chapter.isComplete(player) &&
    player.physiqueGrade === advancement.from
  ) {
    player.physiqueGrade = advancement.to
  }
}

// M-F-CHU-THIEN (C2C-59) - the sequential-unlock read: a chapter is
// unlocked iff every authored unlocksAfterChapters prerequisite is
// complete on this player. Direct (non-recursive) evaluation -
// prerequisites sit strictly earlier in canonical order, so
// transitiveness is a property of the authored chain plus the persisted
// coherence invariant, not of this read. The invest dispatch gates on
// it before any other gate; the UI mirrors the same read.
export function isBodyChapterUnlocked(
  player: PlayerData,
  chapterId: BodyChapterId,
): boolean {
  const chapter = getBodyChapterDefinition(chapterId)
  return (chapter.unlocksAfterChapters ?? []).every(
    prereq => getBodyChapterDefinition(prereq).isComplete(player),
  )
}

// Unified invest: chapter-owned mutation, then the chapter's stat-effect
// rebuild exactly once - and ONLY on a successful mutation (consumed > 0)
// per spec sec.3.5. Returns the currency units actually consumed so the
// calling op can debit the right bag.
//
// M-F-CHU-THIEN (C2C-59) - the SEQUENTIAL gate runs first: a chapter
// locked behind incomplete predecessors consumes nothing.
//
// M-QI-07 adds the physique transaction: the source-grade gate runs
// BEFORE any mutation (a player below 'from' cannot invest at all -
// returns 0, nothing consumed); the grade write runs only after a
// successful consumption via applyPhysiqueAdvancement (idempotent - an
// already transformed player is never re-advanced or reverted).
export function investBodyChapterState(
  player: PlayerData,
  chapterId: BodyChapterId,
  available: number,
  auxOwned = 0,
): number {
  const chapter = getBodyChapterDefinition(chapterId)
  const advancement = chapter.physiqueAdvancement

  if (!isBodyChapterUnlocked(player, chapterId)) {
    return 0
  }

  if (advancement !== undefined && !canProgressPhysiqueChapter(player, advancement)) {
    return 0
  }

  const consumed = chapter.invest(player, available, auxOwned)

  if (consumed > 0) {
    applyPhysiqueAdvancement(player, chapter)
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

// D1 / M-F-BODY-CORE - the body-owned base-stat channel: flat deltas
// from every chapter that implements the collectBaseStatDeltas
// capability (not gated on the emission discriminant - a later chapter
// kind contributes the same way), summed per stat. Consumed once by
// resolvePlayerStatAssembly to build the ephemeral assembledBase; never
// persisted, never emitted as modifiers.
export function collectBodyBaseStatDeltas(
  player: PlayerData,
): Partial<Record<StatType, number>> {
  const deltas: Partial<Record<StatType, number>> = {}

  for (const chapter of BODY_CHAPTERS) {
    if (chapter.collectBaseStatDeltas === undefined) {
      continue
    }

    for (const [stat, delta] of statDeltaEntries(chapter.collectBaseStatDeltas(player))) {
      deltas[stat] = (deltas[stat] ?? 0) + delta
    }
  }

  return deltas
}

// M-F-BODY-PERFECTION (spec S5) - the EFFECTIVE body channel: raw
// chapter deltas scaled by the per-realm perfection multiplier
// (1 + 0.10 x perfectedCount), applied inside THIS channel so the
// bonus reaches every Body-derived base-stat contribution and leaks
// to nothing else. Sole consumer: resolvePlayerStatAssembly's merge.
// Factor 1 (nothing perfected) returns the raw contract unchanged.
export function collectEffectiveBodyBaseStatDeltas(
  player: PlayerData,
): Partial<Record<StatType, number>> {
  const raw = collectBodyBaseStatDeltas(player)
  const multiplier = getBodyPerfectionMultiplier(player)

  if (multiplier === 1) {
    return raw
  }

  const scaled: Partial<Record<StatType, number>> = {}

  for (const [stat, delta] of statDeltaEntries(raw)) {
    scaled[stat] = delta * multiplier
  }

  return scaled
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
    // The derivation walks isComplete on every advancement-owning
    // chapter - a missing such slice would TypeError on the way to the
    // aggregated error, so a missing slice also blocks derivation.
    let derivationBlocked = false

    for (const chapter of BODY_CHAPTERS) {
      const slice = (record as Record<string, unknown>)[chapter.id]

      if (typeof slice !== 'object' || slice === null) {
        issues.push(`${chapter.id} missing or not an object`)
        if (chapter.physiqueAdvancement !== undefined) {
          derivationBlocked = true
        }
      } else {
        issues.push(...chapter.integrityIssues(player))

        // M-F-CHU-THIEN (C2C-64) - persisted sequential coherence: a
        // progressed or completed chapter requires every authored
        // prerequisite COMPLETE (meridian progressed -> refinement
        // complete; zhou_tian progressed -> meridian complete). The
        // rule transitivizes across the registry and is evaluated only
        // over present slices - a missing prereq slice already reports
        // above, and calling isComplete on it would TypeError (same
        // convention as derivationBlocked).
        const progressed =
          chapter.progress(player).completed > 0 || chapter.isComplete(player)

        if (progressed) {
          for (const prereq of chapter.unlocksAfterChapters ?? []) {
            const prereqSlice = (record as Record<string, unknown>)[prereq]

            if (
              typeof prereqSlice === 'object' &&
              prereqSlice !== null &&
              !getBodyChapterDefinition(prereq).isComplete(player)
            ) {
              issues.push(
                `${chapter.id} progressed/completed while prerequisite '${prereq}' is incomplete`,
              )
            }
          }
        }
      }
    }

    // M-QI-07 (INV-8) - the persisted grade must equal the EXACT grade
    // derived from the authored transition chain: complete chapter but
    // untransformed grade (6/6 + 'pham'), grade ahead of an incomplete
    // chapter (5/6 + 'bao'), and unreachable rungs (6/6 + 'phap'/'tien')
    // are all incoherent - fail closed, never recompute or repair.
    if (!isPhysiqueGradeId(player.physiqueGrade)) {
      issues.push(`physiqueGrade '${String(player.physiqueGrade)}' is not a ladder member`)
    } else if (!derivationBlocked) {
      const derived = derivePhysiqueGrade(player)
      if (player.physiqueGrade !== derived) {
        issues.push(
          `physiqueGrade '${player.physiqueGrade}' does not match the grade derived ` +
          `from completed physique chapters ('${derived}')`,
        )
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