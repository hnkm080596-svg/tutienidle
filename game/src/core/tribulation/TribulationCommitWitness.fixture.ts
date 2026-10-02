// Test fixture: replay-valid TribulationCommitWitness literals.
// Wave 2 (F-TRB-FORGE) requires every persisted committedOutcome to
// carry the provenance witness commitOutcome stamps; fixtures that
// build record literals go through this helper so the witness
// re-derives the way the writer does.
//
// ASCII only (P15).

import type { ResolvableKienCoGrade } from '../../data/breakthrough/BreakthroughGrades'
import type { BreakthroughType } from '../realm/hidden/HiddenLineage'
import {
  tribulationCommitWitnessDigest,
  type TribulationCommitWitness,
} from './TribulationCommitWitness'

/**
 * Replay-valid TribulationCommitWitness for a committedOutcome
 * fixture. `chapterIndex` must be the victory floor (last authored
 * chapter) for victory records; pass a lower index for defeat records
 * (defeat may commit mid-gauntlet).
 */
export function commitWitnessFor(fields: {
  attemptId: number
  outcome: 'victory' | 'defeat'
  targetRealmId: string
  grade: ResolvableKienCoGrade
  breakthroughType: BreakthroughType
  departingRealmId: string
  chapterIndex: number
  chaptersTotal: number
  lightningStrikesTaken: number
  attemptSeed: number
}): { witness: TribulationCommitWitness } {
  return {
    witness: {
      departingRealmId: fields.departingRealmId,
      chapterIndex: fields.chapterIndex,
      chaptersTotal: fields.chaptersTotal,
      lightningStrikesTaken: fields.lightningStrikesTaken,
      attemptSeed: fields.attemptSeed,
      digest: tribulationCommitWitnessDigest(fields),
    },
  }
}
