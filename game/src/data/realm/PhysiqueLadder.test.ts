import { describe, expect, it } from 'vitest'

import { BODY_CHAPTERS, validateBodyChapterRegistry } from '../../core/realm/body/BodyChapter'
import {
  getPhysiqueGradeIndex,
  isPhysiqueGradeId,
  PHYSIQUE_GRADES,
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
// no skipped source rung. Since M-F-BODY-CORE the chain rule lives in
// validateBodyChapterRegistry (the registry's runtime validator, also
// run at module load) - this block pins the authored data through it.
describe('physique advancement authored integrity', () => {
  it('the authored advancement chain passes registry validation', () => {
    // Covers: unique 'from' ownership, single-rung adjacency, and the
    // contiguous-prefix-from-'pham' rule for every declared transition.
    expect(validateBodyChapterRegistry(BODY_CHAPTERS)).toEqual([])
  })

  it('body_refinement binds exactly pham -> bao; meridian declares none', () => {
    const refinement = BODY_CHAPTERS.find(c => c.id === 'body_refinement')
    const meridian = BODY_CHAPTERS.find(c => c.id === 'meridian')

    expect(refinement?.physiqueAdvancement).toEqual({ from: 'pham', to: 'bao' })
    expect(meridian?.physiqueAdvancement).toBeUndefined()
  })
})
