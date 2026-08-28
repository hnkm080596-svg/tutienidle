import { describe, expect, it } from 'vitest'
import { isValidCharacterName, validateCharacterCreationDraft, type CharacterCreationDraft } from './CharacterCreationService'

const validDraft: CharacterCreationDraft = {
  name: 'Lạc Vân',
  talentIds: ['a'],
  attributes: { strength: 1, dexterity: 1, intelligence: 1, attunement: 1, vitality: 1 },
}
const rollIds = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])

describe('character creation validation', () => {
  it('accepts Vietnamese character names', () => expect(isValidCharacterName('Lạc Vân')).toBe(true))
  it('accepts a valid draft with exactly one talent', () => expect(validateCharacterCreationDraft(validDraft, rollIds)).toEqual({ ok: true }))
  it('rejects forged talent IDs and picking more than one', () => {
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: ['forged'] }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: ['a', 'b'] }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: [] }, rollIds).ok).toBe(false)
  })
  it('rejects non-integer, negative, or incorrectly totaled attributes', () => {
    expect(validateCharacterCreationDraft({ ...validDraft, attributes: { ...validDraft.attributes, strength: 1.5 } }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, attributes: { ...validDraft.attributes, strength: -1 } }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, attributes: { strength: 5, dexterity: 1, intelligence: 0, attunement: 0, vitality: 0 } }, rollIds).ok).toBe(false)
  })
})
