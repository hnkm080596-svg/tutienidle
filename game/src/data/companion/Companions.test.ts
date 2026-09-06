import { describe, expect, it } from 'vitest'
import { COMPANIONS } from './Companions'
import { ITEM_GRADE_ORDER } from '@/core/item/ItemGrade'

describe('Companions content file', () => {
  it('every companion has a valid ItemGrade and a basic skill', () => {
    for (const companion of COMPANIONS) {
      expect(ITEM_GRADE_ORDER).toContain(companion.grade)
      expect(companion.basic).toBeDefined()
      expect(companion.basic.id).toBeTruthy()
    }
  })

  it('every companion id is unique', () => {
    const ids = COMPANIONS.map((companion) => companion.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('TEST-ONLY placeholder companions (Hỗn Độn Trận visual test tooling)', () => {
  it('has at least 5 test companions, each with a valid grade and basic skill', () => {
    const testCompanions = COMPANIONS.filter((c) => c.id.startsWith('test_companion_'))

    expect(testCompanions.length).toBeGreaterThanOrEqual(5)

    for (const companion of testCompanions) {
      expect(ITEM_GRADE_ORDER).toContain(companion.grade)
      expect(companion.basic.id).toBeTruthy()
    }
  })
})
