import { rollCharacterCreationTalents } from '@/data/talent/Talents'
import {
  validateCharacterCreationDraft,
  type CharacterCreationDraft,
  type CharacterCreationService,
  type CharacterCreationValidation,
} from './CharacterCreationService'

class MockCharacterCreationService implements CharacterCreationService {
  private availableTalentIds = new Set<string>()

  async rollTalents() {
    const talents = rollCharacterCreationTalents()
    this.availableTalentIds = new Set(talents.map(talent => talent.id))
    return talents
  }

  async checkNameAvailable() {
    return true
  }

  validateDraft(draft: CharacterCreationDraft, availableTalentIds: ReadonlySet<string>): CharacterCreationValidation {
    return validateCharacterCreationDraft(draft, availableTalentIds)
  }

  async createCharacter(draft: CharacterCreationDraft) {
    const validation = this.validateDraft(draft, this.availableTalentIds)
    return validation.ok
      ? { ok: true as const, characterId: crypto.randomUUID() }
      : validation
  }
}

export const characterCreationService: CharacterCreationService = new MockCharacterCreationService()
