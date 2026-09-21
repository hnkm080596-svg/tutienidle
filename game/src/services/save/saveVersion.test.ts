import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadGame, CURRENT_SAVE_VERSION, type GameSave } from './SaveSystem'
import { resolveSaveKey } from './saveKeys'
import { createDefaultPlayer } from '../../core/player/Player'

const SAVE_KEY = resolveSaveKey()

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

// P7-M2 (v69) - the version live on master immediately before the
// realm-passive ownership cut removed Technique.passiveSkillIdsByRealm +
// innateSkillId. Same "anything !== CURRENT" contract; the literal pins
// the concrete boundary this mission cut over.
const PRE_M2_VERSION = 68

// P7-M3 (v70) - the version live on master immediately before the
// canonical-technique cut moved Technique snapshots to
// rank/mastery/grade/quality with the 0-or-1 way-matched holder. Same
// "anything !== CURRENT" contract; the literal pins the concrete
// boundary this mission cut over.
const PRE_M3_VERSION = 69

// P7-M4 (v71) - the version live on master immediately before the
// combat-role contract retired the generic skill loadout (skill entries
// carry no loadoutSlot/loadoutSlots/equipped/unlocked; learned =
// SkillManager membership). Same "anything !== CURRENT" contract; the
// literal pins the concrete boundary this mission cut over.
const PRE_M4_VERSION = 70

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

  it('rejects a save stamped with the pre-M2 version (68) as incompatible', () => {
    const player = createDefaultPlayer()
    // Intentionally NOT GameSave: version 68 is outside the current literal
    // type, so the payload is built as a raw record like preReworkSaveRaw().
    const save: Record<string, unknown> = {
      version: PRE_M2_VERSION,
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
    const raw = JSON.stringify(save)

    localStorage.setItem(SAVE_KEY, raw)

    expect(loadGame()).toEqual({ status: 'incompatible', foundVersion: PRE_M2_VERSION, raw })
  })

  it('rejects a save stamped with the pre-M3 version (69) as incompatible', () => {
    const player = createDefaultPlayer()
    // Intentionally NOT GameSave: version 69 is outside the current literal
    // type, so the payload is built as a raw record like preReworkSaveRaw().
    const save: Record<string, unknown> = {
      version: PRE_M3_VERSION,
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
    const raw = JSON.stringify(save)

    localStorage.setItem(SAVE_KEY, raw)

    expect(loadGame()).toEqual({ status: 'incompatible', foundVersion: PRE_M3_VERSION, raw })
  })

  it('rejects a save stamped with the pre-M4 version (70) as incompatible', () => {
    const player = createDefaultPlayer()
    // Intentionally NOT GameSave: version 70 is outside the current literal
    // type, so the payload is built as a raw record like preReworkSaveRaw().
    const save: Record<string, unknown> = {
      version: PRE_M4_VERSION,
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
    const raw = JSON.stringify(save)

    localStorage.setItem(SAVE_KEY, raw)

    expect(loadGame()).toEqual({ status: 'incompatible', foundVersion: PRE_M4_VERSION, raw })
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
