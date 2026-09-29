// Spec F8 - login-time newest-wins remote save reconciliation.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncRemoteSaveOnLogin } from './SupabaseRemoteSave'
import { storeSupabaseSession } from '../supabase/SupabaseSession'
import {
  resolveBackupKey,
  resolveImportHandoffKey,
  resolveRevisionKey,
  resolveSaveKey,
  resolveSyncBaseKey,
  setSaveAccountId,
} from '../save/saveKeys'
import { CURRENT_SAVE_VERSION, loadGame } from '../save/SaveSystem'
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
  // v82 mortal boundary contract: the fixture doubles as a legal
  // creation output - pick + learned entry + core grant.
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

describe('syncRemoteSaveOnLogin - newest-wins reconciliation (spec F8)', () => {
  it('guest session -> skipped, zero fetch calls', async () => {
    storeSupabaseSession({
      accessToken: 'g', refreshToken: 'rt', sessionId: 's1', mode: 'guest',
    })
    const calls = stubFetch(() => json([]))

    expect(await syncRemoteSaveOnLogin(config)).toBe('skipped')
    expect(calls).toHaveLength(0)

    vi.unstubAllGlobals()
  })

  it('no characters row -> skipped (no remote save can exist)', async () => {
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

  it('remote newer + usable -> pulled: local slot overwritten, revision set', async () => {
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

  it('remote behind local revision -> pushed via CAS PATCH guarded on the read revision', async () => {
    loginSession()
    const localSave = validGameSave(50_000_000)
    localStorage.setItem(resolveSaveKey(), JSON.stringify(localSave))
    localStorage.setItem(resolveRevisionKey(), '3')

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: validGameSave(1_000), save_revision: 2, updated_at: new Date(2_000).toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pushed')

    // INFRA-02 - the write is a PATCH guarded on the just-read revision,
    // not a blind merge-duplicates upsert.
    const patch = calls.find((call) => call.init.method === 'PATCH')
    expect(patch).toBeDefined()
    expect(patch?.url).toContain('/rest/v1/character_saves')
    expect(patch?.url).toContain('character_id=eq.char-1')
    expect(patch?.url).toContain('save_revision=eq.2')
    const headers = patch?.init.headers as Record<string, string>
    expect(headers.Prefer).toContain('return=representation')
    const body = JSON.parse(String(patch?.init.body)) as Record<string, unknown>
    expect(body.character_id).toBe('char-1')
    expect(body.user_id).toBe('u1')
    expect(body.schema_version).toBe(CURRENT_SAVE_VERSION)
    // Local counter is ahead -> the push keeps it, no adoption needed.
    expect(body.save_revision).toBe(3)
    expect(localStorage.getItem(resolveRevisionKey())).toBe('3')
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false)

    vi.unstubAllGlobals()
  })

  it('unusable remote with HIGHER revision -> CAS push at remote+1, adopted locally so sequences stay one lineage', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(50_000_000)))
    localStorage.setItem(resolveRevisionKey(), '3')

    const badRemote = validGameSave(60_000_000)
    badRemote.player = { ...badRemote.player, mortalBasicSkillId: undefined }

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: badRemote, save_revision: 9, updated_at: new Date().toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pushed')

    const patch = calls.find((call) => call.init.method === 'PATCH')
    expect(patch?.url).toContain('save_revision=eq.9')
    const body = JSON.parse(String(patch?.init.body)) as Record<string, unknown>
    // INFRA-01 - pushRevision never regresses below remote+1 even when
    // the local counter is behind (remote 9 -> pushed 10, adopted).
    expect(body.save_revision).toBe(10)
    expect(localStorage.getItem(resolveRevisionKey())).toBe('10')

    vi.unstubAllGlobals()
  })

  it('remote newer revision wins over a NEWER local timestamp — clock skew cannot resurrect stale saves (INFRA-01)', async () => {
    loginSession()
    // Local clock ran far ahead: lastSavedAt is bigger than remote's
    // updated_at, but remote carries the higher shared revision.
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(9_000_000_000)))
    localStorage.setItem(resolveRevisionKey(), '3')

    const remoteSave = validGameSave(1_000)
    remoteSave.player.name = 'remote-char'

    stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: remoteSave, save_revision: 5, updated_at: new Date(2_000).toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pulled')
    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? 'null') as GameSave
    expect(written.player.name).toBe('remote-char')
    expect(localStorage.getItem(resolveRevisionKey())).toBe('5')

    vi.unstubAllGlobals()
  })

  it('same revision + different content (fork, no base recorded) -> conflict: wall-clock must not pick a side (F-BX-31)', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(1_000)))
    localStorage.setItem(resolveRevisionKey(), '5')

    const remoteSave = validGameSave(5_000_000)
    remoteSave.player.name = 'remote-char'

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: remoteSave, save_revision: 5, updated_at: new Date(10_000_000).toISOString() }])
      }
      return json(null)
    })

    // Two independent devices each reached revision 5 with different
    // content - the counters offer no ordering, so neither a pull nor a
    // push may silently destroy one lineage.
    expect(await syncRemoteSaveOnLogin(config)).toBe('conflict')
    expect(calls.some((call) => call.init.method === 'PATCH')).toBe(false)
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false)
    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? 'null') as GameSave
    expect(written.player.name).not.toBe('remote-char')
    expect(localStorage.getItem(resolveRevisionKey())).toBe('5')

    vi.unstubAllGlobals()
  })

  it('pull writes the pre-pull local save to the backup slot first (F-BX-31)', async () => {
    loginSession()
    const priorLocal = validGameSave(1_000)
    priorLocal.player.name = 'local-char'
    localStorage.setItem(resolveSaveKey(), JSON.stringify(priorLocal))

    const remoteSave = validGameSave(5_000_000)
    remoteSave.player.name = 'remote-char'

    stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: remoteSave, save_revision: 7, updated_at: new Date(10_000_000).toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pulled')

    // Same safety net as deleteSave/importSaveRaw: the pulled bytes
    // overwrite the only copy of this device's unpushed progress.
    const backup = JSON.parse(localStorage.getItem(resolveBackupKey()) ?? 'null') as GameSave
    expect(backup.player.name).toBe('local-char')
    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? 'null') as GameSave
    expect(written.player.name).toBe('remote-char')

    vi.unstubAllGlobals()
  })

  it('first-push insert carries no merge-duplicates Prefer header; a PK conflict surfaces as unavailable (F-BX-33)', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(50_000_000)))
    localStorage.setItem(resolveRevisionKey(), '2')

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      // Read races with a concurrent first-push: the row is absent at
      // read time but exists by insert time -> Postgres 23505.
      if (call.init.method === 'POST') {
        return new Response('duplicate key value violates unique constraint', { status: 409 })
      }
      if (call.url.includes('/rest/v1/character_saves?')) return json([])
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('unavailable')

    const post = calls.find((call) => call.init.method === 'POST')
    expect(post).toBeDefined()
    const headers = (post?.init.headers ?? {}) as Record<string, string>
    expect(headers.Prefer ?? '').not.toContain('merge-duplicates')

    // Local slot and revision untouched - the next login re-reads the
    // winning row and converges.
    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? 'null') as GameSave
    expect(written.player.lastSavedAt).toBe(50_000_000)
    expect(localStorage.getItem(resolveRevisionKey())).toBe('2')

    vi.unstubAllGlobals()
  })

  it('CAS PATCH losing the race (0 rows updated) -> unavailable, local slot untouched (INFRA-02)', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(50_000_000)))
    localStorage.setItem(resolveRevisionKey(), '3')

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.init.method === 'PATCH') return json([]) // another session moved the revision first
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: validGameSave(1_000), save_revision: 2, updated_at: new Date(2_000).toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('unavailable')
    // Local slot and revision untouched - the next login re-compares.
    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? 'null') as GameSave
    expect(written.player.lastSavedAt).toBe(50_000_000)
    expect(localStorage.getItem(resolveRevisionKey())).toBe('3')
    expect(calls.some((call) => call.init.method === 'PATCH')).toBe(true)

    vi.unstubAllGlobals()
  })

  it('no remote row at all -> plain POST insert (first push)', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(50_000_000)))
    localStorage.setItem(resolveRevisionKey(), '2')

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) return json([])
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pushed')
    const post = calls.find((call) => call.init.method === 'POST')
    expect(post).toBeDefined()
    const body = JSON.parse(String(post?.init.body)) as Record<string, unknown>
    expect(body.save_revision).toBe(2)

    vi.unstubAllGlobals()
  })

  it('remote payload {} (the p_initial_save shape) counts as absent -> CAS push heals over the empty row', async () => {
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
    expect(calls.some((call) => call.init.method === 'PATCH')).toBe(true)

    vi.unstubAllGlobals()
  })

  it('remote payload failing the mortal boundary contract counts as absent -> push path heals', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(50_000_000)))

    // A v82-shaped remote payload missing the creation pick can only
    // be a stale pre-repair write. The remote gate applies the same
    // boundary contract as local restore, so the row counts as "no
    // remote" and the local truth is pushed up instead of pulled down.
    const badRemote = validGameSave(60_000_000)
    badRemote.player = { ...badRemote.player, mortalBasicSkillId: undefined }

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: badRemote, save_revision: 9, updated_at: new Date().toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pushed')
    expect(calls.some((call) => call.init.method === 'PATCH')).toBe(true)
    // Local slot untouched - the bad remote was never written down.
    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? '{}') as GameSave
    expect(written.player.lastSavedAt).toBe(50_000_000)

    vi.unstubAllGlobals()
  })

  it('fetch rejection -> unavailable, local slot untouched', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(1_000)))
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))

    expect(await syncRemoteSaveOnLogin(config)).toBe('unavailable')
    expect(localStorage.getItem(resolveSaveKey())).not.toBeNull()

    vi.unstubAllGlobals()
  })
})

