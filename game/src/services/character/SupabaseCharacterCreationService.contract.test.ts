// BETA-CREATION — client↔migration contract pin for create_character.
//
// The RPC is the ONLY server channel that persisted creation data. The v82
// contract is (p_session_id, p_roll_id, p_name, p_talent_ids,
// p_mortal_basic_skill_id, p_initial_save, p_schema_version) — no
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

describe('SupabaseCharacterCreationService — create_character RPC contract (v82)', () => {
  const draft: CharacterCreationDraft = {
    name: 'Lạc Vân',
    talentIds: ['talent-a'],
    mortalBasicSkillId: 'huy_quyen',
  }

  it('sends exactly the migration signature — pick included, no p_attributes channel', async () => {
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
})
