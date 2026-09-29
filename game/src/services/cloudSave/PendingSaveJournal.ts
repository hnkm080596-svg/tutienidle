import { resolvePendingSaveKey, resolveQuarantineSaveKey } from '../save/saveKeys'

// Beta-final B1-C (PR4) - the durable pending-save journal (WAL).
//
// Contract (plan section 3): one identity-bound envelope per
// {environment, project, user} slot carries the mutation the transport
// was about to attempt - mutation id, base revision, the FROZEN server
// checkpoint {checkpointId, elapsedMonotonicMs}, schema/build identity
// and the canonical raw payload + local byte hash. The checkpoint offset
// is frozen at record-build time so a replay recomputes the original
// progression-cutoff candidate even when the commit lands much later.
//
// `generation` from SaveBinding is a runtime fence owned by the
// adapter/coordinator - it is never persisted inside a record.
//
// Storage failure is a typed result, never a throw: put/clear/quarantine
// report {status:'error'} so callers can assert "pending retained where
// unresolved". Atomic storage replacement still is not disk durability
// on an abrupt OS failure - the server ACK remains the authority.

export const PENDING_SAVE_FORMAT = 1

export interface SaveEnvironmentBinding {
  /** environment + non-secret project fingerprint ('staging:projref'). */
  environmentId: string
  userId: string
  characterId: string
}

export interface PendingSaveTimeCheckpoint {
  checkpointId: string
  elapsedMonotonicMs: number
}

export interface PendingSaveRecord {
  format: typeof PENDING_SAVE_FORMAT
  environmentId: string
  userId: string
  characterId: string
  mutationId: string
  baseRevision: number
  timeCheckpoint: PendingSaveTimeCheckpoint
  schemaVersion: number
  buildId: string
  createdAtUtc: string
  /** Canonical GameSave bytes (JSON.stringify of the detached snapshot). */
  rawPayload: string
  /** fnv1a-64 hex over the canonical projection - integrity, not the
   *  server digest (never compare client-side serialization against the
   *  server's jsonb::text request digest). */
  localByteHash: string
}

export type DurableWriteResult =
  | { status: 'ok' }
  | { status: 'error'; reason: 'quota' | 'unavailable'; message?: string }

export type JournalReadResult =
  | { status: 'none' }
  | { status: 'pending'; record: PendingSaveRecord }
  /** Envelope parses but belongs to another env/user/character - parked
   *  for explicit export rather than replayed or silently dropped. */
  | { status: 'mismatch'; raw: string }
  /** Unparseable envelope or byte-hash mismatch - bytes preserved for quarantine. */
  | { status: 'corrupt'; raw: string }

export type JournalClearResult =
  | { status: 'ok'; cleared: boolean }
  | { status: 'error'; reason: 'quota' | 'unavailable'; message?: string }

export interface QuarantinedPendingSave {
  format: typeof PENDING_SAVE_FORMAT
  quarantinedAtUtc: string
  reason: string
  /** Verbatim record or envelope bytes, kept for explicit export. */
  raw: string
}

const QUARANTINE_CAPACITY = 5

// FNV-1a 64-bit over UTF-16 code units: a synchronous integrity check for
// the local envelope, sized for accidental corruption (torn writes,
// truncation, stale reads). It is NOT a security boundary - anything that
// can write localStorage can rewrite the hash - and it is never compared
// against the server's request_digest (jsonb::text fingerprint).
export function fnv1a64Hex(input: string): string {
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i))
    hash = (hash * prime) & mask
  }
  return hash.toString(16).padStart(16, '0')
}

/** Canonical projection - fixed field order so the digest is stable. */
export function pendingSaveDigestInput(record: PendingSaveRecord): string {
  return JSON.stringify([
    record.environmentId,
    record.userId,
    record.characterId,
    record.mutationId,
    record.baseRevision,
    record.timeCheckpoint.checkpointId,
    record.timeCheckpoint.elapsedMonotonicMs,
    record.schemaVersion,
    record.buildId,
    record.createdAtUtc,
    record.rawPayload,
  ])
}

export function buildPendingSaveRecord(
  args: Omit<PendingSaveRecord, 'format' | 'localByteHash'>,
): PendingSaveRecord {
  const record = { ...args, format: PENDING_SAVE_FORMAT } as PendingSaveRecord
  record.localByteHash = fnv1a64Hex(pendingSaveDigestInput(record))
  return record
}

function isRecordShape(value: unknown): value is PendingSaveRecord {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<PendingSaveRecord>
  return v.format === PENDING_SAVE_FORMAT
    && typeof v.environmentId === 'string'
    && typeof v.userId === 'string'
    && typeof v.characterId === 'string'
    && typeof v.mutationId === 'string'
    && typeof v.baseRevision === 'number' && Number.isSafeInteger(v.baseRevision) && v.baseRevision >= 0
    && typeof v.timeCheckpoint === 'object' && v.timeCheckpoint !== null
    && typeof v.timeCheckpoint.checkpointId === 'string'
    && typeof v.timeCheckpoint.elapsedMonotonicMs === 'number' && v.timeCheckpoint.elapsedMonotonicMs >= 0
    && typeof v.schemaVersion === 'number'
    && typeof v.buildId === 'string'
    && typeof v.createdAtUtc === 'string'
    && typeof v.rawPayload === 'string'
    && typeof v.localByteHash === 'string'
}

export function parsePendingSaveRecord(raw: string): PendingSaveRecord | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecordShape(value)) return null
  return fnv1a64Hex(pendingSaveDigestInput(value)) === value.localByteHash ? value : null
}

