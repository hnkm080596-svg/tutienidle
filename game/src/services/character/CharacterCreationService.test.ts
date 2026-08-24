import { describe, expect, it } from 'vitest'
import { isValidCharacterName, validateCharacterCreationDraft, type CharacterCreationDraft } from './CharacterCreationService'

const validDraft: CharacterCreationDraft = {
  name: 'Lạc Vân',
  talentIds: ['a', 'b', 'c'],
  attributes: { strength: 1, dexterity: 1, intelligence: 1, attunement: 1, vitality: 1 },
}
const rollIds = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])

describe('character creation validation', () => {
  it('accepts Vietnamese character names', () => expect(isValidCharacterName('Lạc Vân')).toBe(true))
  it('accepts a valid draft', () => expect(validateCharacterCreationDraft(validDraft, rollIds)).toEqual({ ok: true }))
  it('rejects duplicate or forged talent IDs', () => {
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: ['a', 'a', 'c'] }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: ['a', 'b', 'forged'] }, rollIds).ok).toBe(false)
  })
  it('rejects non-integer, negative, or incorrectly totaled attributes', () => {
    expect(validateCharacterCreationDraft({ ...validDraft, attributes: { ...validDraft.attributes, strength: 1.5 } }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, attributes: { ...validDraft.attributes, strength: -1 } }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, attributes: { strength: 5, dexterity: 1, intelligence: 0, attunement: 0, vitality: 0 } }, rollIds).ok).toBe(false)
  })
})
