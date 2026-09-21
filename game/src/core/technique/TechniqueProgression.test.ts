import { describe, expect, it } from 'vitest'
import type { Technique } from './Technique'
import {
  BASE_RANK_MASTERY,
  canAdvanceTechniqueGrade,
  getTechniqueEffects,
  getTechniqueGradeCeiling,
  getTechniqueGradeUpgradeCost,
  getTechniqueMasteryForNextRank,
  getTechniqueTierForRank,
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
}

describe('getTechniqueMasteryForNextRank', () => {
  it('scales linearly with grade', () => {
    expect(BASE_RANK_MASTERY).toBe(300)
    expect(TECHNIQUE_RANK_CAP).toBe(10)
    expect(getTechniqueMasteryForNextRank(1)).toBe(300)
    expect(getTechniqueMasteryForNextRank(2)).toBe(600)
    expect(getTechniqueMasteryForNextRank(5)).toBe(1500)
  })
})

describe('getTechniqueTierForRank', () => {
  it('maps rank bands to the four technique tiers', () => {
    expect(getTechniqueTierForRank(0)).toBe('so_nhap')
    expect(getTechniqueTierForRank(1)).toBe('tieu_thanh')
    expect(getTechniqueTierForRank(2)).toBe('tieu_thanh')
    expect(getTechniqueTierForRank(3)).toBe('dai_thanh')
    expect(getTechniqueTierForRank(5)).toBe('dai_thanh')
    expect(getTechniqueTierForRank(6)).toBe('vien_man')
    expect(getTechniqueTierForRank(10)).toBe('vien_man')
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
    expect(getTechniqueEffects({ ...withGrades, grade: 1, rank: 7 })).toEqual({ mightFlat: 20 })
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
  it('requires rank 10 and grade below the realm ceiling', () => {
    const ready: Technique = { ...BASE_TECHNIQUE, grade: 1, rank: 10, mastery: 0 }
    expect(canAdvanceTechniqueGrade(ready, 'foundation_establishment')).toBe(true)
    expect(canAdvanceTechniqueGrade({ ...ready, rank: 9 }, 'foundation_establishment')).toBe(false)
    expect(canAdvanceTechniqueGrade(ready, 'qi_refining')).toBe(false)
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
