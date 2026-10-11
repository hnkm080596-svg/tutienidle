import { describe, expect, it } from 'vitest'

import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import { meridianChapter, recordMeridianOpenQuality } from './MeridianChapter'
import { PILL_QUALITY_EFFECT_UPLIFT } from '../../pill/PillQuality'

// ---------------------------------------------------------------
// QA R3 blind adversarial review - FAILING REPRO, no production edits.
//
// DEFECT F4 (shape check admits out-of-band means): commit 42a7c39e
// validates qualityAccum entries as { sum: finite >= 0, count: int >= 1 }
// to stop a NaN/negative fold into openedQualityMultipliers. But the
// honest writer's invariant is tighter: sum is the fold of per-pill
// uplifts PILL_QUALITY_EFFECT_UPLIFT (each in [1,2]) over count pills,
// so a real accumulator ALWAYS satisfies count <= sum <= 2*count (mean
// in [1,2]) - the same band openedQualityMultipliers itself is pinned
// to. A crafted entry like { sum: 0, count: 1 } or { sum: 100, count: 1 }
// passes the new shape check, and when the meridian completes the fold
// writes a multiplier OUTSIDE [1,2] - which the very next save write
// refuses (self-brick), exactly the failure class the fix was for.
//
// Expected: shape validation also refuses an entry whose mean falls
// outside the authored uplift band. Actual: both extremes load clean.
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

describe('REPRO F4 - qualityAccum mean must stay inside the authored uplift band [1,2]', () => {
  it('sanity: the honest writer only produces count <= sum <= 2*count', () => {
    // The uplifts every real fold is built from - all in [1,2].
    for (const uplift of Object.values(PILL_QUALITY_EFFECT_UPLIFT)) {
      expect(uplift).toBeGreaterThanOrEqual(1)
      expect(uplift).toBeLessThanOrEqual(2)
    }
  })

  it('a sub-1 mean entry {sum:0,count:1} must be refused - it folds multiplier 0', () => {
    const p = player()
    p.bodyProgression.meridian.progress = { nham_mach: 99 }
    p.bodyProgression.meridian.qualityAccum = {
      nham_mach: { sum: 0, count: 1 },
    } as never

    const issues = shapeIssuesFor(p.bodyProgression.meridian)
    expect(issues.some((path) => path.includes('qualityAccum.nham_mach'))).toBe(true)

    // And the fold it enables: completing the meridian writes a
    // multiplier outside [1,2] - the self-brick the fix was meant to stop.
    p.bodyProgression.meridian.progress.nham_mach = 100
    recordMeridianOpenQuality(p, ['hoang'])
    const written = p.bodyProgression.meridian.openedQualityMultipliers?.nham_mach
    expect(written).toBeGreaterThanOrEqual(1)
    expect(written).toBeLessThanOrEqual(2)
  })

  it('a super-2 mean entry {sum:100,count:1} must be refused - it folds multiplier ~50', () => {
    const p = player()
    p.bodyProgression.meridian.progress = { nham_mach: 99 }
    p.bodyProgression.meridian.qualityAccum = {
      nham_mach: { sum: 100, count: 1 },
    } as never

    const issues = shapeIssuesFor(p.bodyProgression.meridian)
    expect(issues.some((path) => path.includes('qualityAccum.nham_mach'))).toBe(true)
  })
})
