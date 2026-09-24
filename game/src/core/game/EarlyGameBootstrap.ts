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
//
// BETA-CREATION - the creation pick is written here, not in
// applyCreationProfile: setMortalBasicSkill requires the precursor
// LEARNED, and precursors are learned inside this seam - so the pick is
// written immediately after the learns, still inside the same boot
// transaction (post-learn a valid pick cannot fail; false => throw).
import type { GameManager } from './GameManager'
import type { PlayerData } from '../player/Player'
import { MORTAL_PRECURSOR_SKILL_IDS } from '../skill/MortalPrecursors'

export interface EarlyGameCreationProfile {
  name: string
  talentIds: string[]
  mortalBasicSkillId: string
}

export function applyCreationProfile(
  player: PlayerData,
  profile: EarlyGameCreationProfile,
): void {
  player.name = profile.name
  player.selectedTalentIds = [...profile.talentIds]
}

export function bootstrapEarlyGamePlayer(
  gameManager: GameManager,
  player: PlayerData,
  basicSkillId: string,
): void {
  // New character: pre-learned skills (onNewCharacter core subset).
  // P7-M3 - NO technique at boot: mortals hold no canonical technique
  // (tu_linh_quyet retired); the Way grants its own at initiation.
  // BETA-CREATION - all three precursors stay learned; the creation
  // pick only chooses the STARTING basic (hidden-way Lv3 gates all
  // remain reachable).
  gameManager.progressionOps.learnSkill('tram', player)
  // Phap Tu Reimagined Task 2 - mortal-path actives.
  gameManager.progressionOps.learnSkill('linh_bao', player)
  // Huy Quyen - second mortal basic, learned; grinding it
  // to Lv3 (10.000 casts) is what reveals hidden_body_pathway at the ritual.
  gameManager.progressionOps.learnSkill('huy_quyen', player)

  // The learns are fail-closed like the pick below: a silently failed
  // precursor learn drops that hidden-way Lv3 gate forever.
  for (const skillId of MORTAL_PRECURSOR_SKILL_IDS) {
    if (!gameManager.skillManager.has(skillId)) {
      throw new Error(`bootstrap: precursor learn failed: ${skillId}`)
    }
  }

  // The pick is a runtime-validated write through the ONE role-write op.
  // A legal post-learn pick never returns false - treat false as drift.
  if (!gameManager.progressionOps.setMortalBasicSkill(player, basicSkillId)) {
    throw new Error(`bootstrap: starting-skill pick rejected: ${basicSkillId}`)
  }
}
