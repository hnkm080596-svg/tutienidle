import { describe, expect, it } from 'vitest'
import {
  PROFESSION_GRADE_BY_REALM,
  PROFESSION_GRADE_ORDER,
} from '../profession/ProfessionGrade'
import { canUseItemGrade } from './canUseItem'

describe('canUseItemGrade', () => {
  it('allows exactly the player realm grade and rejects adjacent grades for every realm', () => {
    const realmIds = Object.keys(PROFESSION_GRADE_BY_REALM)

    expect(realmIds).toHaveLength(10)

    for (const realmId of realmIds) {
      const playerGrade = PROFESSION_GRADE_BY_REALM[realmId]!
      const gradeIndex = PROFESSION_GRADE_ORDER.indexOf(playerGrade)

      expect(canUseItemGrade(playerGrade, realmId)).toBe(true)

      if (gradeIndex > 0) {
        expect(canUseItemGrade(PROFESSION_GRADE_ORDER[gradeIndex - 1]!, realmId)).toBe(false)
      }

      if (gradeIndex < PROFESSION_GRADE_ORDER.length - 1) {
        expect(canUseItemGrade(PROFESSION_GRADE_ORDER[gradeIndex + 1]!, realmId)).toBe(false)
      }
    }
  })

  it('rejects both extremum mismatches', () => {
    expect(canUseItemGrade('cuu_pham', 'tribulation')).toBe(false)
    expect(canUseItemGrade('tien_pham', 'mortal')).toBe(false)
  })
})