function storageError(error: unknown): { status: 'error'; reason: 'quota' | 'unavailable'; message?: string } {
  const name = error instanceof DOMException ? error.name : ''
  const quota = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
  return { status: 'error', reason: quota ? 'quota' : 'unavailable', message: String(error) }
}

export interface PendingSaveJournalDeps {
  storage?: Storage
  nowIso?: () => string
}

export class PendingSaveJournal {
  constructor(
    private readonly environmentId: string,
    private readonly deps: PendingSaveJournalDeps = {},
  ) {}

  private store(): Storage | null {
    if (this.deps.storage) return this.deps.storage
    return typeof localStorage !== 'undefined' ? localStorage : null
  }

  private key(): string {
    return resolvePendingSaveKey(this.environmentId)
  }

  private rawSlot(): string | null {
    const storage = this.store()
    if (!storage) return null
    try {
      return storage.getItem(this.key())
    } catch {
      return null
    }
  }

  private slot(): JournalReadResult {
    const raw = this.rawSlot()
    if (raw === null) return { status: 'none' }
    const record = parsePendingSaveRecord(raw)
    if (!record) return { status: 'corrupt', raw }
    return { status: 'pending', record }
  }

  /** Strict triple read: a record only answers to its own
   *  environment+user+character binding (cross-identity isolation). A
   *  well-formed record bound to a different identity reports
   *  'mismatch' so the caller can quarantine it - never replayed. */
  read(binding: SaveEnvironmentBinding): JournalReadResult {
    if (binding.environmentId !== this.environmentId) return { status: 'none' }
    const slot = this.slot()
    if (slot.status !== 'pending') return slot
    const { record } = slot
    if (
      record.environmentId !== binding.environmentId
      || record.userId !== binding.userId
      || record.characterId !== binding.characterId
    ) {
      return { status: 'mismatch', raw: this.rawSlot() ?? JSON.stringify(record) }
    }
    return slot
  }

  /** Pre-character-resolution read (load still has not learned the
   *  character): same environment+user slot, any characterId. A record
   *  bound to another user/environment reports 'mismatch'. */
  readForUser(userId: string): JournalReadResult {
    const slot = this.slot()
    if (slot.status !== 'pending') return slot
    return slot.record.userId === userId && slot.record.environmentId === this.environmentId
      ? slot
      : { status: 'mismatch', raw: this.rawSlot() ?? JSON.stringify(slot.record) }
  }

  put(record: PendingSaveRecord): DurableWriteResult {
    if (record.environmentId !== this.environmentId) {
      return { status: 'error', reason: 'unavailable', message: 'pending record environment mismatch' }
    }
    const storage = this.store()
    if (!storage) return { status: 'error', reason: 'unavailable', message: 'localStorage unavailable' }
    try {
      storage.setItem(this.key(), JSON.stringify(record))
      return { status: 'ok' }
    } catch (error: unknown) {
      return storageError(error)
    }
  }

  /** Remove exactly this record: binding + mutation id must both match;
   *  anything else leaves the slot untouched ({cleared:false}). */
  clearMatching(binding: SaveEnvironmentBinding, mutationId: string): JournalClearResult {
    if (binding.environmentId !== this.environmentId) return { status: 'ok', cleared: false }
    const slot = this.slot()
    if (slot.status !== 'pending') return { status: 'ok', cleared: false }
    const { record } = slot
    if (
      record.userId !== binding.userId
      || record.characterId !== binding.characterId
      || record.mutationId !== mutationId
    ) {
      return { status: 'ok', cleared: false }
    }
    const storage = this.store()
    if (!storage) return { status: 'error', reason: 'unavailable', message: 'localStorage unavailable' }
    try {
      storage.removeItem(this.key())
      return { status: 'ok', cleared: true }
    } catch (error: unknown) {
      return storageError(error)
    }
  }

  /** Unconditional slot removal. Use ONLY for a corrupt envelope that
   *  cannot be parsed into a record (clearMatching cannot verify its
   *  identity); a well-formed record always goes through clearMatching. */
  dropSlot(): DurableWriteResult {
    const storage = this.store()
    if (!storage) return { status: 'error', reason: 'unavailable', message: 'localStorage unavailable' }
    try {
      storage.removeItem(this.key())
      return { status: 'ok' }
    } catch (error: unknown) {
      return storageError(error)
    }
  }

  /** Park uncommittable/corrupt records for explicit export - bounded
   *  list, never silently dropped (newest entries win over the cap). */
  quarantine(raw: string, reason: string): DurableWriteResult {
    const storage = this.store()
    if (!storage) return { status: 'error', reason: 'unavailable', message: 'localStorage unavailable' }
    const entries = this.readQuarantine()
    entries.push({
      format: PENDING_SAVE_FORMAT,
      quarantinedAtUtc: this.deps.nowIso ? this.deps.nowIso() : new Date().toISOString(),
      reason,
      raw,
    })
    const bounded = entries.slice(-QUARANTINE_CAPACITY)
    try {
      storage.setItem(resolveQuarantineSaveKey(this.environmentId), JSON.stringify(bounded))
      return { status: 'ok' }
    } catch (error: unknown) {
      return storageError(error)
    }
  }

  readQuarantine(): QuarantinedPendingSave[] {
    const storage = this.store()
    if (!storage) return []
    let raw: string | null
    try {
      raw = storage.getItem(resolveQuarantineSaveKey(this.environmentId))
    } catch {
      return []
    }
    if (raw === null) return []
    try {
      const value: unknown = JSON.parse(raw)
      return Array.isArray(value) ? (value as QuarantinedPendingSave[]) : []
    } catch {
      return []
    }
  }
}
