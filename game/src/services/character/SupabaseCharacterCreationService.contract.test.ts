// BETA-CREATION - client<->migration contract pin for create_character.
//
// The RPC is the ONLY server channel that persisted creation data. The v82
// contract is (p_session_id, p_roll_id, p_name, p_talent_ids,
// p_mortal_basic_skill_id, p_initial_save, p_schema_version) - no
// p_attributes channel may survive anywhere. A rename/drift on the client
// silently 404s or mis-binds server-side; this test pins the request shape
// against migration 202608240001_online_auth_character.sql.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseCharacterCreationService } from './SupabaseCharacterCreationService'
import { storeSupabaseSession } from '../supabase/SupabaseSession'
import { CURRENT_SAVE_VERSION } from '../save/SaveSystem'
import type { CharacterCreationDraft } from './CharacterCreationService'

const config = { url: 'https://example.supabase.co', anonKey: 'anon' }

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

function stubFetch(handler: (call: FetchCall) => Response): FetchCall[] {
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

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  storeSupabaseSession({
    accessToken: 'tok-u1',
    refreshToken: 'rt',
    sessionId: 's1',
    userId: 'u1',
    mode: 'login',
    expiresAtMs: Date.now() + 3_600_000,
  })
})

describe('SupabaseCharacterCreationService - create_character RPC contract (v82)', () => {
  const draft: CharacterCreationDraft = {
    name: 'Lạc Vân',
    talentIds: ['talent-a'],
    mortalBasicSkillId: 'huy_quyen',
  }

  it('sends exactly the migration signature - pick included, no p_attributes channel', async () => {
    const calls = stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'talent-a' }] })
      }
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) return json('char-1')
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)
    expect(result).toEqual({ ok: true, characterId: 'char-1' })

    const rpc = calls.find(c => c.url.endsWith('/rpc/create_character'))!
    const body = JSON.parse(String(rpc.init.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual([
      'p_initial_save',
      'p_mortal_basic_skill_id',
      'p_name',
      'p_roll_id',
      'p_schema_version',
      'p_session_id',
      'p_talent_ids',
    ])
    expect(body).not.toHaveProperty('p_attributes')
    expect(body.p_mortal_basic_skill_id).toBe('huy_quyen')
    expect(body.p_schema_version).toBe(CURRENT_SAVE_VERSION)
    expect(body.p_talent_ids).toEqual(['talent-a'])
  })

  it('keeps the roll consumable only after a successful create (rollId cleared)', async () => {
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'talent-a' }] })
      }
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) return json('char-1')
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    await service.createCharacter(draft)
    const second = await service.createCharacter(draft)
    expect(second.ok).toBe(false)
  })

  // F-BX-72 - PostgREST raise exception payloads arrive as HTTP 400
  // {code, message}; each authored domain message maps onto an existing
  // UI-facing error code instead of collapsing to server_unavailable.
  it.each<[string, string]>([
    ['character name unavailable', 'name_taken'],
    ['invalid talent roll', 'invalid_talents'],
    ['invalid talent selection', 'invalid_talents'],
    ['not enough enabled talents', 'invalid_talents'],
    ['invalid mortal basic skill', 'invalid_skill'],
    ['session revoked', 'session_revoked'],
    ['authentication required', 'session_revoked'],
  ])('F-BX-72: 400 domain message "%s" maps to code "%s"', async (serverMessage, expectedCode) => {
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'talent-a' }] })
      }
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) {
        return json({ code: 'P0001', message: serverMessage }, 400)
      }
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)
    expect(result).toEqual({ ok: false, code: expectedCode, message: expect.any(String) })
  })

  it('F-BX-72: a 400 without a known domain message stays server_unavailable', async () => {
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'talent-a' }] })
      }
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) {
        return json({ code: 'P0001', message: 'some unforeseen rejection' }, 400)
      }
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)
    expect(result).toEqual({ ok: false, code: 'server_unavailable', message: expect.any(String) })
  })
})

describe('F-BX-25 - ambiguous create failure adopts the committed character', () => {
  const draft: CharacterCreationDraft = {
    name: 'Lạc Vân',
    talentIds: ['talent-a'],
    mortalBasicSkillId: 'huy_quyen',
  }

  function stubCreationFlow(handler: (call: FetchCall) => Response): FetchCall[] {
    return stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'talent-a' }] })
      }
      return handler(call)
    })
  }

  it('409 conflict + account row exists -> adopt it (ok), no name burn', async () => {
    // The RPC committed (or an earlier attempt did): user_id is UNIQUE,
    // so the existing row IS this account's character.
    stubCreationFlow((call) => {
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) return json({ message: 'duplicate key' }, 409)
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-committed' }])
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)
    expect(result).toEqual({ ok: true, characterId: 'char-committed' })

    // The roll was consumed by the committed create - cleared locally too.
    const second = await service.createCharacter(draft)
    expect(second.ok).toBe(false)
  })

  it('409 conflict + NO account row -> name_taken (mapping preserved)', async () => {
    stubCreationFlow((call) => {
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) return json({ message: 'duplicate key' }, 409)
      if (call.url.includes('/rest/v1/characters?')) return json([])
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)
    expect(result).toEqual({ ok: false, code: 'name_taken', message: expect.any(String) })
  })

  it('advisory check says taken + OWN row exists -> adopt (crash-retry: the name is held by our own character)', async () => {
    stubCreationFlow((call) => {
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(false)
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-committed' }])
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)
    expect(result).toEqual({ ok: true, characterId: 'char-committed' })
  })

  it('advisory check says taken + no row -> name_taken (genuine collision)', async () => {
    stubCreationFlow((call) => {
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(false)
      if (call.url.includes('/rest/v1/characters?')) return json([])
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)
    expect(result).toEqual({ ok: false, code: 'name_taken', message: expect.any(String) })
  })

  it('transport failure with a committed row behind it -> adopt, not server_unavailable', async () => {
    stubCreationFlow((call) => {
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) return json({ message: 'lost' }, 500)
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-committed' }])
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)
    expect(result).toEqual({ ok: true, characterId: 'char-committed' })
  })
})
