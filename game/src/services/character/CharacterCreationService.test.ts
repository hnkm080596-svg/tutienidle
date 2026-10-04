import { describe, expect, it } from 'vitest'
import { isValidCharacterName, validateCharacterCreationDraft, type CharacterCreationDraft } from './CharacterCreationService'
import { BETA_CREATION_TALENT_IDS } from '@/core/betaScope'

const offeredId = BETA_CREATION_TALENT_IDS[0]!
const validDraft: CharacterCreationDraft = {
  name: 'Lạc Vân',
  talentIds: [offeredId],
}
// The roll offers the beta-admitted id plus a non-beta id a stale
// offer list could carry.
const rollIds = new Set([offeredId, 'pham_nhan_chi_cot', 'a', 'b', 'c', 'd', 'e', 'f', 'g'])

describe('character creation validation', () => {
  it('accepts Vietnamese character names', () => expect(isValidCharacterName('Lạc Vân')).toBe(true))
  it('accepts a valid draft with exactly one beta-admitted talent', () => expect(validateCharacterCreationDraft(validDraft, rollIds)).toEqual({ ok: true }))
  it('rejects forged, non-offered, non-beta, or wrongly-counted talent picks', () => {
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: ['forged'] }, rollIds).ok).toBe(false)
    // 'pham_nhan_chi_cot' is offered by the (stale) roll but excluded
    // by the beta allow-list - the draft validator fails closed on it.
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: ['pham_nhan_chi_cot'] }, rollIds)).toEqual({
      ok: false,
      code: 'invalid_talents',
      message: expect.any(String),
    })
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: [offeredId, 'a'] }, rollIds).ok).toBe(false)
    expect(validateCharacterCreationDraft({ ...validDraft, talentIds: [] }, rollIds).ok).toBe(false)
  })
  it('the draft contract carries no starter-skill pick at all', () => {
    // BETA SCOPE LOCK v2: the canonical beta draft is name + talent.
    // A payload-shaped injection of a starter pick is structurally
    // absent - the boot seam writes the constant itself.
    expect('mortalBasicSkillId' in validDraft).toBe(false)
  })
})
