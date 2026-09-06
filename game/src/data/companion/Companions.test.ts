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
