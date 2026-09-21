// P6-M1 - shared early-game creation/bootstrap writes. Two seams so the
// order production uses (profile -> boot -> core setup) is preserved and
// both consumers (App.vue handlers, EarlyGameSession) run ONE path:
//
//   applyCreationProfile   = CharacterCreationScreen payload -> PlayerData
//                            (App.vue::onCharacterCreated semantics)
//   bootstrapEarlyGamePlayer = fresh-character core setup
//                            (App.vue::onNewCharacter core subset)
//
// The profile arrives ALREADY VALID - creation validation lives at the
// service/UI boundary (characterCreationService.validateDraft); core
// never re-validates and never imports upward into services.
// App-only wiring (starter buildings/materials, production auto-restart,
// setActivePlayer, autosave) stays in App.vue - it is not part of the
// core bootstrap contract.
import type { GameManager } from './GameManager'
import type { PlayerData } from '../player/Player'

export interface EarlyGameCreationProfile {
  name: string
  talentIds: string[]
  attributes: Partial<
    Record<
      'strength' | 'dexterity' | 'intelligence' | 'attunement' | 'vitality',
      number
    >
  >
}

export function applyCreationProfile(
  player: PlayerData,
  profile: EarlyGameCreationProfile,
): void {
  player.name = profile.name
  player.selectedTalentIds = [...profile.talentIds]

  for (const [stat, amount] of Object.entries(profile.attributes) as Array<
    [keyof EarlyGameCreationProfile['attributes'], number | undefined]
  >) {
    player.baseStats[stat] += amount ?? 0
  }
}

export function bootstrapEarlyGamePlayer(
  gameManager: GameManager,
  player: PlayerData,
): void {
  // Nhan vat moi: hoc san tam phap + skill (onNewCharacter core subset).
  gameManager.realmAdvanceOps.learnTechnique('tu_linh_quyet')
  gameManager.realmAdvanceOps.equipTechnique('tu_linh_quyet')
  gameManager.progressionOps.learnSkill('tram')
  gameManager.progressionOps.setSkillLoadoutSlot(player, 0, 'tram')
 // Phap Tu Reimagined Task 2 - mortal-path actives.
  gameManager.progressionOps.learnSkill('linh_bao')
 // Huy Quyen - second mortal basic, learned unequipped; grinding it
  // to Lv3 (10.000 casts) is what reveals ung_the at the ritual.
  gameManager.progressionOps.learnSkill('huy_quyen')
}
