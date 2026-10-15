// Local boot and recovery import deliberately reject non-current versions.
// Incompatible bytes stay unchanged and exportable; validation never writes slots.

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

describe('strict rejection of old versions across local and recovery admission', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage())
    vi.stubGlobal('sessionStorage', new MemoryStorage())
    setSaveAccountId('u1')
  })

  it('validates current-schema recovery bytes without writing the local slot', () => {
    const raw = JSON.stringify(validGameSave())
    const prior = 'untouched local slot'
    localStorage.setItem(resolveSaveKey(), prior)
    const result = validateRecoveryData(raw)
    expect(result.status).toBe('valid')
    if (result.status !== 'valid') return
    expect(result.version).toBe(CURRENT_SAVE_VERSION)
    expect(JSON.parse(result.normalizedRaw).version).toBe(CURRENT_SAVE_VERSION)
    expect(localStorage.getItem(resolveSaveKey())).toBe(prior)
  })

  it('local boot rejects a v89 save without altering its slot', () => {
    const raw = JSON.stringify({ ...validGameSave(), version: 89 })
    localStorage.setItem(resolveSaveKey(), raw)

    const inspected = inspectLocalSave()

    expect(inspected).toEqual({ status: 'incompatible', foundVersion: 89, raw })
    expect(localStorage.getItem(resolveSaveKey())).toBe(raw)
  })

  it('recovery import rejects the same v89 bytes without replacing the local slot', () => {
    const raw = JSON.stringify({ ...validGameSave(), version: 89 })

    const prior = JSON.stringify(validGameSave())
    localStorage.setItem(resolveSaveKey(), prior)
    const result = validateRecoveryData(raw)

    // Both entry points preserve incompatible bytes without migration.
    expect(result).toEqual({ status: 'incompatible', foundVersion: 89, raw })
    expect(localStorage.getItem(resolveSaveKey())).toBe(prior)
  })
})
