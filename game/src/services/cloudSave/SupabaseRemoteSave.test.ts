// Spec F8 — login-time newest-wins remote save reconciliation.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncRemoteSaveOnLogin } from './SupabaseRemoteSave'
import { storeSupabaseSession } from '../supabase/SupabaseSession'
import {
  resolveRevisionKey,
  resolveSaveKey,
  setSaveAccountId,
} from '../save/saveKeys'
import { CURRENT_SAVE_VERSION } from '../save/SaveSystem'
import { createDefaultPlayer } from '../../core/player/Player'
import type { GameSave } from '../save/saveTypes'

const config = { url: 'https://example.supabase.co', anonKey: 'anon' }

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear(): void { this.store.clear() }
  getItem(key: string): string | null { return this.store.get(key) ?? null }
  setItem(key: string, value: string): void { this.store.set(key, value) }
  removeItem(key: string): void { this.store.delete(key) }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
}

function validGameSave(lastSavedAt: number): GameSave {
  const player = createDefaultPlayer()
  player.lastSavedAt = lastSavedAt
  return {
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

function loginSession() {
  storeSupabaseSession({
    accessToken: 'tok-u1',
    refreshToken: 'rt',
    sessionId: 's1',
    userId: 'u1',
    mode: 'login',
    expiresAtMs: Date.now() + 3_600_000,
  })
  setSaveAccountId('u1')
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  setSaveAccountId(null)
})

describe('syncRemoteSaveOnLogin — newest-wins reconciliation (spec F8)', () => {
  it('guest session → skipped, zero fetch calls', async () => {
    storeSupabaseSession({
      accessToken: 'g', refreshToken: 'rt', sessionId: 's1', mode: 'guest',
    })
    const calls = stubFetch(() => json([]))

    expect(await syncRemoteSaveOnLogin(config)).toBe('skipped')
    expect(calls).toHaveLength(0)

    vi.unstubAllGlobals()
  })

  it('no characters row → skipped (no remote save can exist)', async () => {
    loginSession()
    const calls = stubFetch(() => json([]))

    expect(await syncRemoteSaveOnLogin(config)).toBe('skipped')
    expect(calls).toHaveLength(1)

    vi.unstubAllGlobals()
  })

  it('every authenticated call carries Bearer <accessToken>, never the anon key (RLS regression guard)', async () => {
    loginSession()
    const calls = stubFetch(() => json([]))

    await syncRemoteSaveOnLogin(config)

    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer tok-u1')
    }

    vi.unstubAllGlobals()
  })

  it('remote newer + usable → pulled: local slot overwritten, revision set', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(1_000)))
    const remoteSave = validGameSave(5_000_000)
    remoteSave.player.name = 'remote-char'
    const remoteUpdatedAt = new Date(10_000_000).toISOString()

    stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: remoteSave, save_revision: 7, updated_at: remoteUpdatedAt }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pulled')

    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? 'null') as GameSave
    expect(written.player.name).toBe('remote-char')
    expect(localStorage.getItem(resolveRevisionKey())).toBe('7')

    vi.unstubAllGlobals()
  })

  it('remote older → pushed: POST merge-duplicates with explicit updated_at', async () => {
    loginSession()
    const localSave = validGameSave(50_000_000)
    localStorage.setItem(resolveSaveKey(), JSON.stringify(localSave))
    localStorage.setItem(resolveRevisionKey(), '3')

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: validGameSave(1_000), save_revision: 7, updated_at: new Date(2_000).toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pushed')

    const post = calls.find((call) => call.init.method === 'POST')
    expect(post).toBeDefined()
    expect(post?.url).toContain('/rest/v1/character_saves')
    const headers = post?.init.headers as Record<string, string>
    expect(headers.Prefer).toContain('merge-duplicates')
    const body = JSON.parse(String(post?.init.body)) as Record<string, unknown>
    expect(body.character_id).toBe('char-1')
    expect(body.user_id).toBe('u1')
    expect(body.schema_version).toBe(CURRENT_SAVE_VERSION)
    expect(body.save_revision).toBe(3)
    expect(typeof body.updated_at).toBe('string')

    vi.unstubAllGlobals()
  })

  it('remote payload {} (the p_initial_save shape) counts as absent → push when local ok', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(50_000_000)))

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: {}, save_revision: 1, updated_at: new Date().toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pushed')
    expect(calls.some((call) => call.init.method === 'POST')).toBe(true)

    vi.unstubAllGlobals()
  })

  it('fetch rejection → unavailable, local slot untouched', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(1_000)))
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))

    expect(await syncRemoteSaveOnLogin(config)).toBe('unavailable')
    expect(localStorage.getItem(resolveSaveKey())).not.toBeNull()

    vi.unstubAllGlobals()
  })
})
