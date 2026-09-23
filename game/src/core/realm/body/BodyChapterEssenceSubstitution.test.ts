import { describe, expect, it } from 'vitest'

import {
  essenceSubstitutionCoverage,
  essenceSubstitutionYield,
  planEssenceSubstitution,
} from './BodyChapterEssenceSubstitution'
import type { BodyChapterCurrency } from './BodyChapter'
import type { PhysiqueGradeId } from '../../../data/realm/PhysiqueLadder'
import { PHYSIQUE_ESSENCE_CONVERSION_RATIO } from '../../../data/realm/PhysiqueEssence'

const R_BAO = PHYSIQUE_ESSENCE_CONVERSION_RATIO.bao ?? 0
const R_PHAP = PHYSIQUE_ESSENCE_CONVERSION_RATIO.phap ?? 0

const PHAM_COST: BodyChapterCurrency = { bag: 'material', id: 'tinh_hoa_pham_the' }
const BAO_COST: BodyChapterCurrency = { bag: 'material', id: 'tinh_hoa_bao_the' }
const PHAP_COST: BodyChapterCurrency = { bag: 'material', id: 'tinh_hoa_phap_the' }

function ownedOf(owned: Partial<Record<PhysiqueGradeId, number>>) {
  return (grade: PhysiqueGradeId): number => owned[grade] ?? 0
}

// M-QI-09 (QI-D4c) - pure substitution plan math: per-hop integer
// yield, lowest-grade-first spend, minimum whole units per hop, and
// exact-value change-back (C2C rulings round 10 items 1-2 + 6).
describe('essenceSubstitutionYield', () => {
  it('returns 1 for the same grade and 0 for a downward source', () => {
    expect(essenceSubstitutionYield('pham', 'pham')).toBe(1)
    expect(essenceSubstitutionYield('bao', 'pham')).toBe(0)
  })

  it('returns the authored adjacent ratio for one hop', () => {
    expect(essenceSubstitutionYield('pham', 'bao')).toBe(R_BAO)
    expect(essenceSubstitutionYield('bao', 'phap')).toBe(R_PHAP)
  })

  it('compounds multi-hop coverage as the per-hop product (floor-at-each-hop result)', () => {
    expect(essenceSubstitutionYield('pham', 'phap')).toBe(R_BAO * R_PHAP)
  })

  it('returns 0 across rungs with no authored essence or ratio', () => {
    // linh and every rung above phap have no authored material/ratio -
    // a broken chain can never carry value.
    expect(essenceSubstitutionYield('pham', 'linh')).toBe(0)
    expect(essenceSubstitutionYield('bao', 'linh')).toBe(0)
  })
})

describe('essenceSubstitutionCoverage', () => {
  it('sums higher-rung yields against owned stacks', () => {
    expect(
      essenceSubstitutionCoverage(PHAM_COST, ownedOf({ bao: 4, phap: 1 })),
    ).toBe(4 * R_BAO + 1 * R_BAO * R_PHAP)
  })

  it('refuses non-material bags and non-family ids at the resolver boundary (C2C 6)', () => {
    const pill: BodyChapterCurrency = { bag: 'pill', id: 'tinh_hoa_bao_the' }
    const foreign: BodyChapterCurrency = { bag: 'material', id: 'qi_refining_ore_decade' }
    expect(essenceSubstitutionCoverage(pill, ownedOf({ bao: 9 }))).toBe(0)
    expect(essenceSubstitutionCoverage(foreign, ownedOf({ bao: 9 }))).toBe(0)
  })
})

