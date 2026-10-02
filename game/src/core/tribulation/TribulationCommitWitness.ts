// F-TRB-FORGE (qa-fixpoint wave 2) - provenance witness for
// CommittedTribulationOutcome. The committed record is content-bound
// but was never provenance-bound: nothing witnessed that commitOutcome
// actually ran. commitOutcome now stamps run-derived facts only the
// true writer can produce at commit time - the realm the run departed
// from, the chapter floor it died/cleared on, the strikes it took, and
// the per-attempt seed drawn at start() - plus a digest folding the
// attempt identity with all of those fields atomically.
//
// Save validation and settleOutcome re-derive the same facts: the
// digest must replay, the floor state must match the authored chapter
// table, and the departing realm must bind to the player's realm the
// way a real run left it. A fabricated record that names the right
// outcome but cannot name the run it came from is rejected/inert.
// A fully-consistent forged bundle stays possible (a writer could have
// produced the same fields) - that is the same-value residual class
// owned by the future online-authority layer, not a hole this wave
// closes.

import type { ResolvableKienCoGrade } from '../../data/breakthrough/BreakthroughGrades'
import type { BreakthroughType } from '../realm/hidden/HiddenLineage'
import { getTribulationChapters } from '../../data/tribulation/TribulationChapters'
import { witnessDigest } from '../math/witnessDigest'

/** Run-derived facts the commit site snapshots into the record. */
export interface TribulationCommitWitness {
  /** The player's realm when start() ran - the realm write happens at
   * settle, so a real record always names the realm it departed. */
  readonly departingRealmId: string
  /** Chapter index the run ended on. Victory commits from the last
   * chapter (enterChapter commits before advancing past the end). */
  readonly chapterIndex: number
  readonly chaptersTotal: number
  /** Strikes absorbed inside the chapter the run ended on. */
  readonly lightningStrikesTaken: number
  /** Per-attempt seed drawn at start() - never persisted anywhere
   * else, so it only exists where commitOutcome stamped it. */
  readonly attemptSeed: number
  /** FNV-1a fold over the whole record + the run-derived facts. */
  readonly digest: number
}

/** Every field the digest binds - record facts plus witness facts. */
export interface TribulationCommitWitnessInput {
  readonly attemptId: number
  readonly outcome: 'victory' | 'defeat'
  readonly targetRealmId: string
  readonly grade: ResolvableKienCoGrade
  readonly breakthroughType: BreakthroughType
  readonly departingRealmId: string
  readonly chapterIndex: number
  readonly chaptersTotal: number
  readonly lightningStrikesTaken: number
  readonly attemptSeed: number
}

export function tribulationCommitWitnessDigest(input: TribulationCommitWitnessInput): number {
  return witnessDigest([
    input.attemptId,
    input.outcome,
    input.targetRealmId,
    input.grade,
    input.breakthroughType,
    input.departingRealmId,
    input.chapterIndex,
    input.chaptersTotal,
    input.lightningStrikesTaken,
    input.attemptSeed,
  ])
}

/** Minimal record shape the verifier reads - both the live
 * CommittedTribulationOutcome and its persisted mirror satisfy it. */
export interface TribulationCommitWitnessedRecord {
  readonly attemptId: number
  readonly outcome: 'victory' | 'defeat'
  readonly targetRealmId: string
  readonly grade: ResolvableKienCoGrade
  readonly breakthroughType: BreakthroughType
  readonly witness: TribulationCommitWitness
}

/**
 * Replay the witness against the record. Returns the witness field
 * whose binding fails, 'digest' when the atomic fold mismatches, or
 * null when the record replays a producible commit. Realm/player
 * binding is intentionally NOT here - it differs between pending and
 * receipt-bound records, so callers own that check.
 */
export function verifyTribulationCommitWitness(
  record: TribulationCommitWitnessedRecord,
): string | null {
  const witness = record.witness

  if (!Number.isInteger(witness.attemptSeed) || witness.attemptSeed < 0) {
    return 'attemptSeed'
  }

  if (!Number.isInteger(witness.lightningStrikesTaken) || witness.lightningStrikesTaken < 0) {
    return 'lightningStrikesTaken'
  }

  // The chapter floor must match the authored table for the realm the
  // record claims to target - a run that never entered the authored
  // gauntlet cannot have a floor at all.
  const chapters = getTribulationChapters(record.targetRealmId)

  if (!chapters || witness.chaptersTotal !== chapters.length) {
    return 'chaptersTotal'
  }

  if (
    !Number.isInteger(witness.chapterIndex) ||
    witness.chapterIndex < 0 ||
    witness.chapterIndex >= witness.chaptersTotal
  ) {
    return 'chapterIndex'
  }

  // Victory only commits from the final chapter: enterChapter commits
  // the win before advancing past the authored end, so any other floor
  // for a claimed victory is unproducible.
  if (record.outcome === 'victory' && witness.chapterIndex !== witness.chaptersTotal - 1) {
    return 'chapterIndex'
  }

  if (
    witness.digest !==
    tribulationCommitWitnessDigest({
      attemptId: record.attemptId,
      outcome: record.outcome,
      targetRealmId: record.targetRealmId,
      grade: record.grade,
      breakthroughType: record.breakthroughType,
      departingRealmId: witness.departingRealmId,
      chapterIndex: witness.chapterIndex,
      chaptersTotal: witness.chaptersTotal,
      lightningStrikesTaken: witness.lightningStrikesTaken,
      attemptSeed: witness.attemptSeed,
    })
  ) {
    return 'digest'
  }

  return null
}
