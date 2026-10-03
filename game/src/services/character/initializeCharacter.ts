import type { GameManager } from '../../core/game/GameManager'
import type { PlayerData } from '../../core/player/Player'
import { applyCreationProfile, bootstrapEarlyGamePlayer } from '../../core/game/EarlyGameBootstrap'
import { BETA_MORTAL_STARTER_SKILL_ID } from '../../core/betaScope'
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

// BETA SCOPE LOCK v2 (phase-2): the initialization input is Name +
// Talent only - no starter pick. The remote row still carries
// mortal_basic_skill_id, but it is now server-side constant
// ('linh_bao'), validated at the adapter below rather than trusted as
// an input.
export interface CharacterInitializationMetadata {
  name: string
  talentIds: string[]
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
 *  onto one initialization input. Beta scope: the row's starter pick
 *  must be the fixed beta constant - a row saying otherwise is corrupt
 *  server data (it would also fail the write_character_save
 *  cross-check on the first save), so the adapter fails closed instead
 *  of silently booting a mismatched character. */
export function initializationMetadataFromRemote(character: RemoteCharacterMetadata): CharacterInitializationMetadata {
  const remotePick = character.mortalBasicSkillId ?? ''
  if (remotePick !== BETA_MORTAL_STARTER_SKILL_ID) {
    throw new Error(
      `initializationMetadataFromRemote: remote starter pick '${remotePick}' is not the beta starter '${BETA_MORTAL_STARTER_SKILL_ID}'`,
    )
  }
  return {
    name: character.name,
    talentIds: character.selectedTalentIds,
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
  })

  bootstrapEarlyGamePlayer(gameManager, player)

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

  // Mainline chain admission (AR-09): creation ends with no save
  // restore, so the quest lifecycle command must run here or a fresh
  // character sees an empty quest board until a realm advance. Runs
  // after setActivePlayer so reconcile resolves the new player; the
  // call is idempotent and covers local creation, Supabase creation,
  // and CHARACTER_UNINITIALIZED reconstruction alike.
  gameManager.tickOps.reconcileQuestLifecycle()
}
