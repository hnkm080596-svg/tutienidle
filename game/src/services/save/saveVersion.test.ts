import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGame, CURRENT_SAVE_VERSION, type GameSave } from './SaveSystem'
import { createDefaultPlayer } from '../../core/player/Player'

const SAVE_KEY = 'tien-hiep-idle-save'

// Phap Tu Reimagined Task 15 — the rework deleted PlayerData fields
// (unlockedElements/equippedElements/skillStats consumers) and whole
// registries (reaction-path skills/buffs/nodes). A save stamped with any
// pre-rework version carries that retired shape — it must be REJECTED
// with a clear 'incompatible' outcome (no partial load, no state touch),
// while a current-version save still loads.

// The version live on master before this rework bumped it. Kept as a
// literal so the test still pins the pre-rework version after future
// bumps (the rejection contract is "anything !== CURRENT", and this
// documents which concrete version the rework cut over from).
const PRE_REWORK_VERSION = 61

// vitest runs environment: 'node' — no real localStorage, so a minimal
// in-memory polyfill is stubbed (same pattern as SaveSystem.test.ts).
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

function preReworkSaveRaw(): string {
  const player = createDefaultPlayer() as unknown as Record<string, unknown>

  // Simulate the retired fields a real pre-rework save would carry.
  player.unlockedElements = ['fire']
  player.equippedElements = ['fire']

  const save: Record<string, unknown> = {
    version: PRE_REWORK_VERSION,
    player,
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }

  return JSON.stringify(save)
}

describe('Phap Tu Reimagined save cutover', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
  })

  it('rejects a save stamped with the pre-rework version (61) as incompatible', () => {
    const raw = preReworkSaveRaw()

    localStorage.setItem(SAVE_KEY, raw)

    const outcome = loadGame()

    expect(outcome).toEqual({ status: 'incompatible', foundVersion: PRE_REWORK_VERSION, raw })
  })

  it('loads a save stamped with the current version', () => {
    const player = createDefaultPlayer()
    const save: GameSave = {
      version: CURRENT_SAVE_VERSION,
      player,
      techniques: [],
      skills: [],
      materials: [],
      equipment: [],
      pills: [],
      talismans: [],
      formations: [],
      buildings: [],
      equipmentSlots: [],
    }

    localStorage.setItem(SAVE_KEY, JSON.stringify(save))

    expect(loadGame().status).toBe('ok')
  })
})
