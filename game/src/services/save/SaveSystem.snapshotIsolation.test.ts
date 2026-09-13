// R10 (AR-12) - snapshot isolation: buildGameSave must produce a VALUE
// at a point in time. Mutating live state after the build must not
// change the snapshot (nested player fields included).
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { materials } from '../../data/materials/materials'
import { equipment } from '../../data/equipment/equipment'
import { affixes } from '../../data/equipment/affixes'
import { buildGameSave } from './SaveSystem'

function createBootedGameManager(): GameManager {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerMaterials(materials)
  gameManager.catalogOps.registerEquipment(equipment)
  gameManager.catalogOps.registerAffixes(affixes)
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

  // Production regression (found live, not from a synthetic fixture):
  // usePlayerStore's actual `this.$state` is a Vue-reactive Proxy, not a
  // plain PlayerData object. structuredClone has no concept of Proxy
  // exotic objects — it throws DataCloneError the instant it meets one,
  // at ANY nesting depth, including a field Vue only wrapped lazily after
  // some earlier getter/computed touched it (this is why a
  // freshly-constructed reactive() with no prior access still needs to
  // exercise a getter here to reproduce it — real gameplay's `finalStats`
  // getter runs every tick and touches baseStats/modifiers/
  // externalModifiers this way). toRaw() alone is not sufficient either —
  // it only unwraps the OUTERMOST proxy, not nested ones.
  it('accepts a Vue-reactive player object (real usePlayerStore.$state shape), even after nested fields were reactively accessed', () => {
    const gameManager = createBootedGameManager()
    const reactivePlayer = reactive(createDefaultPlayer())

    reactivePlayer.modifiers.push({ id: 'x', sourceId: 'x', sourceType: 'attribute', stat: 'attack', flat: 1 })
    reactivePlayer.externalModifiers.push({ id: 'y', sourceId: 'y', sourceType: 'attribute', stat: 'attack', flat: 1 })

    // Force Vue to lazily wrap nested modifier objects in their own
    // reactive Proxies, matching what reading `finalStats` does live.
    void reactivePlayer.baseStats.attack
    for (const modifier of reactivePlayer.modifiers) void modifier.flat
    for (const modifier of reactivePlayer.externalModifiers) void modifier.flat

    expect(() => buildGameSave(reactivePlayer, gameManager)).not.toThrow()

    const save = buildGameSave(reactivePlayer, gameManager)
    expect(save.player.modifiers).toEqual([{ id: 'x', sourceId: 'x', sourceType: 'attribute', stat: 'attack', flat: 1 }])
  })
})
