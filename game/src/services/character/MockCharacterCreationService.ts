import { rollCharacterCreationTalents } from '@/data/talent/Talents'
import { isBetaCreationTalentId } from '@/core/betaScope'
import {
  validateCharacterCreationDraft,
  type CharacterCreationDraft,
  type CharacterCreationService,
  type CharacterCreationValidation,
} from './CharacterCreationService'

export class MockCharacterCreationService implements CharacterCreationService {
  private availableTalentIds = new Set<string>()

  async rollTalents() {
    // Beta scope: the offer list is produced here at the service seam -
    // the roll can only return beta-admitted talents, so the UI never
    // filters the registry itself.
    const talents = rollCharacterCreationTalents().filter(talent =>
      isBetaCreationTalentId(talent.id),
    )
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
