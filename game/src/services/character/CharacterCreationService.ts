import type { TalentDefinition } from '@/core/talent/Talent'
import { isMortalPrecursorSkillId } from '@/core/skill/MortalPrecursors'

// Thiên Phú là quyết định chọn HƯỚNG ĐẠO duy nhất của nhân vật
// (talent-direction-choice-plan.md): mỗi nhân vật chọn đúng 1 thiên phú
// từ lượt roll 9. Save cũ còn 3 thiên phú vẫn chạy — mọi effect helper
// lặp mảng và bỏ qua id lạ, không migration (development phase).
export const CHARACTER_CREATION_TALENT_COUNT = 1
export const CHARACTER_CREATION_ROLL_SIZE = 9

export interface CharacterCreationDraft {
  name: string
  talentIds: string[]
  mortalBasicSkillId: string
}

export type CharacterCreationErrorCode = 'invalid_name' | 'invalid_talents' | 'invalid_skill' | 'name_taken' | 'server_unavailable'
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
    return { ok: false, code: 'invalid_talents', message: 'Phải chọn đúng một Thiên Phú thuộc lượt roll hiện tại.' }
  }

  if (!isMortalPrecursorSkillId(draft.mortalBasicSkillId)) {
    return { ok: false, code: 'invalid_skill', message: 'Phải chọn một khởi thủy chiêu thức.' }
  }

  return { ok: true }
}
