import { beforeEach, describe, expect, it } from 'vitest'
import {
  GuestCredentialStore,
  registerGuestCredentialIpc,
  type GuestCredentialIpcMain,
  type GuestCredentialRecord,
  type GuestCredentialStoreDeps,
} from './GuestCredentialStore'

const PATH = '/app-data/guest-credential.bin'

/** Reversible stand-in for safeStorage: XOR-transformed bytes with a
 *  marker - enough to prove the encrypt boundary is exercised (no raw
 *  UTF-8 payload on disk) and that undecryptable bytes are corruption. */
function reversibleEncrypt(plaintext: string): Uint8Array {
  const bytes = new TextEncoder().encode(plaintext)
  const out = new Uint8Array(bytes.length + 1)
  out[0] = 0x45 // 'E' marker
  for (let i = 0; i < bytes.length; i++) out[i + 1] = bytes[i]! ^ 0x5a
  return out
}
function reversibleDecrypt(ciphertext: Uint8Array): string {
  if (ciphertext[0] !== 0x45) throw new Error('cannot decrypt')
  const out = new Uint8Array(ciphertext.length - 1)
  for (let i = 1; i < ciphertext.length; i++) out[i - 1] = ciphertext[i]! ^ 0x5a
  return new TextDecoder().decode(out)
}

function enoent(): Error {
  const error = new Error('missing') as Error & { code?: string }
  error.code = 'ENOENT'
  return error
}

interface Fixture {
  deps: GuestCredentialStoreDeps
  store: GuestCredentialStore
  files: Map<string, Uint8Array>
  writes: string[]
  renames: Array<[string, string]>
  setEncryptable(value: boolean): void
}

function fixture(encryptable = true): Fixture {
  const files = new Map<string, Uint8Array>()
  const writes: string[] = []
  const renames: Array<[string, string]> = []
  let canEncrypt = encryptable

  const deps: GuestCredentialStoreDeps = {
    credentialPath: PATH,
    canEncrypt: () => canEncrypt,
    encrypt: reversibleEncrypt,
    decrypt: reversibleDecrypt,
    async readFile(path) {
      const data = files.get(path)
      if (data === undefined) throw enoent()
      return data
    },
    async writeFile(path, data) {
      writes.push(path)
      files.set(path, data)
    },
    async renameFile(from, to) {
      renames.push([from, to])
      const data = files.get(from)
      if (data !== undefined) {
        files.delete(from)
        files.set(to, data)
      }
    },
    async removeFile(path) {
      if (!files.delete(path)) throw enoent()
    },
  }

  return {
    deps,
    store: new GuestCredentialStore(deps),
    files,
    writes,
    renames,
    setEncryptable: v => {
      canEncrypt = v
    },
  }
}

const RECORD: GuestCredentialRecord = {
  refreshToken: 'rt-abc',
  sessionId: 'sess-1',
  userId: 'user-1',
}

let fx: Fixture
beforeEach(() => {
  fx = fixture()
})

describe('GuestCredentialStore - encrypted durable record', () => {
  it('saves through the encryption boundary via tmp+rename (never plaintext)', async () => {
    const result = await fx.store.save(RECORD)

    expect(result).toEqual({ ok: true, value: null })
    // tmp first, then atomic rename - a torn write can never leave a
    // truncated credential at the real path.
    expect(fx.writes).toEqual([`${PATH}.tmp`])
    expect(fx.renames).toEqual([[`${PATH}.tmp`, PATH]])
    const onDisk = fx.files.get(PATH)!
    expect(onDisk).toBeDefined()
    // The encrypt boundary owns the bytes: no raw field survives to disk.
    expect(new TextDecoder().decode(onDisk)).not.toContain('rt-abc')
    expect(reversibleDecrypt(onDisk)).toContain('rt-abc')
  })

  it('round-trips a record through save then load', async () => {
    await fx.store.save({ ...RECORD, pendingUpgradeLoginId: 'dao_huu' })
    const result = await fx.store.load()

    expect(result).toEqual({
      ok: true,
      value: { ...RECORD, pendingUpgradeLoginId: 'dao_huu' },
    })
  })

  it('load on a missing file returns null - absence is not corruption', async () => {
    expect(await fx.store.load()).toEqual({ ok: true, value: null })
  })

  it('clear removes the record and is idempotent', async () => {
    await fx.store.save(RECORD)
    expect(await fx.store.clear()).toEqual({ ok: true, value: null })
    expect(await fx.store.load()).toEqual({ ok: true, value: null })
    // Second clear on a missing file still succeeds - signout semantics
    // must not depend on whether a record existed.
    expect(await fx.store.clear()).toEqual({ ok: true, value: null })
  })
})

describe('GuestCredentialStore - recovery errors (never plaintext fallback)', () => {
  it('safeStorage unavailable -> typed unavailable on load and save', async () => {
    fx.setEncryptable(false)

    expect(await fx.store.load()).toEqual({ ok: false, code: 'unavailable' })
    expect(await fx.store.save(RECORD)).toEqual({ ok: false, code: 'unavailable' })
    // No file was ever attempted - nothing exists to fall back to.
    expect(fx.files.size).toBe(0)
  })

  it('undecryptable bytes -> corrupted', async () => {
    fx.files.set(PATH, new TextEncoder().encode('garbage'))
    expect(await fx.store.load()).toEqual({ ok: false, code: 'corrupted' })
  })

  it('decryptable but malformed payload -> corrupted', async () => {
    fx.files.set(PATH, reversibleEncrypt('{"v":1,"refreshToken":""}'))
    expect(await fx.store.load()).toEqual({ ok: false, code: 'corrupted' })
  })

  it('decryptable non-JSON payload -> corrupted', async () => {
    fx.files.set(PATH, reversibleEncrypt('not json'))
    expect(await fx.store.load()).toEqual({ ok: false, code: 'corrupted' })
  })

  it('a future format version -> corrupted (no silent downgrade)', async () => {
    fx.files.set(PATH, reversibleEncrypt(JSON.stringify({ v: 99, refreshToken: 'rt', sessionId: 's' })))
    expect(await fx.store.load()).toEqual({ ok: false, code: 'corrupted' })
  })

  it('save rejects malformed records as invalid', async () => {
    expect(await fx.store.save({ refreshToken: '', sessionId: 's' })).toEqual({
      ok: false,
      code: 'invalid',
    })
    expect(await fx.store.save(null as unknown as GuestCredentialRecord)).toEqual({
      ok: false,
      code: 'invalid',
    })
    expect(fx.files.size).toBe(0)
  })
})

describe('registerGuestCredentialIpc - the three-channel allowlist', () => {
  it('registers exactly load/save/clear and forwards payloads', async () => {
    const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
    const ipc: GuestCredentialIpcMain = {
      handle: (channel, listener) => handlers.set(channel, listener),
    }
    registerGuestCredentialIpc(fx.store, ipc)

    expect([...handlers.keys()].sort()).toEqual([
      'guest-credential:clear',
      'guest-credential:load',
      'guest-credential:save',
    ])

    expect(await handlers.get('guest-credential:load')!({}, )).toEqual({ ok: true, value: null })
    expect(await handlers.get('guest-credential:save')!({}, RECORD)).toEqual({ ok: true, value: null })
    expect(await handlers.get('guest-credential:clear')!({})).toEqual({ ok: true, value: null })
  })
})
