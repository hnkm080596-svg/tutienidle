import { rollCharacterCreationTalents } from '@/data/talent/Talents'
import { isBetaCreationTalentId } from '@/core/betaScope'
import {
  CHARACTER_CREATION_ROLL_SIZE,
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
    // Offer = first ROLL_SIZE of the weighted no-replacement roll, after
    // the beta filter so a non-beta pool hit can never shrink the offer.
    const talents = rollCharacterCreationTalents()
      .filter(talent => isBetaCreationTalentId(talent.id))
      .slice(0, CHARACTER_CREATION_ROLL_SIZE)
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
