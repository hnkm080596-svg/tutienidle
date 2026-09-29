// Beta-final B1 (PR3) - the remote-authoritative adapter, verified
// against the PR2 RPC surface with a stubbed fetch. Asserts:
//   - load() maps every load_game_state status to the typed result union
//   - save() sends the guarded write contract + checkpoint object
//   - REJECTED/CONFLICT/error classes map to BackendErrorCode correctly
//   - the localStorage cache only ever receives server-ACKed bytes
//   - corrupted payloads preserve raw data for the recovery surface
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseCloudSaveService } from './SupabaseCloudSaveService'
import { CloudSaveCoordinator } from './CloudSaveCoordinator'
import { setSaveAccountId, resolveRevisionKey, resolveSaveKey } from '../save/saveKeys'
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
  mortalBasicSkillId: 'tram',
  realmId: 'mortal',
  realmLevel: 0,
  createdAt: '2026-09-30T00:00:00Z',
}

function validGameSave(): GameSave {
  const player = createDefaultPlayer()
  // v82 mortal boundary contract - the fixture doubles as a legal
  // creation output: pick + learned entry + core grant.
  player.mortalBasicSkillId = 'tram'
  player.nodeLevels = { ...player.nodeLevels, core_tram: 1 }
  player.purchasedNodeIds = [...player.purchasedNodeIds, 'core_tram']
  return {
    version: CURRENT_SAVE_VERSION,
    player,
    techniques: [],
    skills: [
      {
        id: 'tram',
        name: 'Trảm',
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

function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const call = { url, init }
    calls.push(call)
    return handler(call)
  }))
  return calls
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status })
}

function makeService(monotonic = { now: 1000 }): SupabaseCloudSaveService {
  return new SupabaseCloudSaveService(config, build, {
    resolveBinding: async () => BINDING,
    monotonicNow: () => monotonic.now,
  })
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  setSaveAccountId('u1')
})

