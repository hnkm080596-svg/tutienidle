import { describe, expect, it } from 'vitest'
import {
  isMortalPrecursorSkillId,
  MORTAL_DEFAULT_BASIC_ID,
  MORTAL_PRECURSOR_SKILL_IDS,
} from './MortalPrecursors'
import { CAST_LEVELING_THRESHOLDS } from './CastLeveling'

// P7-M4 - the mortal-selectable basic set lives HERE (was implied twice:
// CAST_LEVELING_THRESHOLDS keys + KiemTuState list + the `in TABLE` gate).
// This contract test pins the two authorities together - a new precursor
// added to the leveling table without the list (or vice versa) fails.
describe('MortalPrecursors', () => {
  it('the mortal-selectable set equals the cast-leveling table keys', () => {
    expect([...MORTAL_PRECURSOR_SKILL_IDS].sort()).toEqual(
      Object.keys(CAST_LEVELING_THRESHOLDS).sort(),
    )
  })

  it('isMortalPrecursorSkillId accepts members and rejects non-members', () => {
    for (const id of MORTAL_PRECURSOR_SKILL_IDS) {
      expect(isMortalPrecursorSkillId(id)).toBe(true)
    }

    expect(isMortalPrecursorSkillId('hoa_cau_thuat')).toBe(false)
    expect(isMortalPrecursorSkillId('')).toBe(false)
  })

  it('the mortal default basic is itself a precursor', () => {
    expect(isMortalPrecursorSkillId(MORTAL_DEFAULT_BASIC_ID)).toBe(true)
    expect(MORTAL_DEFAULT_BASIC_ID).toBe('tram')
  })
})
