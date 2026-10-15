import { describe, expect, it } from 'vitest'
import {
  PROFESSION_GRADE_BY_REALM,
  PROFESSION_GRADE_ORDER,
} from '../profession/ProfessionGrade'
import { canUseItemGrade } from './canUseItem'

describe('canUseItemGrade', () => {
  it('allows the player realm grade and lower grades, and rejects higher grades for every realm', () => {
    const realmIds = Object.keys(PROFESSION_GRADE_BY_REALM)

    expect(realmIds).toHaveLength(10)

    for (const realmId of realmIds) {
      const playerGrade = PROFESSION_GRADE_BY_REALM[realmId]!
      const gradeIndex = PROFESSION_GRADE_ORDER.indexOf(playerGrade)

      expect(canUseItemGrade(playerGrade, realmId)).toBe(true)

      if (gradeIndex > 0) {
        expect(canUseItemGrade(PROFESSION_GRADE_ORDER[gradeIndex - 1]!, realmId)).toBe(true)
      }

      if (gradeIndex < PROFESSION_GRADE_ORDER.length - 1) {
        expect(canUseItemGrade(PROFESSION_GRADE_ORDER[gradeIndex + 1]!, realmId)).toBe(false)
      }
    }
  })

  it('allows lowest grade at highest realm and rejects highest grade at lowest realm', () => {
    expect(canUseItemGrade('cuu_pham', 'tribulation')).toBe(true)
    expect(canUseItemGrade('tien_pham', 'mortal')).toBe(false)
  })
})
