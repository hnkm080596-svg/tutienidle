import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { CultivationPathId } from '../core/player/CultivationPathKit'

// visualProfileId is the entity-derived visual form — the single source every
// surface (CombatScene gate, MainScene, Tran Phap preview payload) reads.
describe('player store — visualProfileId', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('no cultivation path -> mortal', () => {
    const store = usePlayerStore()

    expect(store.visualProfileId).toBe('mortal')
  })

  it('spell path -> phap_tu profile', () => {
    const store = usePlayerStore()

    store.cultivationPath = 'spell'

    expect(store.visualProfileId).toBe('phap_tu')
  })

  it('sword path -> kiem_tu profile id (art layer falls back to mortal)', () => {
    const store = usePlayerStore()

    store.cultivationPath = 'sword'

    expect(store.visualProfileId).toBe('kiem_tu')
  })

  it('unknown path value (e.g. an older/newer save id) -> mortal fallback', () => {
    const store = usePlayerStore()

    store.cultivationPath = 'some_future_path' as unknown as CultivationPathId

    expect(store.visualProfileId).toBe('mortal')
  })
})
