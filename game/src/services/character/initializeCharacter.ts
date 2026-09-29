import type { GameManager } from '../../core/game/GameManager'
import type { PlayerData } from '../../core/player/Player'
import { applyCreationProfile, bootstrapEarlyGamePlayer } from '../../core/game/EarlyGameBootstrap'
import type { RemoteCharacterMetadata } from '../session/BackendStatus'

// B1.4 (beta-final PR3) - the ONE starter-grant transaction. App.vue's
// grant block lived inside the onNewCharacter callback; moving it here
// makes the same code serve both entry paths:
//   - fresh creation: local creation payload, or the canonical metadata
//     the create_character RPC returned;
//   - crash before revision 1: the CHARACTER_UNINITIALIZED boot branch
//     reconstructs exactly this snapshot from server metadata - no
//     reroll, no duplicated grant.
// Owners are injected so the function stays composable-testable and never
// reaches into App module scope.

export interface CharacterInitializationMetadata {
  name: string
  talentIds: string[]
  mortalBasicSkillId: string
}

export interface InitializeCharacterOwners {
  gameManager: GameManager
  player: PlayerData
  /** GameClock.nowSeconds() - building lastCollectedAt anchors to the
   *  game clock, not Date.now(). */
  nowSeconds: () => number
}

/** The remote metadata shape is canonical for UNINITIALIZED
 *  reconstruction; the creation draft is the local equivalent. Both map
 *  onto one initialization input - a missing skill pick is corrupt data,
 *  never a silent default (v82 contract). */
export function initializationMetadataFromRemote(character: RemoteCharacterMetadata): CharacterInitializationMetadata {
  return {
    name: character.name,
    talentIds: character.selectedTalentIds,
    mortalBasicSkillId: character.mortalBasicSkillId ?? '',
  }
}

export function initializeCharacter(
  metadata: CharacterInitializationMetadata,
  owners: InitializeCharacterOwners,
): void {
  const { gameManager, player, nowSeconds } = owners

  applyCreationProfile(player, {
    name: metadata.name,
    talentIds: metadata.talentIds,
    mortalBasicSkillId: metadata.mortalBasicSkillId,
  })

  bootstrapEarlyGamePlayer(gameManager, player, metadata.mortalBasicSkillId)

  for (const buildingId of ['teleport_array', 'gathering_outpost']) {
    const instance = {
      instanceId: crypto.randomUUID(),
      buildingId,
      level: 1,
      lastCollectedAt: nowSeconds(),
    }

    gameManager.buildingManager.add(instance)
    gameManager.buildingOps.refreshAutoWorkerCapacity(player, instance)
  }

  // Starter pack covers the 3 base buildings (Linh Tuyen/Khi Duong/Dan
  // Phong) - ids follow the unified age axis (gp123 6E C2).
  for (const [materialId, amount] of [
    ['mortal_wood_decade', 15],
    ['mortal_ore_decade', 6],
  ] as const) {
    if (gameManager.materialRegistry.has(materialId)) {
      gameManager.materialBag.add(gameManager.materialRegistry.get(materialId), amount)
    }
  }

  // The 3 Thanh Van sources: autoRestart on - sites start producing once
  // workers are allocated (Mission D: workers-as-fuel, no manual start).
  for (const definition of gameManager.productionSystem.getSiteDefinitions()) {
    gameManager.buildingOps.setProductionAutoRestart(definition.siteId, true)
  }

  gameManager.setActivePlayer(player)
}