describe('shared save acceptance gate (qa-authority-01 / F-INT-02 / F-INT-03)', () => {
  it('remote payload with an unknown material counts as absent -> push heals, never pulled', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(50_000_000)))

    // Registry-class poison, not boundary-class: shape passes, the
    // shared acceptance predicate is what rejects it. Without the gate
    // this row would be pulled, then boot would reject the local copy
    // with no remote-delete path to break the loop.
    const badRemote = validGameSave(60_000_000)
    badRemote.materials = [{ materialId: 'qa_no_such_material', amount: 1 }]

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: badRemote, save_revision: 9, updated_at: new Date().toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pushed')
    expect(calls.some((call) => call.init.method === 'PATCH')).toBe(true)

    vi.unstubAllGlobals()
  })

  it('remote payload with an unknown pill counts as absent -> push heals', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(50_000_000)))

    const badRemote = validGameSave(60_000_000)
    badRemote.pills = [{ pillId: 'qa_no_such_pill', amount: 1 }]

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: badRemote, save_revision: 9, updated_at: new Date().toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pushed')
    expect(calls.some((call) => call.init.method === 'PATCH')).toBe(true)

    vi.unstubAllGlobals()
  })

  it('contract-bad local + usable remote -> pulled: the pull heals the poisoned local slot', async () => {
    loginSession()

    // F-INT-02: a local payload the boot restore would reject must not
    // push its poison over a usable remote. Ungated, the newer local
    // timestamp would overwrite the only good copy.
    const badLocal = validGameSave(99_000_000)
    badLocal.player = { ...badLocal.player, mortalBasicSkillId: undefined }
    localStorage.setItem(resolveSaveKey(), JSON.stringify(badLocal))

    const goodRemote = validGameSave(1_000)
    goodRemote.player.name = 'remote-char'

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: goodRemote, save_revision: 4, updated_at: new Date(2_000).toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pulled')
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false)

    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? '{}') as GameSave
    expect(written.player.name).toBe('remote-char')
    expect(written.player.mortalBasicSkillId).toBe('tram')

    vi.unstubAllGlobals()
  })

  it('registry-bad local + usable remote -> pulled (non-boundary local poison heals too)', async () => {
    loginSession()

    const badLocal = validGameSave(99_000_000)
    badLocal.materials = [{ materialId: 'qa_no_such_material', amount: 1 }]
    localStorage.setItem(resolveSaveKey(), JSON.stringify(badLocal))

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: validGameSave(1_000), save_revision: 4, updated_at: new Date(2_000).toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pulled')
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false)

    vi.unstubAllGlobals()
  })

  it('bad local + no usable remote -> skipped, NOT pushed: poison never travels upward', async () => {
    loginSession()

    const badLocal = validGameSave(99_000_000)
    badLocal.player = { ...badLocal.player, mortalBasicSkillId: undefined }
    localStorage.setItem(resolveSaveKey(), JSON.stringify(badLocal))

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) return json([])
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('skipped')
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false)

    vi.unstubAllGlobals()
  })

  it('pull that normalized away legacy equipment reports the discard through the import-handoff channel (qa-authority-b-02)', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(1_000)))

    // A legacy entry (realmId/rarity markers) is tolerated by shape
    // validation and counted in discardedEquipmentCount - but it is NOT
    // part of normalizedSave, so the acceptance gate passes and the row
    // pulls cleanly.
    const remote = validGameSave(1_000) as GameSave & { equipment: unknown[] }
    remote.equipment.push({ realmId: 'pham', rarity: 'hiem', instanceId: 'i1', itemId: 'x', slot: 'weapon' })

    stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([{ payload: remote, save_revision: 7, updated_at: new Date(10_000_000).toISOString() }])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pulled')

    const stored = localStorage.getItem(resolveSaveKey())
    const marker = JSON.parse(localStorage.getItem(resolveImportHandoffKey()) ?? 'null') as {
      normalizedRaw: string
      discardedEquipmentCount: number
    } | null
    expect(marker?.normalizedRaw).toBe(stored)
    expect(marker?.discardedEquipmentCount).toBe(1)

    // One-shot consume: the owner load reports the count once, then the
    // marker is gone.
    const outcome = loadGame()
    expect(outcome.status).toBe('ok')
    if (outcome.status === 'ok') {
      expect(outcome.discardedEquipmentCount).toBe(1)
    }
    expect(localStorage.getItem(resolveImportHandoffKey())).toBeNull()

    vi.unstubAllGlobals()
  })
})

