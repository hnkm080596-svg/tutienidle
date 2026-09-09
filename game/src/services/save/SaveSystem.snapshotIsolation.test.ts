// R10 (AR-12) - snapshot isolation: buildGameSave must produce a VALUE
// at a point in time. Mutating live state after the build must not
// change the snapshot (nested player fields included).
import { describe, expect, it } from 'vitest'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildGameSave } from './SaveSystem'

function createBootedGameManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.registerMaterials(materials)
  gameManager.registerEquipment(equipment)
  gameManager.registerAffixes(affixes)
  return gameManager
}

describe('buildGameSave snapshot isolation (AR-12)', () => {
  it('mutating live nested player state after build does not change the snapshot', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const snapshot = structuredClone(save)

    // Mutate live nested + top-level fields AFTER the build.
    player.baseStats.strength = 101
    player.name = 'changed-name'
    player.cultivation = 12345
    if (player.modifiers?.[0]) {
      player.modifiers[0].sourceId = 'mutated-after-build'
    }
    player.lastSavedAt = 1

    expect(save).toEqual(snapshot)
  })

  it('mutating manager-owned state after build does not change the snapshot', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const snapshot = structuredClone(save)

    // Live manager state mutations (quests active list, production sites).
    gameManager.questManager.getActive().push({
      questId: 'ghost_quest',
      progress: 99,
      claimed: false,
    })

    expect(save).toEqual(snapshot)
  })
})
