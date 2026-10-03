// BETA-FINAL B1.4 - client<->migration contract pin for create_character.
//
// The RPC is the ONLY server channel that provisions the character row.
// The PR2 contract is metadata-only (p_session_id, p_roll_id, p_name,
// p_talent_ids, p_mortal_basic_skill_id) - NO p_initial_save and NO
// p_schema_version channel may survive anywhere: the save row is written
// exclusively through write_character_save after the client rebuilds the
// starter snapshot. The response is {status:CREATED, character:{...}}
// and the canonical character block doubles as the reconstruction input
// when the first save never lands (CHARACTER_UNINITIALIZED).
// Pinned against supabase/migrations/202609300001_beta_authority_prepare.sql.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseCharacterCreationService } from './SupabaseCharacterCreationService'
import { storeSupabaseSession } from '../supabase/SupabaseSession'
import type { CharacterCreationDraft } from './CharacterCreationService'

const config = { url: 'https://example.supabase.co', anonKey: 'anon' }

const CREATED_CHARACTER = {
  id: 'char-1',
  name: 'Lạc Vân',
  selectedTalentIds: ['hap_linh'],
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

describe('SupabaseCharacterCreationService - create_character RPC contract (B1.4 metadata-only)', () => {
  // BETA SCOPE LOCK v2: the draft is name + talent only; the talent
  // id must be beta-admitted (the roll's own entries pass the
  // same gate).
  const draft: CharacterCreationDraft = {
    name: 'Lạc Vân',
    talentIds: ['hap_linh'],
  }

  it('sends exactly the migration signature - no p_initial_save / p_schema_version channel', async () => {
    const calls = stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'hap_linh' }] })
      }
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) {
        return json({ status: 'CREATED', character: CREATED_CHARACTER, serverTimeUtc: '2026-09-30T00:00:01Z' })
      }
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)
    expect(result.ok).toBe(true)

    const rpc = calls.find(c => c.url.endsWith('/rpc/create_character'))!
    const body = JSON.parse(String(rpc.init.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual([
      'p_mortal_basic_skill_id',
      'p_name',
      'p_roll_id',
      'p_session_id',
      'p_talent_ids',
    ])
    expect(body).not.toHaveProperty('p_initial_save')
    expect(body).not.toHaveProperty('p_schema_version')
    expect(body).not.toHaveProperty('p_attributes')
    expect(body.p_mortal_basic_skill_id).toBe('linh_bao')
    expect(body.p_talent_ids).toEqual(['hap_linh'])
    expect(body.p_roll_id).toBe('roll-1')
    expect(body.p_session_id).toBe('s1')
  })

  it('CREATED returns the canonical character metadata (reconstruction input)', async () => {
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'hap_linh' }] })
      }
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) {
        return json({ status: 'CREATED', character: CREATED_CHARACTER, serverTimeUtc: '2026-09-30T00:00:01Z' })
      }
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)

    expect(result).toEqual({ ok: true, characterId: 'char-1', character: CREATED_CHARACTER })
  })

  it('REJECTED maps to typed codes (CHARACTER_EXISTS / name / talents / mortal skill)', async () => {
    const cases: Array<[string, string]> = [
      ['CHARACTER_EXISTS', 'character_exists'],
      ['CHARACTER_NAME_UNAVAILABLE', 'name_taken'],
      ['INVALID_TALENT_ROLL', 'invalid_talents'],
      ['INVALID_TALENT_SELECTION', 'invalid_talents'],
      ['INVALID_MORTAL_SKILL', 'invalid_skill'],
      ['MAINTENANCE_MODE', 'server_unavailable'],
    ]

    for (const [rpcCode, expectedCode] of cases) {
      stubFetch((call) => {
        if (call.url.endsWith('/rpc/create_talent_roll')) {
          return json({ rollId: 'roll-1', talents: [{ id: 'hap_linh' }] })
        }
        if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
        if (call.url.endsWith('/rpc/create_character')) {
          return json({ status: 'REJECTED', code: rpcCode })
        }
        return json({}, 404)
      })

      const service = new SupabaseCharacterCreationService(config)
      await service.rollTalents()
      const result = await service.createCharacter(draft)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe(expectedCode)
    }
  })

  it('a malformed CREATED payload is rejected client-side (no silent half-creation)', async () => {
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'hap_linh' }] })
      }
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) {
        return json({ status: 'CREATED', character: { id: 'char-1' } })
      }
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const result = await service.createCharacter(draft)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('server_unavailable')
  })

  it('keeps the roll consumable only after a successful create (rollId cleared)', async () => {
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'hap_linh' }] })
      }
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) {
        return json({ status: 'CREATED', character: CREATED_CHARACTER })
      }
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    await service.createCharacter(draft)
    const second = await service.createCharacter(draft)
    expect(second.ok).toBe(false)
  })

  it('a REJECTED create keeps the roll alive for retry', async () => {
    let createCalls = 0
    stubFetch((call) => {
      if (call.url.endsWith('/rpc/create_talent_roll')) {
        return json({ rollId: 'roll-1', talents: [{ id: 'hap_linh' }] })
      }
      if (call.url.endsWith('/rpc/is_character_name_available')) return json(true)
      if (call.url.endsWith('/rpc/create_character')) {
        createCalls += 1
        return createCalls === 1
          ? json({ status: 'REJECTED', code: 'CHARACTER_NAME_UNAVAILABLE' })
          : json({ status: 'CREATED', character: CREATED_CHARACTER })
      }
      return json({}, 404)
    })

    const service = new SupabaseCharacterCreationService(config)
    await service.rollTalents()
    const first = await service.createCharacter({ ...draft, name: 'Taken' })
    expect(first.ok).toBe(false)
    const second = await service.createCharacter(draft)
    expect(second.ok).toBe(true)
  })
})
