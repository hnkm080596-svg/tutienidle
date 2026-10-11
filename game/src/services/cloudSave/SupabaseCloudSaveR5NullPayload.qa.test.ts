// QA R5 attack repro (blind wave 5) - FINDING R5-SAVE-1 (MEDIUM), cloud leg.
//
// Attack vector: e6d8796a unified version-acceptance by calling
// migrateSaveToCurrentVersion (saveVersion.ts:305-316) on the RAW parsed
// payload. The function dereferences `save.version` on its input with no
// object guard:
//
//   let save = parsed
//   if (save.version === 88) { ... }      // null/undefined -> TypeError
//
// Two of the four gates feed it unguarded:
//   - SAVE_READY: SupabaseCloudSaveService.ts:755-757
//     `migrateSaveToCurrentVersion(save.payload as Record<string, unknown>)`
//     where response.save.payload is typed `payload?: unknown` - a row
//     with `payload: null` or NO payload key is exactly the contract
//     drift this version gate exists to classify ("a payload the server
//     committed but this build cannot consume is contract drift,
//     surfaced as incompatible/corrupted", comment at :741-745).
//   - adoptCommittedPending: SupabaseCloudSaveService.ts:441 - a journal
//     record whose rawPayload parses to `null` (crafted record only -
//     honest producers serialize a GameSave; lower reachability, same
//     root cause).
//
// The other two gates ARE guarded (inspectLocalSave early-returns on
// `typeof foundVersion !== 'number'`; validateRecoveryData requires an
// object with 'version'+'player'), so the crash is confined to the cloud
// legs this commit rewrote.
//
// Honest flow that breaks: any SAVE_READY response whose payload is
// null/absent (contract drift: foreign writer, partial server write,
// server-side schema change). Old gate:
// `foundVersion !== CURRENT_SAVE_VERSION` -> foundVersion undefined ->
// { status:'incompatible', foundVersion: undefined } - the recovery
// surface mounted with Export/Reset. New gate: TypeError propagates
// through load() -> CloudSaveCoordinator.load() -> bootGame() - whose
// body try has NO catch (useAppLifecycle.ts:396-849, finally only) -
// so the rejection escapes as an unhandled promise rejection and the
// app sits on the loading screen forever; boot.fail()/the recovery
// surface never run (the file's own comment at :699-701 documents the
// caller has no catch).
//
// Repro: stub fetch returns a well-formed SAVE_READY envelope carrying
// schemaVersion + saveRevision with payload:null (drift shape the gate
// classifies). load() must resolve to a typed result ('incompatible'),
// never throw. Currently rejects with TypeError -> FAIL on current HEAD.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseCloudSaveService } from './SupabaseCloudSaveService'
import { migrateSaveToCurrentVersion } from '../save/saveVersion'
import { setSaveAccountId } from '../save/saveKeys'
import { CURRENT_SAVE_VERSION } from '../save/SaveSystem'
import type { ClientBuildInfo } from '../backend/ClientBuildInfo'

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

function saveReadyWithPayload(payload: unknown): Response {
  return json({
    status: 'SAVE_READY',
    character: REMOTE_CHARACTER,
    save: {
      schemaVersion: CURRENT_SAVE_VERSION,
      saveRevision: 5,
      ...(payload === undefined ? {} : { payload }),
      updatedAt: '2026-09-30T00:00:00Z',
    },
    serverCheckpoint: CHECKPOINT,
    serverTimeUtc: '2026-09-30T00:00:00Z',
  })
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  setSaveAccountId('u1')
})

describe('R5-SAVE-1 - version gate must classify drift payloads, never throw', () => {
  it('migrateSaveToCurrentVersion returns null for non-object input instead of throwing', () => {
    // Leaf contract: "or null when this build cannot consume that
    // version". null/undefined input cannot be consumed -> null, not a
    // TypeError on `save.version`.
    expect(migrateSaveToCurrentVersion(null as unknown as Record<string, unknown>)).toBeNull()
    expect(migrateSaveToCurrentVersion(undefined as unknown as Record<string, unknown>)).toBeNull()
    // Boxing-safe primitives already return null today - pinned so a
    // fix cannot regress them into a crash either.
    expect(migrateSaveToCurrentVersion(42 as unknown as Record<string, unknown>)).toBeNull()
    expect(migrateSaveToCurrentVersion('x' as unknown as Record<string, unknown>)).toBeNull()
    expect(migrateSaveToCurrentVersion([] as unknown as Record<string, unknown>)).toBeNull()
  })

  it('SAVE_READY with payload:null resolves a typed result (currently throws TypeError)', async () => {
    stubFetch(() => saveReadyWithPayload(null))
    // Contract drift the version gate exists to classify - old code
    // returned { status:'incompatible', foundVersion: undefined }.
    const result = await makeService().load()
    expect(result.status).toBe('incompatible')
    if (result.status === 'incompatible') {
      expect(result.foundVersion).toBeUndefined()
    }
  })

  it('SAVE_READY with the payload key absent resolves a typed result (currently throws TypeError)', async () => {
    stubFetch(() => saveReadyWithPayload(undefined))
    const result = await makeService().load()
    expect(result.status).toBe('incompatible')
  })
})
