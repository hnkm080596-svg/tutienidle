import { describe, expect, it } from 'vitest'

import { BODY_CHAPTERS } from '../../core/realm/body/BodyChapter'
import {
  getPhysiqueGradeIndex,
  isPhysiqueGradeId,
  PHYSIQUE_GRADES,
  type PhysiqueGradeId,
} from './PhysiqueLadder'

// M-QI-07 (QI-D4) - the physique ladder is identity data only: rung
// order, membership guard, index helper, and the authored-advancement
// integrity contract (contiguous prefix from 'pham'). No stat bonus
// fields (QI-D4d).
describe('PhysiqueLadder', () => {
  it('contains exactly the QI-D4 ladder in order', () => {
    expect(PHYSIQUE_GRADES.map(def => def.id)).toEqual([
      'pham', 'bao', 'phap', 'linh', 'huyen',
      'chan', 'dao', 'than', 'thanh', 'tien',
    ])
  })

  it('isPhysiqueGradeId accepts every rung and rejects unknown/non-string values', () => {
    for (const def of PHYSIQUE_GRADES) {
      expect(isPhysiqueGradeId(def.id)).toBe(true)
    }

    expect(isPhysiqueGradeId('pham_the')).toBe(false)
    expect(isPhysiqueGradeId('')).toBe(false)
    expect(isPhysiqueGradeId('TIEN')).toBe(false)
    expect(isPhysiqueGradeId(3)).toBe(false)
    expect(isPhysiqueGradeId(null)).toBe(false)
    expect(isPhysiqueGradeId(undefined)).toBe(false)
    expect(isPhysiqueGradeId({})).toBe(false)
  })

  it('getPhysiqueGradeIndex returns ladder position', () => {
    expect(getPhysiqueGradeIndex('pham')).toBe(0)
    expect(getPhysiqueGradeIndex('bao')).toBe(1)
    expect(getPhysiqueGradeIndex('tien')).toBe(9)
  })
})

// INV-9 - authored advancement transitions must form a contiguous,
// gapless prefix starting at 'pham': adjacent pairs, unique 'from',
// no skipped source rung. A mis-authored binding fails HERE (data
// guard), never silently reaches runtime.
describe('physique advancement authored integrity', () => {
  it('declared advancements form a contiguous prefix from pham', () => {
    const advancements = BODY_CHAPTERS
      .map(chapter => chapter.physiqueAdvancement)
      .filter((a): a is { from: PhysiqueGradeId; to: PhysiqueGradeId } => a !== undefined)

    // At least the body_refinement binding exists.
    expect(advancements.length).toBeGreaterThanOrEqual(1)

    const fromSet = new Set(advancements.map(a => a.from))

    // 'from' unique (a Set of N froms over N bindings).
    expect(fromSet.size).toBe(advancements.length)

    for (const a of advancements) {
      // Adjacent only - no skipped rung, no regress.
      expect(getPhysiqueGradeIndex(a.to)).toBe(getPhysiqueGradeIndex(a.from) + 1)
    }

    // Contiguous prefix: the 'from' set is exactly
    // { ladder[0], ladder[1], ..., ladder[N-1] } starting at 'pham'.
    const expectedFroms = PHYSIQUE_GRADES
      .slice(0, advancements.length)
      .map(def => def.id)

    expect([...fromSet].sort(
      (a, b) => getPhysiqueGradeIndex(a) - getPhysiqueGradeIndex(b),
    )).toEqual(expectedFroms)
    expect(advancements.some(a => a.from === 'pham')).toBe(true)
  })

  it('body_refinement binds exactly pham -> bao; meridian declares none', () => {
    const refinement = BODY_CHAPTERS.find(c => c.id === 'body_refinement')
    const meridian = BODY_CHAPTERS.find(c => c.id === 'meridian')

    expect(refinement?.physiqueAdvancement).toEqual({ from: 'pham', to: 'bao' })
    expect(meridian?.physiqueAdvancement).toBeUndefined()
  })
})
