import type { TalentDefinition } from '@/core/talent/Talent'
import { isBetaCreationTalentId } from '@/core/betaScope'
import type { RemoteCharacterMetadata } from '../session/BackendStatus'

// Thien Phu is the character's single DAO-direction choice
// (talent-direction-choice-plan.md): each character picks exactly 1
// talent from the 3-roll beta pool (reroll rolls a fresh 3). Old saves
// with 3 talents still work - every effect helper iterates the array
// and skips unknown ids, so no migration (development phase).
//
// BETA SCOPE LOCK v2 (phase-2): canonical beta creation is Name +
// Talent only. The mortal starter pick is NOT part of the contract -
// new characters always get BETA_MORTAL_STARTER_SKILL_ID ('linh_bao')
// applied at the boot seam, and the starter admission
// (setMortalBasicSkill) fails closed on any other id. A draft object
// carrying a mortalBasicSkillId field is simply ignored - nothing
// downstream reads it.
export const CHARACTER_CREATION_TALENT_COUNT = 1
// How many talents one creation roll offers on screen.
export const CHARACTER_CREATION_ROLL_SIZE = 3

export interface CharacterCreationDraft {
  name: string
  talentIds: string[]
}

export type CharacterCreationErrorCode = 'invalid_name' | 'invalid_talents' | 'invalid_skill' | 'name_taken' | 'server_unavailable' | 'character_exists'
export type CharacterCreationValidation = { ok: true } | { ok: false; code: CharacterCreationErrorCode; message: string }
// The supabase create_character RPC is metadata-only (B1.4): CREATED
// returns the canonical character block, which doubles as the
// reconstruction input if the first save never lands
// (CHARACTER_UNINITIALIZED at the next boot). Mock sessions return only
// the id.
export type CharacterCreationResult =
  | { ok: true; characterId: string; character?: RemoteCharacterMetadata }
  | { ok: false; code: CharacterCreationErrorCode; message: string }

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

  // Beta scope: the pick must be offered (present in the current roll)
  // AND beta-admitted - the beta gate fails closed even for ids a stale
  // or unfiltered offer list might carry.
  const uniqueTalentIds = new Set(draft.talentIds)
  if (
    draft.talentIds.length !== CHARACTER_CREATION_TALENT_COUNT
    || uniqueTalentIds.size !== CHARACTER_CREATION_TALENT_COUNT
    || draft.talentIds.some(id => !availableTalentIds.has(id) || !isBetaCreationTalentId(id))
  ) {
    return { ok: false, code: 'invalid_talents', message: 'Phải chọn đúng một Thiên Phú thuộc lượt roll hiện tại.' }
  }

  return { ok: true }
}
