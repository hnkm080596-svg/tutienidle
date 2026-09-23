import { describe, expect, it } from 'vitest'
import type { Technique, TechniqueCycleOutcome } from './Technique'
import {
  BASE_RANK_MASTERY,
  canAdvanceTechniqueGrade,
  computeTechniqueGradeInheritance,
  getEffectiveTechniqueRank,
  getTechniqueEffects,
  getTechniqueGradeCeiling,
  getTechniqueGradeUpgradeCost,
  getTechniqueMasteryForNextRank,
  getTechniqueRankCeiling,
  getTechniqueTierForRank,
  projectTechniqueCompletion,
  resolveTechniqueCompletionState,
  TECHNIQUE_RANK_CAP,
  TECHNIQUE_TIER_LABELS,
} from './TechniqueProgression'

const BASE_TECHNIQUE: Technique = {
  id: 'five_elements_art',
  name: 'Tiểu Ngũ Hành Quyết',
  description: 'test',
  grade: 1,
  rank: 0,
  mastery: 0,
  quality: 'hoang',
  gradeHistory: {},
}

describe('getTechniqueMasteryForNextRank', () => {
  it('scales linearly with grade', () => {
    expect(BASE_RANK_MASTERY).toBe(300)
    expect(TECHNIQUE_RANK_CAP).toBe(18)
    expect(getTechniqueMasteryForNextRank(1)).toBe(300)
    expect(getTechniqueMasteryForNextRank(2)).toBe(600)
    expect(getTechniqueMasteryForNextRank(5)).toBe(1500)
  })
})

describe('getTechniqueTierForRank', () => {
  it('maps the rescaled 18-rank bands to the four technique tiers', () => {
    expect(getTechniqueTierForRank(0)).toBe('so_nhap')
    expect(getTechniqueTierForRank(1)).toBe('tieu_thanh')
    expect(getTechniqueTierForRank(4)).toBe('tieu_thanh')
    expect(getTechniqueTierForRank(5)).toBe('dai_thanh')
    expect(getTechniqueTierForRank(9)).toBe('dai_thanh')
    expect(getTechniqueTierForRank(10)).toBe('vien_man')
    expect(getTechniqueTierForRank(18)).toBe('vien_man')
  })

  it('keeps the legacy tier labels', () => {
    expect(TECHNIQUE_TIER_LABELS).toEqual({
      so_nhap: 'Sơ Nhập',
      tieu_thanh: 'Tiểu Thành',
      dai_thanh: 'Đại Thành',
      vien_man: 'Viên Mãn',
    })
  })
})

describe('getTechniqueRankCeiling', () => {
  it('is min(18, realmLevel) while the live grade matches the realm band', () => {
    const inBand: Technique = { ...BASE_TECHNIQUE, grade: 2 }
    expect(getTechniqueRankCeiling(inBand, 'foundation_establishment', 1)).toBe(1)
    expect(getTechniqueRankCeiling(inBand, 'foundation_establishment', 12)).toBe(12)
    expect(getTechniqueRankCeiling(inBand, 'foundation_establishment', 18)).toBe(18)
    // realmLevel above the cap still clamps at 18
    expect(getTechniqueRankCeiling(inBand, 'foundation_establishment', 30)).toBe(18)
  })

  it('is 0 whenever the live grade lags the realm band', () => {
    const lagging: Technique = { ...BASE_TECHNIQUE, grade: 1 }
    expect(getTechniqueRankCeiling(lagging, 'foundation_establishment', 18)).toBe(0)
    expect(getTechniqueRankCeiling(lagging, 'golden_core', 18)).toBe(0)
  })

  it('is 0 for mortals and unknown realms', () => {
    const inBand: Technique = { ...BASE_TECHNIQUE, grade: 1 }
    expect(getTechniqueRankCeiling({ ...inBand, grade: 0 }, 'mortal', 10)).toBe(0)
    expect(getTechniqueRankCeiling(inBand, 'not_a_realm', 10)).toBe(0)
  })
})

