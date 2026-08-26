import { describe, expect, it } from 'vitest'
import { CHARACTER_CREATION_TALENTS, rollCharacterCreationTalents } from './Talents'

describe('rollCharacterCreationTalents', () => {
  it('returns nine unique talents from the catalog', () => {
    for (let index = 0; index < 50; index++) {
      const roll = rollCharacterCreationTalents()
      expect(roll).toHaveLength(9)
      expect(new Set(roll.map((talent) => talent.id)).size).toBe(9)
      expect(roll.every((talent) => CHARACTER_CREATION_TALENTS.includes(talent))).toBe(true)
    }
  })
})
