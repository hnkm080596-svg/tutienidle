// Cloud SAVE_READY admission rejects non-current payloads and mismatched envelopes.
// Rejection preserves local bytes; matching current versions remain consumable.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseCloudSaveService } from './SupabaseCloudSaveService'
import { resolveSaveKey, setSaveAccountId } from '../save/saveKeys'
import { CURRENT_SAVE_VERSION } from '../save/SaveSystem'
import { createDefaultPlayer } from '../../core/player/Player'
import type { ClientBuildInfo } from '../backend/ClientBuildInfo'
import type { GameSave } from '../save/saveTypes'

const config = { url: 'https://example.supabase.co', anonKey: 'anon' }

const build: ClientBuildInfo = {
  buildId: 'beta-test-build',
  appVersion: '0.0.0',
  releaseChannel: 'beta',
  saveSchemaVersion: CURRENT_SAVE_VERSION,
}

const BINDING = { sessionId: 'sess-1', userId: 'u1', accessToken: 'tok-u1' }

const CHECKPOINT = { checkpointId: 'chk-1', anchorAt: '2026-09-30T00:00:00Z', leaseExpiresAt: '2026-10-07T00:00:00Z' }

const REMOTE_CHARACTER = {
  id: 'char-1',
  name: 'Vo Danh',
  selectedTalentIds: ['talent-a'],
  baseAttributes: { strength: 1, dexterity: 1, intelligence: 1, attunement: 1, vitality: 1 },
  mortalBasicSkillId: 'linh_bao',
  realmId: 'mortal',
  realmLevel: 0,
  createdAt: '2026-09-30T00:00:00Z',
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

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null }
  removeItem(key: string): void { this.store.delete(key) }
  setItem(key: string, value: string): void { this.store.set(key, value) }
}

interface FetchCall { url: string; init: RequestInit }

function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    return handler({ url, init })
  }))
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status })
}

function makeService(): SupabaseCloudSaveService {
  return new SupabaseCloudSaveService(config, build, {
    resolveBinding: async () => BINDING,
    monotonicNow: () => 1000,
  })
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  setSaveAccountId('u1')
})

describe('cloud pull rejects old versions consistently with local admission', () => {
  it('matching current payload and envelope load without minting or spending materials', async () => {
    const payload = validGameSave()
    stubFetch(() => json({
      status: 'SAVE_READY', character: REMOTE_CHARACTER,
      save: { schemaVersion: CURRENT_SAVE_VERSION, saveRevision: 5, payload, updatedAt: '2026-09-30T00:00:00Z' },
      serverCheckpoint: CHECKPOINT, serverTimeUtc: '2026-09-30T00:00:00Z',
    }))
    const result = await makeService().load()
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.save.version).toBe(CURRENT_SAVE_VERSION)
    expect(result.save.materials).toEqual(payload.materials)
    expect(result.save.pills).toEqual(payload.pills)
  })

  it.each([
    [CURRENT_SAVE_VERSION, 89],
    [89, CURRENT_SAVE_VERSION],
  ])('rejects mismatched envelope %i / payload %i without replacing local bytes', async (schemaVersion, version) => {
    const payload = { ...validGameSave(), version }
    const raw = JSON.stringify(payload)
    const prior = JSON.stringify(validGameSave())
    localStorage.setItem(resolveSaveKey(), prior)
    stubFetch(() => json({
      status: 'SAVE_READY', character: REMOTE_CHARACTER,
      save: { schemaVersion, saveRevision: 5, payload, updatedAt: '2026-09-30T00:00:00Z' },
      serverCheckpoint: CHECKPOINT, serverTimeUtc: '2026-09-30T00:00:00Z',
    }))
    expect(await makeService().load()).toEqual({ status: 'incompatible', foundVersion: version, raw })
    expect(localStorage.getItem(resolveSaveKey())).toBe(prior)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('SAVE_READY carrying a v89 row remains incompatible without replacing local bytes', async () => {
    const payload = { ...validGameSave(), version: 89 }
    const raw = JSON.stringify(payload)
    localStorage.setItem(resolveSaveKey(), raw)
    stubFetch(() => json({
      status: 'SAVE_READY',
      character: REMOTE_CHARACTER,
      save: {
        schemaVersion: 89,
        saveRevision: 5,
        payload,
        updatedAt: '2026-09-30T00:00:00Z',
      },
      serverCheckpoint: CHECKPOINT,
      serverTimeUtc: '2026-09-30T00:00:00Z',
    }))

    const result = await makeService().load()

    expect(result).toEqual({ status: 'incompatible', foundVersion: 89, raw })
    expect(localStorage.getItem(resolveSaveKey())).toBe(raw)
    expect(JSON.stringify(payload)).toBe(raw)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