describe('planEssenceSubstitution', () => {
  it('spends the required currency first and never touches higher grades when it covers', () => {
    const plan = planEssenceSubstitution(30, PHAM_COST, ownedOf({ pham: 40, bao: 5 }))
    expect(plan).toBeDefined()
    expect(plan!.debits).toEqual([{ materialId: 'tinh_hoa_pham_the', amount: 30 }])
    expect(plan!.covered).toBe(30)
    expect(plan!.change).toBeUndefined()
  })

  it('substitutes the minimum whole higher units for the shortfall with exact change-back', () => {
    // 30 required, 10 pham owned -> 20 shortfall; bao yield is 2:
    // ceil(20/2) = 10 units, exact (no change).
    const exact = planEssenceSubstitution(30, PHAM_COST, ownedOf({ pham: 10, bao: 10 }))
    expect(exact!.debits).toEqual([
      { materialId: 'tinh_hoa_pham_the', amount: 10 },
      { materialId: 'tinh_hoa_bao_the', amount: 10 },
    ])
    expect(exact!.covered).toBe(30)
    expect(exact!.change).toBeUndefined()

    // 19 shortfall -> ceil(19/2) = 10 bao covering 20: the 1-unit
    // overpay is credited back as pham inside the same transaction.
    const odd = planEssenceSubstitution(29, PHAM_COST, ownedOf({ pham: 10, bao: 10 }))
    expect(odd!.debits).toEqual([
      { materialId: 'tinh_hoa_pham_the', amount: 10 },
      { materialId: 'tinh_hoa_bao_the', amount: 10 },
    ])
    expect(odd!.covered).toBe(30)
    expect(odd!.change).toEqual({ materialId: 'tinh_hoa_pham_the', amount: 1 })
  })

  it('cascades upward grade-by-grade and compounds across multiple hops', () => {
    // 30 required: 4 pham + 5 bao (10 covered) leaves 16; phap yield is
    // 4 -> ceil(16/4) = 4 phap exactly.
    const plan = planEssenceSubstitution(
      30,
      PHAM_COST,
      ownedOf({ pham: 4, bao: 5, phap: 4 }),
    )
    expect(plan!.debits).toEqual([
      { materialId: 'tinh_hoa_pham_the', amount: 4 },
      { materialId: 'tinh_hoa_bao_the', amount: 5 },
      { materialId: 'tinh_hoa_phap_the', amount: 4 },
    ])
    expect(plan!.covered).toBe(30)
  })

  it('credits multi-hop change in the required material', () => {
    // 30 required, pham 0: bao 7 covers 14 -> shortfall 16, phap
    // ceil(16/4) = 4 exact? No - take 31: bao 7 covers 14, shortfall
    // 17 -> phap ceil(17/4) = 5 covering 20, overpay 3 back as pham.
    const plan = planEssenceSubstitution(
      31,
      PHAM_COST,
      ownedOf({ pham: 0, bao: 7, phap: 5 }),
    )
    expect(plan!.debits).toEqual([
      { materialId: 'tinh_hoa_bao_the', amount: 7 },
      { materialId: 'tinh_hoa_phap_the', amount: 5 },
    ])
    expect(plan!.covered).toBe(34)
    expect(plan!.change).toEqual({ materialId: 'tinh_hoa_pham_the', amount: 3 })
  })

  it('covers only what exists when even full substitution is insufficient', () => {
    // 100 required, pham 10 + bao 4 (8) + phap 1 (4) = 22 coverable -
    // the plan reports partial coverage rather than refusing.
    const plan = planEssenceSubstitution(
      100,
      PHAM_COST,
      ownedOf({ pham: 10, bao: 4, phap: 1 }),
    )
    expect(plan!.debits).toEqual([
      { materialId: 'tinh_hoa_pham_the', amount: 10 },
      { materialId: 'tinh_hoa_bao_the', amount: 4 },
      { materialId: 'tinh_hoa_phap_the', amount: 1 },
    ])
    expect(plan!.covered).toBe(22)
    expect(plan!.covered).toBeLessThan(100)
  })

  it('refuses non-material bags and non-family material ids at the resolver boundary (C2C 6)', () => {
    const pill: BodyChapterCurrency = { bag: 'pill', id: 'thong_mach_dan' }
    const collidingPill: BodyChapterCurrency = { bag: 'pill', id: 'tinh_hoa_bao_the' }
    const foreign: BodyChapterCurrency = { bag: 'material', id: 'qi_refining_ore_decade' }
    expect(planEssenceSubstitution(10, pill, ownedOf({ bao: 5 }))).toBeUndefined()
    expect(planEssenceSubstitution(10, collidingPill, ownedOf({ bao: 5 }))).toBeUndefined()
    expect(planEssenceSubstitution(10, foreign, ownedOf({ bao: 5 }))).toBeUndefined()
  })
})