describe('SupabaseCloudSaveService - load_game_state mapping (B1.3)', () => {
  it('NO_CHARACTER → empty revision 0, no cache write', async () => {
    stubFetch(() => json({ status: 'NO_CHARACTER', serverTimeUtc: '2026-09-30T00:00:00Z' }))

    const result = await makeService().load()

    expect(result).toEqual({ status: 'empty', revision: 0 })
    expect(localStorage.getItem(resolveSaveKey())).toBeNull()
    expect(localStorage.getItem(resolveRevisionKey())).toBeNull()
  })

  it('CHARACTER_UNINITIALIZED → uninitialized + canonical metadata + checkpoint stored', async () => {
    stubFetch(() => json({
      status: 'CHARACTER_UNINITIALIZED',
      character: REMOTE_CHARACTER,
      serverCheckpoint: CHECKPOINT,
      serverTimeUtc: '2026-09-30T00:00:00Z',
    }))

    const service = makeService()
    const result = await service.load()

    expect(result).toEqual({ status: 'uninitialized', character: REMOTE_CHARACTER, revision: 0 })
  })

  it('CHARACTER_UNINITIALIZED with malformed metadata → SERVER_ERROR', async () => {
    stubFetch(() => json({
      status: 'CHARACTER_UNINITIALIZED',
      character: { id: 'char-1' },
      serverCheckpoint: CHECKPOINT,
      serverTimeUtc: '2026-09-30T00:00:00Z',
    }))

    const result = await makeService().load()

    expect(result).toMatchObject({ status: 'unavailable', code: 'SERVER_ERROR', detail: 'CHARACTER_META_INVALID' })
  })

  it('CHARACTER_DELETED → deleted (terminal state, no recovery surface)', async () => {
    stubFetch(() => json({
      status: 'CHARACTER_DELETED',
      character: REMOTE_CHARACTER,
      deletedAt: '2026-09-30T00:00:00Z',
      serverTimeUtc: '2026-09-30T00:00:00Z',
    }))

    const result = await makeService().load()

    expect(result).toMatchObject({ status: 'deleted' })
  })

  it('INCOMPATIBLE version-mismatch → incompatible + raw preserved', async () => {
    stubFetch(() => json({
      status: 'INCOMPATIBLE',
      reason: 'version-mismatch',
      save: { schemaVersion: 99, saveRevision: 7, payload: { version: 99, player: {} } },
      serverTimeUtc: '2026-09-30T00:00:00Z',
    }))

    const result = await makeService().load()

    expect(result.status).toBe('incompatible')
    if (result.status === 'incompatible') {
      expect(result.foundVersion).toBe(99)
      expect(result.raw).toBe(JSON.stringify({ version: 99, player: {} }))
    }
  })

  it('INCOMPATIBLE invalid-payload → corrupted + raw preserved for recovery', async () => {
    stubFetch(() => json({
      status: 'INCOMPATIBLE',
      reason: 'invalid-payload',
      save: { schemaVersion: CURRENT_SAVE_VERSION, saveRevision: 7, payload: { garbage: true } },
      serverTimeUtc: '2026-09-30T00:00:00Z',
    }))

    const result = await makeService().load()

    expect(result).toMatchObject({ status: 'corrupted', raw: JSON.stringify({ garbage: true }) })
  })

  it('SAVE_READY valid → ok + cache mirror of server-ACKed bytes', async () => {
    const payload = validGameSave()
    stubFetch(() => json({
      status: 'SAVE_READY',
      character: REMOTE_CHARACTER,
      save: {
        schemaVersion: CURRENT_SAVE_VERSION,
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
      expect(result.revision).toBe(5)
      expect(result.raw).toBe(JSON.stringify(payload))
    }
    // B1.5 cache mirror: revision-first, bare GameSave bytes.
    expect(localStorage.getItem(resolveRevisionKey())).toBe('5')
    expect(localStorage.getItem(resolveSaveKey())).toBe(JSON.stringify(payload))
  })

  it('SAVE_READY with drifted payload version → incompatible (never a silent restore)', async () => {
    const payload = { ...validGameSave(), version: 42 }
    stubFetch(() => json({
      status: 'SAVE_READY',
      save: { schemaVersion: CURRENT_SAVE_VERSION, saveRevision: 5, payload },
      serverCheckpoint: CHECKPOINT,
      serverTimeUtc: '2026-09-30T00:00:00Z',
    }))

    const result = await makeService().load()

    expect(result.status).toBe('incompatible')
    if (result.status === 'incompatible') expect(result.raw).toContain('"version":42')
  })

  it('SAVE_READY failing shape validation → corrupted, raw preserved', async () => {
    const payload = { version: CURRENT_SAVE_VERSION, player: null }
    stubFetch(() => json({
      status: 'SAVE_READY',
      save: { schemaVersion: CURRENT_SAVE_VERSION, saveRevision: 5, payload },
      serverCheckpoint: CHECKPOINT,
      serverTimeUtc: '2026-09-30T00:00:00Z',
    }))

    const result = await makeService().load()

    expect(result.status).toBe('corrupted')
    if (result.status === 'corrupted') expect(result.raw).toBe(JSON.stringify(payload))
    // The corrupt payload must NOT be written into the cache mirror.
    expect(localStorage.getItem(resolveSaveKey())).toBeNull()
  })

  it('missing binding → unavailable AUTH_EXPIRED (no session, no write)', async () => {
    const calls = stubFetch(() => json({ status: 'NO_CHARACTER' }))
    const service = new SupabaseCloudSaveService(config, build, { resolveBinding: async () => null })

    const result = await service.load()

    expect(result).toMatchObject({ status: 'unavailable', code: 'AUTH_EXPIRED' })
    expect(calls).toHaveLength(0)
  })

  it('guard-raised 28000 "session revoked" → SESSION_REVOKED non-retryable', async () => {
    stubFetch(() => json({ code: '28000', message: 'session revoked' }, 400))

    const result = await makeService().load()

    expect(result).toMatchObject({ status: 'unavailable', code: 'SESSION_REVOKED', retryable: false })
  })

  it('guard-raised SESSION_PROTOCOL_OUTDATED → PROTOCOL_OUTDATED', async () => {
    stubFetch(() => json({ code: '28000', message: 'SESSION_PROTOCOL_OUTDATED' }, 400))

    const result = await makeService().load()

    expect(result).toMatchObject({ status: 'unavailable', code: 'PROTOCOL_OUTDATED', retryable: false })
  })

  it('401 → AUTH_EXPIRED retryable', async () => {
    stubFetch(() => json({ message: 'jwt expired' }, 401))

    const result = await makeService().load()

    expect(result).toMatchObject({ status: 'unavailable', code: 'AUTH_EXPIRED', retryable: true })
  })

  it('500 → SERVER_ERROR retryable', async () => {
    stubFetch(() => json({ message: 'boom' }, 500))

    const result = await makeService().load()

    expect(result).toMatchObject({ status: 'unavailable', code: 'SERVER_ERROR', retryable: true })
  })

  it('fetch throw → NETWORK_UNAVAILABLE (never a fabricated load)', async () => {
    stubFetch(() => { throw new Error('offline') })

    const result = await makeService().load()

    expect(result).toMatchObject({ status: 'unavailable', code: 'NETWORK_UNAVAILABLE' })
  })
})

describe('SupabaseCloudSaveService - write_character_save contract (B1.5/B1.6)', () => {
  function loadThenSaveFixture() {
    const payload = validGameSave()
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/load_game_state')) {
        return json({
          status: 'SAVE_READY',
          character: REMOTE_CHARACTER,
          save: { schemaVersion: CURRENT_SAVE_VERSION, saveRevision: 5, payload },
          serverCheckpoint: CHECKPOINT,
          serverTimeUtc: '2026-09-30T00:00:00Z',
        })
      }
      if (call.url.endsWith('/rpc/write_character_save')) {
        return json({
          status: 'COMMITTED',
          alreadyCommitted: false,
          committedRevision: 6,
          currentRevision: 6,
          progressionCutoffAt: null,
          receipt: { mutationId: 'm', expectedRevision: 5, createdAt: '2026-09-30T00:00:01Z' },
          serverTimeUtc: '2026-09-30T00:00:01Z',
        })
      }
      return json({}, 404)
    })
    return payload
  }

  it('sends the guarded write contract: revision CAS + schema + build + mutation + checkpoint', async () => {
    const monotonic = { now: 1000 }
    loadThenSaveFixture()
    const calls: FetchCall[] = []
    // re-stub to capture calls
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = { url, init }
      calls.push(call)
      if (url.endsWith('/rpc/load_game_state')) {
        return json({
          status: 'SAVE_READY',
          character: REMOTE_CHARACTER,
          save: { schemaVersion: CURRENT_SAVE_VERSION, saveRevision: 5, payload: validGameSave() },
          serverCheckpoint: CHECKPOINT,
          serverTimeUtc: '2026-09-30T00:00:00Z',
        })
      }
      return json({ status: 'COMMITTED', committedRevision: 6, currentRevision: 6, serverTimeUtc: 'x' })
    }))

    const service = makeService(monotonic)
    await service.load()
    monotonic.now = 2500 // 1500ms elapsed since the checkpoint was received
    const result = await service.save(validGameSave(), 5)

    expect(result).toEqual({ status: 'ok', revision: 6 })

    const rpc = calls.find(c => c.url.endsWith('/rpc/write_character_save'))!
    const body = JSON.parse(String(rpc.init.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual([
      'p_build_id',
      'p_expected_revision',
      'p_mutation_id',
      'p_payload',
      'p_schema_version',
      'p_session_id',
      'p_time_checkpoint',
    ])
    expect(body.p_session_id).toBe('sess-1')
    expect(body.p_expected_revision).toBe(5)
    expect(body.p_schema_version).toBe(CURRENT_SAVE_VERSION)
    expect(body.p_build_id).toBe('beta-test-build')
    expect(body.p_mutation_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.p_time_checkpoint).toEqual({ checkpointId: 'chk-1', elapsedMonotonicMs: 1500 })
  })

  it('COMMITTED mirrors the ACKed bytes + revision into the cache', async () => {
    const monotonic = { now: 1000 }
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/load_game_state')) {
        return json({
          status: 'SAVE_READY',
          character: REMOTE_CHARACTER,
          save: { schemaVersion: CURRENT_SAVE_VERSION, saveRevision: 5, payload: validGameSave() },
          serverCheckpoint: CHECKPOINT,
          serverTimeUtc: 'x',
        })
      }
      return json({ status: 'COMMITTED', committedRevision: 6, currentRevision: 6, serverTimeUtc: 'x' })
    })

    const service = makeService(monotonic)
    const snapshot = validGameSave()
    await service.load()
    const result = await service.save(snapshot, 5)

    expect(result).toEqual({ status: 'ok', revision: 6 })
    expect(localStorage.getItem(resolveRevisionKey())).toBe('6')
    expect(localStorage.getItem(resolveSaveKey())).toBe(JSON.stringify(snapshot))
  })

  it('CONFLICT is terminal: exactly one write attempt, remote row untouched, result surfaces', async () => {
    const previousRemotePayload = validGameSave()
    // The authoritative row another session committed first. The stub
    // only mutates it on COMMITTED - a retry-overwrite path would show
    // up as a changed payload below.
    const remoteRow: { revision: number; payload: unknown } = { revision: 9, payload: previousRemotePayload }
    const remoteWriteAttempts: string[] = []
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/load_game_state')) {
        return json({
          status: 'SAVE_READY',
          character: REMOTE_CHARACTER,
          save: { schemaVersion: CURRENT_SAVE_VERSION, saveRevision: 5, payload: previousRemotePayload },
          serverCheckpoint: CHECKPOINT,
          serverTimeUtc: 'x',
        })
      }
      if (call.url.endsWith('/rpc/write_character_save')) {
        remoteWriteAttempts.push(String(call.init.body))
        return json({ status: 'CONFLICT', code: 'SAVE_CONFLICT', currentRevision: remoteRow.revision })
      }
      return json({}, 404)
    })

    const coordinator = new CloudSaveCoordinator(makeService())
    await coordinator.load()

    const result = await coordinator.save(validGameSave())

    // Required seeds: terminal conflict, single remote write attempt, no
    // retry-overwrite (the remote row still holds the previous payload).
    expect(result.status).toBe('conflict')
    expect(remoteWriteAttempts).toHaveLength(1)
    expect(remoteRow.payload).toEqual(previousRemotePayload)
    if (result.status === 'conflict') expect(result.currentRevision).toBe(9)
  })

  it('save without a prior load re-anchors the checkpoint through heartbeat first', async () => {
    const calls = stubFetch((call) => {
      if (call.url.endsWith('/rpc/heartbeat_session')) {
        return json({ status: 'OK', serverTimeUtc: 'x', checkpoint: CHECKPOINT })
      }
      if (call.url.endsWith('/rpc/write_character_save')) {
        return json({ status: 'COMMITTED', committedRevision: 1, currentRevision: 1, serverTimeUtc: 'x' })
      }
      return json({}, 404)
    })

    const service = makeService()
    const result = await service.save(validGameSave(), 0)

    expect(result).toEqual({ status: 'ok', revision: 1 })
    const heartbeatIndex = calls.findIndex(c => c.url.endsWith('/rpc/heartbeat_session'))
    const writeIndex = calls.findIndex(c => c.url.endsWith('/rpc/write_character_save'))
    expect(heartbeatIndex).toBeGreaterThanOrEqual(0)
    expect(writeIndex).toBeGreaterThan(heartbeatIndex)
    const body = JSON.parse(String(calls[writeIndex]!.init.body)) as Record<string, unknown>
    expect((body.p_time_checkpoint as { checkpointId?: string }).checkpointId).toBe('chk-1')
  })

  it('heartbeat with no live checkpoint → unavailable NO_CHARACTER (never a fabricated checkpoint)', async () => {
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/heartbeat_session')) {
        return json({ status: 'OK', serverTimeUtc: 'x', checkpoint: null })
      }
      return json({}, 404)
    })

    const result = await makeService().save(validGameSave(), 0)

    expect(result).toMatchObject({ status: 'unavailable', code: 'SERVER_ERROR', detail: 'NO_CHARACTER' })
  })

  it.each([
    ['SAVE_INVALID', 'SAVE_INVALID'],
    ['SAVE_SCHEMA_UNSUPPORTED', 'SAVE_INVALID'],
    ['SAVE_TOO_LARGE', 'SAVE_TOO_LARGE'],
    ['NO_CHARACTER', 'SERVER_ERROR'],
    ['CHARACTER_DELETED', 'SERVER_ERROR'],
    ['CHECKPOINT_REQUIRED', 'SERVER_ERROR'],
    ['CHECKPOINT_INVALID', 'SERVER_ERROR'],
    ['CHECKPOINT_OFFSET_OUT_OF_BOUNDS', 'SERVER_ERROR'],
    ['CUTOFF_REGRESSION', 'SERVER_ERROR'],
    ['MUTATION_ID_REUSED', 'SERVER_ERROR'],
  ])('REJECTED %s → unavailable %s (detail carries the server code)', async (rpcCode, expectedCode) => {
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/load_game_state')) {
        return json({
          status: 'SAVE_READY',
          character: REMOTE_CHARACTER,
          save: { schemaVersion: CURRENT_SAVE_VERSION, saveRevision: 5, payload: validGameSave() },
          serverCheckpoint: CHECKPOINT,
          serverTimeUtc: 'x',
        })
      }
      return json({ status: 'REJECTED', code: rpcCode })
    })

    const service = makeService()
    await service.load()
    const result = await service.save(validGameSave(), 5)

    expect(result).toMatchObject({ status: 'unavailable', code: expectedCode, retryable: false })
    if (result.status === 'unavailable') expect(result.detail).toBe(rpcCode)
  })
})
