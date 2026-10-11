// QA R4 attack repro (blind wave 4) - FINDING R4-SAVE-1 (HIGH).
//
// Attack vector: the v89 -> v90 re-stamp migration shipped inside
// inspectLocalSave (SaveSystem.ts:566-588) ONLY. The boot comment chain
// says every consumer runs "the same pipeline the boot load runs", but
// recoveryApi.validateRecoveryData still hard-requires
// `foundVersion === CURRENT_SAVE_VERSION` (recoveryApi.ts:50) with no
// migration step.
//
// Honest flow that breaks: a player exports a save on a v89 build (the
// exact file the Export button produced YESTERDAY - same bytes, same
// shape, no corruption), upgrades to the v90 build, and imports it back.
// validateRecoveryData classifies it 'incompatible' while the local
// load pipeline consumes the identical bytes fine. On the previous
// build (CURRENT=89) the same file validated 'valid' - the bump
// introduced the rejection, not the file.
//
// Repro: seed localStorage with a valid v89 save. inspectLocalSave
// returns 'ok' (the migration works - kept as the intent witness).
// validateRecoveryData on the SAME bytes must also return 'valid'.
// Currently returns 'incompatible' -> FAIL on current HEAD.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_SAVE_VERSION, inspectLocalSave } from './SaveSystem'
import { validateRecoveryData } from './recoveryApi'
import { resolveSaveKey, setSaveAccountId } from './saveKeys'
import { createDefaultPlayer } from '../../core/player/Player'
import type { GameSave } from './saveTypes'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null }
  removeItem(key: string): void { this.store.delete(key) }
  setItem(key: string, value: string): void { this.store.set(key, value) }
}

function validGameSave(): GameSave {
  const player = createDefaultPlayer()
  player.mortalBasicSkillId = 'linh_bao'
  player.nodeLevels = { ...player.nodeLevels, core_linh_bao: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_linh_bao']
  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [],
    skills: [
      {
        id: 'linh_bao',
        name: 'Linh Bão',
        description: 'creation pick',
        type: 'active',
        level: 1,
        maxLevel: 10,
        cooldown: 0,
        target: 'enemy',
        effects: [],
      },
    ],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

describe('R4-SAVE-1 - a v89 payload migrates on every pipeline, not only inspectLocalSave', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    vi.stubGlobal('sessionStorage', new MemoryStorage())
    setSaveAccountId('u1')
  })

  it('local boot pipeline consumes a v89 save (intent witness - passes)', () => {
    const raw = JSON.stringify({ ...validGameSave(), version: 89 })
    localStorage.setItem(resolveSaveKey(), raw)

    const inspected = inspectLocalSave()

    expect(inspected.status).toBe('ok')
    if (inspected.status === 'ok') {
      expect(inspected.save.version).toBe(CURRENT_SAVE_VERSION)
    }
  })

  it('recovery import accepts the SAME v89 bytes (currently incompatible)', () => {
    const raw = JSON.stringify({ ...validGameSave(), version: 89 })

    const result = validateRecoveryData(raw)

    // The file comment promises "the same pipeline the boot load runs
    // (parse -> version -> shape -> acceptance)". The version step must
    // therefore migrate 89 -> CURRENT exactly like inspectLocalSave.
    expect(result.status).toBe('valid')
    if (result.status === 'valid') {
      expect(result.version).toBe(CURRENT_SAVE_VERSION)
    }
  })
})
