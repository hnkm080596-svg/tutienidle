import { describe, expect, it } from 'vitest'
import { isValidCharacterName, validateCharacterCreationDraft, type CharacterCreationDraft } from './CharacterCreationService'

const validDraft: CharacterCreationDraft = {
  name: 'Lạc Vân',
  talentIds: ['a'],
  mortalBasicSkillId: 'tram',
}
const rollIds = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])

describe('character creation validation', () => {
  it('accepts Vietnamese character names', () => expect(isValidCharacterName('Lạc Vân')).toBe(true))
  it('accepts a valid draft with exactly one talent and a precursor pick', () => expect(validateCharacterCreationDraft(validDraft, rollIds)).toEqual({ ok: true }))
  it('accepts every mortal precursor as the starting-skill pick', () => {
    for (const skillId of ['tram', 'linh_bao', 'huy_quyen']) {
      expect(validateCharacterCreationDraft({ ...validDraft, mortalBasicSkillId: skillId }, rollIds)).toEqual({ ok: true })
    }
  })
  it('rejects forged talent IDs and picking more than one', () => {
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: ['forged'] }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: ['a', 'b'] }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: [] }, rollIds).ok).toBe(false)
  })
  it('rejects a missing, non-precursor, or empty starting-skill pick', () => {
    const noPick = validateCharacterCreationDraft({ ...validDraft, mortalBasicSkillId: '' }, rollIds)
    expect(noPick).toEqual({ ok: false, code: 'invalid_skill', message: expect.any(String) })
    const nonPrecursor = validateCharacterCreationDraft({ ...validDraft, mortalBasicSkillId: 'hoa_cau_thuat' }, rollIds)
    expect(nonPrecursor).toEqual({ ok: false, code: 'invalid_skill', message: expect.any(String) })
  })
})