// M-F-ESSENCE (F9 residual) - the typed descriptor boundary exercised
// at bao/phap required grades. Phap is the top authored rung: coverage
// is always 0, so under the caller's all-or-nothing precondition
// (consumed <= owned + coverage) every phap-required plan is a
// required-only exact debit. A bao-required cost exercises the
// phap -> bao hop with exact change-back.
describe('M-F-ESSENCE - bao/phap required costs', () => {
  it('reports zero coverage for a phap-required cost - top authored rung', () => {
    expect(essenceSubstitutionCoverage(PHAP_COST, ownedOf({}))).toBe(0)
    expect(essenceSubstitutionCoverage(PHAP_COST, ownedOf({ phap: 9 }))).toBe(0)
    expect(essenceSubstitutionCoverage(PHAP_COST, ownedOf({ bao: 9, phap: 9 }))).toBe(0)
  })

  it('debits a phap-required cost exactly - required-only, never change', () => {
    const plan = planEssenceSubstitution(12, PHAP_COST, ownedOf({ phap: 12, bao: 9 }))
    expect(plan).toBeDefined()
    expect(plan!.debits).toEqual([{ materialId: 'tinh_hoa_phap_the', amount: 12 }])
    expect(plan!.covered).toBe(12)
    expect(plan!.change).toBeUndefined()

    const smaller = planEssenceSubstitution(7, PHAP_COST, ownedOf({ phap: 9 }))
    expect(smaller!.debits).toEqual([{ materialId: 'tinh_hoa_phap_the', amount: 7 }])
    expect(smaller!.covered).toBe(7)
    expect(smaller!.change).toBeUndefined()
  })

  it('substitutes phap for a bao-required cost at the locked ratio with change-back', () => {
    // consumed 11, bao 0: phap yield is 2 -> ceil(11/2) = 6 phap
    // covering 12, the 1-unit overpay credited back as bao.
    const plan = planEssenceSubstitution(11, BAO_COST, ownedOf({ phap: 6 }))
    expect(plan!.debits).toEqual([{ materialId: 'tinh_hoa_phap_the', amount: 6 }])
    expect(plan!.covered).toBe(12)
    expect(plan!.change).toEqual({ materialId: 'tinh_hoa_bao_the', amount: 1 })
  })

  it('spends owned bao first, then the phap hop only for the shortfall', () => {
    // consumed 11, bao 5: shortfall 6 -> ceil(6/2) = 3 phap exact.
    const plan = planEssenceSubstitution(11, BAO_COST, ownedOf({ bao: 5, phap: 3 }))
    expect(plan!.debits).toEqual([
      { materialId: 'tinh_hoa_bao_the', amount: 5 },
      { materialId: 'tinh_hoa_phap_the', amount: 3 },
    ])
    expect(plan!.covered).toBe(11)
    expect(plan!.change).toBeUndefined()
  })

  it('sums phap coverage for a bao-required cost at the single-hop yield', () => {
    expect(essenceSubstitutionCoverage(BAO_COST, ownedOf({}))).toBe(0)
    expect(essenceSubstitutionCoverage(BAO_COST, ownedOf({ phap: 3 }))).toBe(3 * R_PHAP)
    expect(essenceSubstitutionCoverage(BAO_COST, ownedOf({ phap: 3, bao: 7 }))).toBe(3 * R_PHAP)
  })
})
