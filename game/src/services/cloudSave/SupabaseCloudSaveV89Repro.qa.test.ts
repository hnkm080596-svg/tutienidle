// QA R4 attack repro (blind wave 4) - FINDING R4-SAVE-1 (HIGH), cloud leg.
//
// Attack vector: the v89 -> v90 re-stamp migration was wired ONLY into
// inspectLocalSave (SaveSystem.ts:566-588). The remote-authoritative
// pull path still hard-requires CURRENT_SAVE_VERSION on both the row
// envelope and the payload:
//   - SAVE_READY: SupabaseCloudSaveService.ts:739-741
//     (`foundVersion !== CURRENT_SAVE_VERSION || save.schemaVersion !==
//      CURRENT_SAVE_VERSION` -> 'incompatible')
//   - adoptCommittedPending: SupabaseCloudSaveService.ts:435-437 - the
//     identical gate runs on a pending-journal payload the server
//     committed during replay (pending records written pre-upgrade).
//
// The gate's own comment (line ~730) claims a downloaded payload
// "passes the SAME client pipeline the local adapter runs" - false
// after this commit: the local adapter now migrates 88 -> 89 -> 90,
// this path migrates nothing.
//
// Honest flow that breaks: every player whose server row was written
// by a v89 build boots the v90 build -> load() -> 'incompatible' ->
// boot fails onto the recovery surface (useAppLifecycle marks the
// recovery failed). On the previous build the identical row loaded
// 'ok' - the bump introduced the rejection.
//
// Repro: stub fetch returns a well-formed SAVE_READY row carrying
// schemaVersion 89 + payload version 89 (exactly what the server
// legitimately holds for a v89 writer). load() must consume it (status
// 'ok', payload re-stamped to CURRENT). Currently 'incompatible' ->
// FAIL on current HEAD.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseCloudSaveService } from './SupabaseCloudSaveService'
import { setSaveAccountId } from '../save/saveKeys'
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

describe('R4-SAVE-1 - cloud pull must migrate v89 rows like the local pipeline', () => {
  it('SAVE_READY carrying a v89 row loads ok (currently incompatible)', async () => {
    const payload = { ...validGameSave(), version: 89 }
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

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.save.version).toBe(CURRENT_SAVE_VERSION)
    }
  })
})
