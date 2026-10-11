import { describe, expect, it } from 'vitest'

import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import {
  meridianChapter,
  recordMeridianOpenQuality,
  MERIDIAN_FULL_PROGRESS,
} from './MeridianChapter'

// ---------------------------------------------------------------
// Blind-QA repro suite (2026-10-11): defect INTRODUCED by the
// qualityAccum adjudication commit 9c1ad6d8, FIXED by 42a7c39e.
// The new persisted field originally had no shape check: malformed
// entries loaded clean, then recordMeridianOpenQuality either
// TypeError'd (primitive entry) or folded a multiplier outside the
// authored [1,2] band into live state - and the NEXT save write
// refused its own multiplier (self-brick).
//
// The adjudicated fix lives at the save-shape gate:
// validatePersistedState now requires every qualityAccum entry to be
// { sum: finite >= 0, count: int >= 1 }. These tests pin that
// contract as a regression check. (INFO residual: integrityIssues,
// the live-state checker, still does not inspect qualityAccum -
// unreachable via the load path post-fix; kept as a note, not an
// assertion, per the fix scope ruling.)
// ---------------------------------------------------------------

function player(): PlayerData {
  const p = createDefaultPlayer()
  p.realmId = 'qi_refining'
  p.realmLevel = 18
  return p
}

function shapeIssuesFor(meridianSlice: PlayerData['bodyProgression']['meridian']): string[] {
  const issues: string[] = []
  meridianChapter.validatePersistedState(
    meridianSlice,
    'player.bodyProgression.meridian',
    (issue) => issues.push(issue.path),
  )
  return issues
}

describe('REPRO F2 — meridian.qualityAccum entry payload must be save-shape validated (fixed 42a7c39e)', () => {
  it('a non-record accum entry is refused at load', () => {
    const p = player()
    p.bodyProgression.meridian.progress = { nham_mach: 50 }
    // Crafted/corrupt payload: entry is a bare number, not {sum,count}.
    p.bodyProgression.meridian.qualityAccum = { nham_mach: 5 } as never

    const issues = shapeIssuesFor(p.bodyProgression.meridian)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.some((path) => path.includes('qualityAccum.nham_mach'))).toBe(true)
  })

  it('a hostile accum {sum:-50,count:1} is refused - it would fold a -24.5 multiplier', () => {
    const p = player()
    p.bodyProgression.meridian.progress = { nham_mach: 99 }
    // Negative accumulator on a legitimately in-progress meridian:
    // completing the invest folds (-50 + 1)/(1+1) = -24.5 into
    // openedQualityMultipliers, outside the authored uplift band and
    // self-refused on the next save write.
    p.bodyProgression.meridian.qualityAccum = {
      nham_mach: { sum: -50, count: 1 },
    } as never

    const issues = shapeIssuesFor(p.bodyProgression.meridian)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.some((path) => path.includes('qualityAccum.nham_mach.sum'))).toBe(true)
  })

  it('a NaN/count-0 accum is refused - it would fold NaN into the multiplier', () => {
    const p = player()
    p.bodyProgression.meridian.progress = { nham_mach: 99 }
    p.bodyProgression.meridian.qualityAccum = {
      nham_mach: { sum: Number.NaN, count: 0 },
    } as never

    const issues = shapeIssuesFor(p.bodyProgression.meridian)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.some((path) => path.includes('qualityAccum.nham_mach.sum'))).toBe(true)
    expect(issues.some((path) => path.includes('qualityAccum.nham_mach.count'))).toBe(true)
  })

  it('sanity: a legal accum entry stays loadable, and the honest fold lands inside [1,2]', () => {
    const p = player()
    p.bodyProgression.meridian.progress = { nham_mach: 99 }
    p.bodyProgression.meridian.qualityAccum = {
      nham_mach: { sum: 1.5, count: 1 },
    }

    expect(shapeIssuesFor(p.bodyProgression.meridian)).toHaveLength(0)

    p.bodyProgression.meridian.progress.nham_mach = MERIDIAN_FULL_PROGRESS
    recordMeridianOpenQuality(p, ['hoang'])

    const written = p.bodyProgression.meridian.openedQualityMultipliers?.nham_mach
    expect(written).toBeGreaterThanOrEqual(1)
    expect(written).toBeLessThanOrEqual(2)
  })
})
