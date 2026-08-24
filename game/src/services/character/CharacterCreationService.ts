import type { TalentDefinition } from '@/core/talent/Talent'

export const CHARACTER_CREATION_ATTRIBUTE_POINTS = 5
export const CHARACTER_CREATION_TALENT_COUNT = 3
export const CHARACTER_CREATION_ROLL_SIZE = 9

export type CharacterAttribute = 'strength' | 'dexterity' | 'intelligence' | 'attunement' | 'vitality'
export type CharacterAttributes = Record<CharacterAttribute, number>

export interface CharacterCreationDraft {
  name: string
  talentIds: string[]
  attributes: CharacterAttributes
}

export type CharacterCreationErrorCode = 'invalid_name' | 'invalid_talents' | 'invalid_attributes' | 'name_taken' | 'server_unavailable'
export type CharacterCreationValidation = { ok: true } | { ok: false; code: CharacterCreationErrorCode; message: string }
export type CharacterCreationResult = { ok: true; characterId: string } | { ok: false; code: CharacterCreationErrorCode; message: string }

export interface CharacterCreationService {
  rollTalents(): Promise<TalentDefinition[]>
  checkNameAvailable(name: string): Promise<boolean>
  validateDraft(draft: CharacterCreationDraft, availableTalentIds: ReadonlySet<string>): CharacterCreationValidation
  createCharacter(draft: CharacterCreationDraft): Promise<CharacterCreationResult>
}

export function isValidCharacterName(value: string): boolean {
  return /^[\p{L}\p{N} _-]{2,20}$/u.test(value.trim())
}

export function validateCharacterCreationDraft(
  draft: CharacterCreationDraft,
  availableTalentIds: ReadonlySet<string>,
): CharacterCreationValidation {
  if (!isValidCharacterName(draft.name)) {
    return { ok: false, code: 'invalid_name', message: 'Đạo danh phải dài 2–20 ký tự.' }
  }

  const uniqueTalentIds = new Set(draft.talentIds)
  if (
    draft.talentIds.length !== CHARACTER_CREATION_TALENT_COUNT
    || uniqueTalentIds.size !== CHARACTER_CREATION_TALENT_COUNT
    || draft.talentIds.some(id => !availableTalentIds.has(id))
  ) {
    return { ok: false, code: 'invalid_talents', message: 'Phải chọn đúng ba Thiên Phú thuộc lượt roll hiện tại.' }
  }

  const values = Object.values(draft.attributes)
  if (values.some(value => !Number.isInteger(value) || value < 0) || values.reduce((sum, value) => sum + value, 0) !== CHARACTER_CREATION_ATTRIBUTE_POINTS) {
    return { ok: false, code: 'invalid_attributes', message: 'Phải phân bổ đúng năm điểm nguyên không âm.' }
  }

  return { ok: true }
}
