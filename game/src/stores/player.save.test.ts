// @vitest-environment jsdom
// R10 (AR-12) — buildGameSave's structuredClone(player) (S1) cannot clone
// a Vue-reactive Proxy tree at all: structuredClone throws DataCloneError
// on the first nested reactive object/array it meets (even an empty one),
// because Proxy exotic objects have no matching internal type for the
// algorithm. usePlayerStore.save() used to pass `this` (later `this.
// $state`) straight into buildGameSave — both still fully reactive — so
// every real save attempt from the actual Settings UI crashed synchronously
// before it ever reached the storage layer.
import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import { GameManager } from '../core/game/GameManager'
import { loadGame } from '../services/save/SaveSystem'

describe('usePlayerStore.save (R10, AR-12)', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('does not throw DataCloneError on a fresh reactive store', () => {
    setActivePinia(createPinia())
    const player = usePlayerStore()
    const gameManager = new GameManager()
    gameManager.setActivePlayer(player.$state)

    expect(() => player.save(gameManager)).not.toThrow()
  })

  it('persists a detached snapshot — later store mutation does not change what was written', async () => {
    setActivePinia(createPinia())
    const player = usePlayerStore()
    const gameManager = new GameManager()
    gameManager.setActivePlayer(player.$state)
    player.name = 'saved-name'

    await player.save(gameManager)

    player.name = 'mutated-after-save'

    const outcome = loadGame()
    if (outcome.status !== 'ok') throw new Error(`expected a valid save, got ${outcome.status}`)
    expect(outcome.save.player.name).toBe('saved-name')
  })
})