describe('resolveTechniqueCompletionState', () => {
  it('seals vien_man only at the absolute summit (finalRank 18)', () => {
    expect(resolveTechniqueCompletionState(18, 18)).toBe('vien_man')
    // realmLevel at freeze above 18 still yields vien_man via the cap
    expect(resolveTechniqueCompletionState(18, 12)).toBe('vien_man')
  })

  it('seals dai_thanh when finalRank equals the freeze-time realmLevel', () => {
    expect(resolveTechniqueCompletionState(12, 12)).toBe('dai_thanh')
    expect(resolveTechniqueCompletionState(1, 1)).toBe('dai_thanh')
  })

  it('seals partial otherwise - early exit and mid-training freezes', () => {
    expect(resolveTechniqueCompletionState(17, 18)).toBe('partial')
    expect(resolveTechniqueCompletionState(11, 12)).toBe('partial')
    expect(resolveTechniqueCompletionState(0, 12)).toBe('partial')
    // realmLevel 0 (defensive) can never claim dai_thanh
    expect(resolveTechniqueCompletionState(0, 0)).toBe('partial')
  })
})

describe('projectTechniqueCompletion', () => {
  it('projects a live in-band cycle from current rank + realmLevel', () => {
    const live: Technique = { ...BASE_TECHNIQUE, grade: 2, rank: 12, gradeHistory: {} }
    expect(projectTechniqueCompletion(live, 12)).toEqual({
      finalRank: 12,
      completionState: 'dai_thanh',
    })
    expect(projectTechniqueCompletion({ ...live, rank: 11 }, 12)).toEqual({
      finalRank: 11,
      completionState: 'partial',
    })
    expect(projectTechniqueCompletion({ ...live, rank: 18 }, 12)).toEqual({
      finalRank: 18,
      completionState: 'vien_man',
    })
  })

  it('returns a sealed live-grade record verbatim when present', () => {
    const sealed: TechniqueCycleOutcome = { finalRank: 7, completionState: 'partial' }
    const lagging: Technique = {
      ...BASE_TECHNIQUE,
      grade: 1,
      rank: 7,
      gradeHistory: { 1: sealed },
    }
    expect(projectTechniqueCompletion(lagging, 18)).toEqual(sealed)
  })
})

describe('computeTechniqueGradeInheritance', () => {
  it('returns the empty payload for every recorded outcome', () => {
    expect(computeTechniqueGradeInheritance({ finalRank: 18, completionState: 'vien_man' })).toEqual({})
    expect(computeTechniqueGradeInheritance({ finalRank: 0, completionState: 'partial' })).toEqual({})
    expect(computeTechniqueGradeInheritance(undefined)).toEqual({})
  })
})

describe('getEffectiveTechniqueRank', () => {
  it('returns the literal rank while the live grade matches the realm', () => {
    expect(getEffectiveTechniqueRank({ rank: 9, grade: 2 }, 'foundation_establishment')).toBe(9)
  })

  it('returns 0 whenever the live grade lags - sealed-cycle rank dies at freeze', () => {
    // a grade-1 holder in foundation_establishment (index 2) keeps rank
    // 12 in the mirror for display but gates see 0
    expect(getEffectiveTechniqueRank({ rank: 12, grade: 1 }, 'foundation_establishment')).toBe(0)
    expect(getEffectiveTechniqueRank({ rank: 18, grade: 2 }, 'golden_core')).toBe(0)
  })

  it('fails closed for a missing mirror', () => {
    expect(getEffectiveTechniqueRank(undefined, 'foundation_establishment')).toBe(0)
    expect(getEffectiveTechniqueRank(null, 'foundation_establishment')).toBe(0)
  })
})

