import { resolveAckedSaveKey, listSaveEnvelopeKeys, ACKED_KEY_BASE } from '../save/saveKeys'
import {
  fnv1a64Hex,
  PENDING_SAVE_FORMAT,
  type DurableWriteResult,
  type SaveEnvironmentBinding,
} from './PendingSaveJournal'

// Beta-final B1-C (PR4) - the server-ACKed cache mirror as ONE
// identity-bound envelope: payload + revision + identity travel
// together, replacing the transitional split save/revision keys
// (B1.5). The envelope is a mirror only - the remote row stays the
// authority - so a cache write failure never flips an authoritative
// result and a corrupt envelope reads as absent.

export interface AckedSaveEnvelope {
  format: typeof PENDING_SAVE_FORMAT
  environmentId: string
  userId: string
  characterId: string
  revision: number
  /** Canonical bytes the server acknowledged (the remote row's payload). */
  rawPayload: string
  localByteHash: string
  ackedAtUtc: string
}

export type AckedCacheReadResult =
  | { status: 'none' }
  | { status: 'ok'; envelope: AckedSaveEnvelope }
  | { status: 'corrupt'; raw: string }

export function ackedSaveDigestInput(envelope: AckedSaveEnvelope): string {
  return JSON.stringify([
    envelope.environmentId,
    envelope.userId,
    envelope.characterId,
    envelope.revision,
    envelope.rawPayload,
    envelope.ackedAtUtc,
  ])
}

export function buildAckedSaveEnvelope(
  args: Omit<AckedSaveEnvelope, 'format' | 'localByteHash'>,
): AckedSaveEnvelope {
  const envelope = { ...args, format: PENDING_SAVE_FORMAT } as AckedSaveEnvelope
  envelope.localByteHash = fnv1a64Hex(ackedSaveDigestInput(envelope))
  return envelope
}

function isEnvelopeShape(value: unknown): value is AckedSaveEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<AckedSaveEnvelope>
  return v.format === PENDING_SAVE_FORMAT
    && typeof v.environmentId === 'string'
    && typeof v.userId === 'string'
    && typeof v.characterId === 'string'
    && typeof v.revision === 'number' && Number.isSafeInteger(v.revision) && v.revision >= 0
    && typeof v.rawPayload === 'string'
    && typeof v.localByteHash === 'string'
    && typeof v.ackedAtUtc === 'string'
}

export function parseAckedSaveEnvelope(raw: string): AckedSaveEnvelope | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isEnvelopeShape(value)) return null
  return fnv1a64Hex(ackedSaveDigestInput(value)) === value.localByteHash ? value : null
}

function storageError(error: unknown): DurableWriteResult {
  const name = error instanceof DOMException ? error.name : ''
  const quota = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
  return { status: 'error', reason: quota ? 'quota' : 'unavailable', message: String(error) }
}

export interface AckedSaveCacheDeps {
  storage?: Storage
}

export class AckedSaveCache {
  constructor(
    private readonly environmentId: string,
    private readonly deps: AckedSaveCacheDeps = {},
  ) {}

  private store(): Storage | null {
    if (this.deps.storage) return this.deps.storage
    return typeof localStorage !== 'undefined' ? localStorage : null
  }

  private key(): string {
    return resolveAckedSaveKey(this.environmentId)
  }

  read(binding?: SaveEnvironmentBinding): AckedCacheReadResult {
    const storage = this.store()
    if (!storage) return { status: 'none' }
    let raw: string | null
    try {
      raw = storage.getItem(this.key())
    } catch {
      return { status: 'none' }
    }
    if (raw === null) return { status: 'none' }
    const envelope = parseAckedSaveEnvelope(raw)
    if (!envelope) return { status: 'corrupt', raw }
    if (
      binding
      && (envelope.environmentId !== binding.environmentId
        || envelope.userId !== binding.userId
        || envelope.characterId !== binding.characterId)
    ) {
      return { status: 'none' }
    }
    return { status: 'ok', envelope }
  }

  put(envelope: AckedSaveEnvelope): DurableWriteResult {
    if (envelope.environmentId !== this.environmentId) {
      return { status: 'error', reason: 'unavailable', message: 'acked envelope environment mismatch' }
    }
    const storage = this.store()
    if (!storage) return { status: 'error', reason: 'unavailable', message: 'localStorage unavailable' }
    try {
      storage.setItem(this.key(), JSON.stringify(envelope))
      return { status: 'ok' }
    } catch (error: unknown) {
      return storageError(error)
    }
  }

  clear(): DurableWriteResult {
    const storage = this.store()
    if (!storage) return { status: 'error', reason: 'unavailable', message: 'localStorage unavailable' }
    try {
      storage.removeItem(this.key())
      return { status: 'ok' }
    } catch (error: unknown) {
      return storageError(error)
    }
  }
}

/** Env-agnostic newest-envelope lookup for the export/resume seams:
 *  call sites (settings export, resume candidate) do not carry the
 *  environment fingerprint - the single acked mirror under the resolved
 *  account is the byte source. Hash-validated; corrupt/mismatched
 *  envelopes are skipped. */
export function readAnyAckedSaveEnvelope(accountId: string, storage?: Storage): AckedSaveEnvelope | null {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!store) return null
  const keys = listSaveEnvelopeKeys(store, accountId)
  let newest: AckedSaveEnvelope | null = null
  for (const key of keys) {
    if (!key.startsWith(`${ACKED_KEY_BASE}:`) || !key.endsWith(`:${accountId}`)) continue
    let raw: string | null
    try {
      raw = store.getItem(key)
    } catch {
      continue
    }
    if (raw === null) continue
    const envelope = parseAckedSaveEnvelope(raw)
    if (!envelope) continue
    if (!newest || envelope.ackedAtUtc >= newest.ackedAtUtc) newest = envelope
  }
  return newest
}
