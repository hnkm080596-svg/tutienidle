/**
 * B1.8 durable guest identity - the main-owned, OS-protected credential
 * store. Every byte crosses safeStorage before touching the fixed
 * app-data path; the file holds an encrypted blob and nothing else.
 * The renderer reaches it ONLY through the three allowlisted IPC channels
 * registered below - it gets operations and the session record, never
 * filesystem access or key material.
 *
 * Failure law: safeStorage unavailable, or a record that cannot decrypt
 * or parse, is a typed RECOVERY ERROR - never a plaintext fallback and
 * never an implicit new anonymous signup. The renderer decides how to
 * surface recovery; this store only reports.
 */

export interface GuestCredentialRecord {
  refreshToken: string
  sessionId: string
  userId?: string
  pendingUpgradeLoginId?: string
}

export type GuestCredentialResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'unavailable' | 'corrupted' | 'invalid' }

/** Everything OS/Electron-specific arrives injected so the store's
 *  semantics are unit-testable outside Electron (same convention as
 *  quitFlush.ts and combatClockHost.ts in this directory). */
export interface GuestCredentialStoreDeps {
  /** Fixed app-data path owned by the embedding app. */
  readonly credentialPath: string
  canEncrypt(): boolean
  encrypt(plaintext: string): Uint8Array
  decrypt(ciphertext: Uint8Array): string
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, data: Uint8Array): Promise<void>
  renameFile(from: string, to: string): Promise<void>
  removeFile(path: string): Promise<void>
}

/** Minimal ipcMain.handle surface - the three channels below are the
 *  complete allowlist. */
export interface GuestCredentialIpcMain {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
}

const FORMAT_VERSION = 1
// Refresh credentials are small; a renderer-supplied record or a file
// beyond these bounds is malformed input, not something to persist.
const MAX_FIELD_LENGTH = 16_384
const MAX_FILE_BYTES = 64 * 1024

interface OnDiskEnvelope {
  v?: unknown
  refreshToken?: unknown
  sessionId?: unknown
  userId?: unknown
  pendingUpgradeLoginId?: unknown
}

function isOptionalShortString(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && value.length > 0 && value.length <= MAX_FIELD_LENGTH)
}

function validateRecord(record: unknown): GuestCredentialRecord | null {
  if (typeof record !== 'object' || record === null) return null
  const candidate = record as OnDiskEnvelope
  if (
    typeof candidate.refreshToken !== 'string' ||
    candidate.refreshToken.length === 0 ||
    candidate.refreshToken.length > MAX_FIELD_LENGTH ||
    typeof candidate.sessionId !== 'string' ||
    candidate.sessionId.length === 0 ||
    candidate.sessionId.length > MAX_FIELD_LENGTH ||
    !isOptionalShortString(candidate.userId) ||
    !isOptionalShortString(candidate.pendingUpgradeLoginId)
  ) {
    return null
  }
  return {
    refreshToken: candidate.refreshToken,
    sessionId: candidate.sessionId,
    userId: candidate.userId as string | undefined,
    pendingUpgradeLoginId: candidate.pendingUpgradeLoginId as string | undefined,
  }
}

export class GuestCredentialStore {
  constructor(private readonly deps: GuestCredentialStoreDeps) {}

  private get tmpPath(): string {
    return `${this.deps.credentialPath}.tmp`
  }

  async load(): Promise<GuestCredentialResult<GuestCredentialRecord | null>> {
    if (!this.deps.canEncrypt()) {
      return { ok: false, code: 'unavailable' }
    }

    let ciphertext: Uint8Array
    try {
      ciphertext = await this.deps.readFile(this.deps.credentialPath)
    } catch (error) {
      // Absence is not corruption: a missing file means no durable guest.
      return (error as { code?: string } | null)?.code === 'ENOENT'
        ? { ok: true, value: null }
        : { ok: false, code: 'corrupted' }
    }

    if (ciphertext.byteLength === 0 || ciphertext.byteLength > MAX_FILE_BYTES) {
      return { ok: false, code: 'corrupted' }
    }

    let plaintext: string
    try {
      plaintext = this.deps.decrypt(ciphertext)
    } catch {
      return { ok: false, code: 'corrupted' }
    }

    let envelope: OnDiskEnvelope
    try {
      envelope = JSON.parse(plaintext) as OnDiskEnvelope
    } catch {
      return { ok: false, code: 'corrupted' }
    }

    if (envelope.v !== FORMAT_VERSION) {
      return { ok: false, code: 'corrupted' }
    }

    const record = validateRecord(envelope)
    return record ? { ok: true, value: record } : { ok: false, code: 'corrupted' }
  }

  async save(record: GuestCredentialRecord): Promise<GuestCredentialResult<null>> {
    if (!this.deps.canEncrypt()) {
      return { ok: false, code: 'unavailable' }
    }

    const validated = validateRecord(record)
    if (!validated) {
      return { ok: false, code: 'invalid' }
    }

    try {
      const ciphertext = this.deps.encrypt(
        JSON.stringify({ v: FORMAT_VERSION, ...validated }),
      )
      // Atomic replace: tmp+rename so the durable record always holds a
      // COMPLETE credential - the refreshed record is fully persisted
      // before the old one is retired (spec: persist before retiring).
      await this.deps.writeFile(this.tmpPath, ciphertext)
      await this.deps.renameFile(this.tmpPath, this.deps.credentialPath)
      return { ok: true, value: null }
    } catch {
      return { ok: false, code: 'unavailable' }
    }
  }

  async clear(): Promise<GuestCredentialResult<null>> {
    try {
      await this.deps.removeFile(this.deps.credentialPath)
      return { ok: true, value: null }
    } catch (error) {
      return (error as { code?: string } | null)?.code === 'ENOENT'
        ? { ok: true, value: null }
        : { ok: false, code: 'unavailable' }
    }
  }
}

/** The complete IPC allowlist for the durable guest credential. Channel
 *  names are fixed; payloads are validated inside the store, so a forged
 *  or malformed renderer message resolves to a typed error rather than a
 *  crash or a partial write. */
export function registerGuestCredentialIpc(
  store: GuestCredentialStore,
  ipcMain: GuestCredentialIpcMain,
): void {
  ipcMain.handle('guest-credential:load', () => store.load())
  ipcMain.handle('guest-credential:save', (_event, record) => store.save(record as GuestCredentialRecord))
  ipcMain.handle('guest-credential:clear', () => store.clear())
}
