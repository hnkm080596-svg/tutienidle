import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { requestSupabase } from '../supabase/SupabaseHttp'

// Beta-final B1 - the typed projection of the PR2 contract surface the
// client consumes. The error taxonomy (B1.7) is preserved end-to-end:
// transport/session rejections map to these codes and never collapse to a
// generic 'server_unavailable'.

export type BackendErrorCode =
  | 'NETWORK_UNAVAILABLE'
  | 'SESSION_REVOKED'
  | 'AUTH_EXPIRED'
  | 'SAVE_CONFLICT'
  | 'SAVE_INVALID'
  | 'SAVE_TOO_LARGE'
  | 'SERVER_ERROR'
  | 'CONFIGURATION_ERROR'
  /** Protocol/version rejections that are not covered by the B1.7 core
   *  set; kept distinct so the boot path can surface an honest state. */
  | 'PROTOCOL_OUTDATED'
  | 'MAINTENANCE'

/** Protocol version this client speaks; must be inside
 *  get_backend_status().supportedProtocolVersions for admission. */
export const CLIENT_PROTOCOL_VERSION = 1

/** Refuse codes that arm the remote-scope save-issue surface on the
 *  write paths. A remote-destruction remedy is only honest for genuine
 *  DATA-CLASS refuses - the server saying "this save's content is
 *  unacceptable" (W8-AUT-1): rerolling/deleting the character is the one
 *  heal left, and the exported payload preserves the refused state. The
 *  whole SERVER_ERROR bucket (COMMITTED_MALFORMED - the save already
 *  landed; PENDING_JOURNAL codes - local faults; CHECKPOINT codes,
 *  CUTOFF_REGRESSION, MUTATION_ID_REUSED - transient authority rejections)
 *  must NOT arm: remote reset there burns a healthy row or loops the
 *  wedge. Auth/transport/protocol/config codes likewise keep their own
 *  terminal surfaces via observeSaveResult - the generic card is honest
 *  where remote reset could not help anyway. */
export const DATA_REFUSE_CODES: ReadonlySet<BackendErrorCode> = new Set([
  'SAVE_INVALID',
  'SAVE_TOO_LARGE',
])

export interface BackendStatus {
  contractPhase: string
  protocolVersion: number
  supportedProtocolVersions: number[]
  acceptedSaveSchemaVersions: number[]
  maintenance: { enabled: boolean; message: string | null }
  minClientVersion: string | null
  supportedClientVersions: string[]
  serverTimeUtc: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  return value.every(v => typeof v === 'number' && Number.isSafeInteger(v)) ? value : null
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.every(v => typeof v === 'string') ? value : null
}

export function parseBackendStatus(raw: unknown): BackendStatus | null {
  if (!isRecord(raw) || raw.status !== 'OK') return null
  const maintenance = isRecord(raw.maintenance) ? raw.maintenance : {}
  const supportedProtocolVersions = readNumberArray(raw.supportedProtocolVersions)
  const acceptedSaveSchemaVersions = readNumberArray(raw.acceptedSaveSchemaVersions)
  const supportedClientVersions = readStringArray(raw.supportedClientVersions)

  if (
    typeof raw.contractPhase !== 'string'
    || typeof raw.protocolVersion !== 'number'
    || supportedProtocolVersions === null
    || acceptedSaveSchemaVersions === null
    || supportedClientVersions === null
    || typeof raw.serverTimeUtc !== 'string'
  ) {
    return null
  }

  return {
    contractPhase: raw.contractPhase,
    protocolVersion: raw.protocolVersion,
    supportedProtocolVersions,
    acceptedSaveSchemaVersions,
    maintenance: {
      enabled: maintenance.enabled === true,
      message: typeof maintenance.message === 'string' ? maintenance.message : null,
    },
    minClientVersion: typeof raw.minClientVersion === 'string' ? raw.minClientVersion : null,
    supportedClientVersions,
    serverTimeUtc: raw.serverTimeUtc,
  }
}

export async function fetchBackendStatus(
  config: SupabaseConfig,
  accessToken?: string,
): Promise<BackendStatus | null> {
  const raw = await requestSupabase<unknown>(
    config,
    '/rest/v1/rpc/get_backend_status',
    { method: 'POST', body: '{}' },
    accessToken,
  )
  return parseBackendStatus(raw)
}

// --- Remote row projections shared by the adapter and provisioning ---

/** The character metadata block every guarded RPC returns; the
 *  canonical reconstruction input for a CHARACTER_UNINITIALIZED boot -
 *  exactly one starter snapshot may be rebuilt from it, never rerolled. */
export interface RemoteCharacterMetadata {
  id: string
  name: string
  selectedTalentIds: string[]
  baseAttributes: { strength: number; dexterity: number; intelligence: number; attunement: number; vitality: number }
  mortalBasicSkillId: string | null
  realmId: string
  realmLevel: number
  createdAt: string
}

/** A live server time checkpoint; write_character_save requires one in
 *  lease with a bounded elapsedMonotonicMs for the time-authority gate. */
export interface RemoteTimeCheckpoint {
  checkpointId: string
  anchorAt: string
  leaseExpiresAt: string
  /** performance.now() at the RPC response - elapsed is measured
   *  against this receipt so clock jumps cannot inflate it. */
  receivedAtMonotonicMs: number
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function parseRemoteCharacterMetadata(raw: unknown): RemoteCharacterMetadata | null {
  if (!isRecord(raw)) return null
  const attrs = isRecord(raw.baseAttributes) ? raw.baseAttributes : null
  const talentIds = readStringArray(raw.selectedTalentIds)

  if (
    !readString(raw.id)
    || !readString(raw.name)
    || talentIds === null
    || attrs === null
    || typeof attrs.strength !== 'number'
    || typeof attrs.dexterity !== 'number'
    || typeof attrs.intelligence !== 'number'
    || typeof attrs.attunement !== 'number'
    || typeof attrs.vitality !== 'number'
    || !readString(raw.realmId)
    || typeof raw.realmLevel !== 'number'
    || !readString(raw.createdAt)
  ) {
    return null
  }

  return {
    id: raw.id as string,
    name: raw.name as string,
    selectedTalentIds: talentIds,
    baseAttributes: {
      strength: attrs.strength,
      dexterity: attrs.dexterity,
      intelligence: attrs.intelligence,
      attunement: attrs.attunement,
      vitality: attrs.vitality,
    },
    mortalBasicSkillId: typeof raw.mortalBasicSkillId === 'string' ? raw.mortalBasicSkillId : null,
    realmId: raw.realmId as string,
    realmLevel: raw.realmLevel,
    createdAt: raw.createdAt as string,
  }
}

export function parseRemoteTimeCheckpoint(raw: unknown, receivedAtMonotonicMs: number): RemoteTimeCheckpoint | null {
  if (!isRecord(raw)) return null
  const checkpointId = readString(raw.checkpointId)
  const anchorAt = readString(raw.anchorAt)
  const leaseExpiresAt = readString(raw.leaseExpiresAt)

  if (!checkpointId || !anchorAt || !leaseExpiresAt) return null

  return { checkpointId, anchorAt, leaseExpiresAt, receivedAtMonotonicMs }
}