describe('F1 lineage divergence - sync-base tracking (carried defect)', () => {
  function remoteSaveRow(save: GameSave, revision: number, updatedMs: number) {
    return { payload: save, save_revision: revision, updated_at: new Date(updatedMs).toISOString() }
  }

  it('stale-side migration push (offline device, local rev ahead, remote clock-newer) -> conflict: remote untouched, local untouched', async () => {
    loginSession()
    // The carried F1 scenario, replayed on the stale device (B): 2 months
    // offline, local counter ran to 400 while the account's remote row
    // moved to 115 on device A. remoteAhead(115 > 400) is false, so the
    // old code PATCHed the stale lineage over A's work.
    const staleLocal = validGameSave(1_000)
    staleLocal.player.name = 'stale-device'
    localStorage.setItem(resolveSaveKey(), JSON.stringify(staleLocal))
    localStorage.setItem(resolveRevisionKey(), '400')

    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([remoteSaveRow(validGameSave(9_000_000), 115, 8_000_000)])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('conflict')
    expect(calls.some((call) => call.init.method === 'PATCH')).toBe(false)
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false)
    // Neither side was written: B keeps its lineage locally, A's remote
    // row is never regressed.
    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? 'null') as GameSave
    expect(written.player.name).toBe('stale-device')
    expect(localStorage.getItem(resolveRevisionKey())).toBe('400')

    vi.unstubAllGlobals()
  })

  it('diverged lineages (base set, remote moved, local advanced) -> conflict holds both sides', async () => {
    loginSession()
    // Device A replay: base=115 records the last shared point; A saved
    // locally to rev 130 while B's stale push already moved the remote
    // row to 400. Pulling would regress A's unpushed work; pushing would
    // regress B's row - neither may be picked silently.
    const localSave = validGameSave(50_000_000)
    localSave.player.name = 'device-a'
    localStorage.setItem(resolveSaveKey(), JSON.stringify(localSave))
    localStorage.setItem(resolveRevisionKey(), '130')
    localStorage.setItem(resolveSyncBaseKey(), '115')

    const remoteSave = validGameSave(9_000_000)
    remoteSave.player.name = 'device-b'
    const calls = stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([remoteSaveRow(remoteSave, 400, 10_000_000)])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('conflict')
    expect(calls.some((call) => call.init.method === 'PATCH')).toBe(false)
    expect(calls.some((call) => call.init.method === 'POST')).toBe(false)
    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? 'null') as GameSave
    expect(written.player.name).toBe('device-a')
    expect(localStorage.getItem(resolveRevisionKey())).toBe('130')
    expect(localStorage.getItem(resolveSyncBaseKey())).toBe('115')

    vi.unstubAllGlobals()
  })

  it('remote advanced past base while local stayed at base -> pulled, base adopted', async () => {
    loginSession()
    // The routine multi-device path: base=115, local still at 115 (no
    // unsynced work), A pushed rev 130 elsewhere - pulling loses nothing.
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(5_000)))
    localStorage.setItem(resolveRevisionKey(), '115')
    localStorage.setItem(resolveSyncBaseKey(), '115')

    const remoteSave = validGameSave(9_000_000)
    remoteSave.player.name = 'advanced-remote'
    stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([remoteSaveRow(remoteSave, 130, 10_000_000)])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pulled')
    expect(localStorage.getItem(resolveSyncBaseKey())).toBe('130')
    expect(localStorage.getItem(resolveRevisionKey())).toBe('130')
    const written = JSON.parse(localStorage.getItem(resolveSaveKey()) ?? 'null') as GameSave
    expect(written.player.name).toBe('advanced-remote')

    vi.unstubAllGlobals()
  })

  it('identical content under a base mismatch adopts the base instead of forking', async () => {
    loginSession()
    // Torn-adoption self-heal: save + base were written but the revision
    // write was lost, so the row and the bytes already agree.
    const shared = validGameSave(5_000)
    localStorage.setItem(resolveSaveKey(), JSON.stringify(shared))
    localStorage.setItem(resolveRevisionKey(), '115')
    localStorage.setItem(resolveSyncBaseKey(), '115')

    stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([remoteSaveRow(shared, 130, 10_000_000)])
      }
      return json(null)
    })

    // Same content, remote rev ahead -> the pull is idempotent and the
    // base lands at the real remote revision.
    expect(await syncRemoteSaveOnLogin(config)).toBe('pulled')
    expect(localStorage.getItem(resolveSyncBaseKey())).toBe('130')

    vi.unstubAllGlobals()
  })

  it('same-lineage push adopts the pushed revision as the new base', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(50_000_000)))
    localStorage.setItem(resolveRevisionKey(), '3')
    localStorage.setItem(resolveSyncBaseKey(), '2')

    stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([remoteSaveRow(validGameSave(1_000), 2, 2_000)])
      }
      return json(null)
    })

    expect(await syncRemoteSaveOnLogin(config)).toBe('pushed')
    expect(localStorage.getItem(resolveSyncBaseKey())).toBe('3')

    vi.unstubAllGlobals()
  })

  it('pull writes the save before the revision (F5 torn-state order)', async () => {
    loginSession()
    localStorage.setItem(resolveSaveKey(), JSON.stringify(validGameSave(1_000)))

    const remoteSave = validGameSave(5_000_000)
    remoteSave.player.name = 'remote-char'
    stubFetch((call) => {
      if (call.url.includes('/rest/v1/characters?')) return json([{ id: 'char-1' }])
      if (call.url.includes('/rest/v1/character_saves?')) {
        return json([remoteSaveRow(remoteSave, 7, 10_000_000)])
      }
      return json(null)
    })

    const writeOrder: string[] = []
    const originalSet = localStorage.setItem.bind(localStorage)
    localStorage.setItem = (key: string, value: string) => {
      writeOrder.push(key)
      originalSet(key, value)
    }

    expect(await syncRemoteSaveOnLogin(config)).toBe('pulled')
    expect(writeOrder.indexOf(resolveSaveKey())).toBeLessThan(
      writeOrder.indexOf(resolveRevisionKey()),
    )

    vi.unstubAllGlobals()
  })
})