describe('getTechniqueGradeCeiling', () => {
  it('returns the realm index for canonical realms', () => {
    expect(getTechniqueGradeCeiling('mortal')).toBe(0)
    expect(getTechniqueGradeCeiling('qi_refining')).toBe(1)
    expect(getTechniqueGradeCeiling('foundation_establishment')).toBe(2)
    expect(getTechniqueGradeCeiling('golden_core')).toBe(3)
    expect(getTechniqueGradeCeiling('body_integration')).toBe(7)
    expect(getTechniqueGradeCeiling('mahayana')).toBe(8)
    expect(getTechniqueGradeCeiling('tribulation')).toBe(9)
  })

  it('returns -1 for unknown realms so all grade checks fail', () => {
    expect(getTechniqueGradeCeiling('not_a_realm')).toBe(-1)
  })
})

describe('getTechniqueEffects', () => {
  const withGrades: Technique = {
    ...BASE_TECHNIQUE,
    gradeEffects: {
      1: {
        so_nhap: { mightFlat: 5 },
        vien_man: { mightFlat: 20 },
      },
      2: {
        so_nhap: { mightFlat: 50 },
      },
    },
  }

  it('resolves the authored grade table at the rank band', () => {
    expect(getTechniqueEffects({ ...withGrades, grade: 1, rank: 0 })).toEqual({ mightFlat: 5 })
    expect(getTechniqueEffects({ ...withGrades, grade: 1, rank: 12 })).toEqual({ mightFlat: 20 })
    expect(getTechniqueEffects({ ...withGrades, grade: 2, rank: 0 })).toEqual({ mightFlat: 50 })
  })

  it('falls back to the highest authored grade table below the current grade', () => {
    const onlyG1: Technique = { ...withGrades, gradeEffects: { 1: { so_nhap: { mightFlat: 5 } } } }
    expect(getTechniqueEffects({ ...onlyG1, grade: 3, rank: 0 })).toEqual({ mightFlat: 5 })
  })

  it('returns undefined when nothing is authored', () => {
    expect(getTechniqueEffects(BASE_TECHNIQUE)).toBeUndefined()
  })
})

describe('canAdvanceTechniqueGrade', () => {
  it('is catch-up only: the live grade must lag the realm band', () => {
    // A sealed grade-1 holder may catch up inside foundation_establishment
    // (index 2) regardless of the sealed cycle's rank.
    const lagging: Technique = { ...BASE_TECHNIQUE, grade: 1, rank: 12, gradeHistory: { 1: { finalRank: 12, completionState: 'dai_thanh' } } }
    expect(canAdvanceTechniqueGrade(lagging, 'foundation_establishment')).toBe(true)
    expect(canAdvanceTechniqueGrade(lagging, 'golden_core')).toBe(true)
    // Grade 0 never legally advances (pre-grant floor).
    expect(canAdvanceTechniqueGrade({ ...lagging, grade: 0 }, 'golden_core')).toBe(false)
  })

  it('refuses while the live grade is in-band or above the ceiling', () => {
    const inBand: Technique = { ...BASE_TECHNIQUE, grade: 2, rank: 18 }
    expect(canAdvanceTechniqueGrade(inBand, 'foundation_establishment')).toBe(false)
    expect(canAdvanceTechniqueGrade({ ...inBand, grade: 1 }, 'qi_refining')).toBe(false)
    expect(canAdvanceTechniqueGrade(inBand, 'mortal')).toBe(false)
    expect(canAdvanceTechniqueGrade(undefined, 'foundation_establishment')).toBe(false)
  })
})

describe('getTechniqueGradeUpgradeCost', () => {
  it('charges 100 x targetGrade in current-tier spirit stones', () => {
    expect(getTechniqueGradeUpgradeCost(2, 'foundation_establishment')).toEqual({
      materialId: 'spirit_stone_ha_pham',
      amount: 200,
    })
    expect(getTechniqueGradeUpgradeCost(3, 'foundation_establishment')).toEqual({
      materialId: 'spirit_stone_ha_pham',
      amount: 300,
    })
    expect(getTechniqueGradeUpgradeCost(4, 'golden_core')).toEqual({
      materialId: 'spirit_stone_trung_pham',
      amount: 400,
    })
  })
})
