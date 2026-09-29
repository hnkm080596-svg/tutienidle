import { SupabaseHttpError, requestSupabase } from '../supabase/SupabaseHttp'
import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { resolveSupabaseSession } from '../supabase/SupabaseSession'
import { resolveRevisionKey, resolveSaveKey } from '../save/saveKeys'
import { CURRENT_SAVE_VERSION, type GameSave } from '../save/SaveSystem'
import { validateGameSaveShape } from '../save/saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from '../save/saveAcceptance'
import type { ClientBuildInfo } from '../backend/ClientBuildInfo'
import {
  parseRemoteCharacterMetadata,
  parseRemoteTimeCheckpoint,
  type BackendErrorCode,
  type RemoteTimeCheckpoint,
} from '../session/BackendStatus'
import type { CloudSaveLoadResult, CloudSaveService, CloudSaveWriteResult } from './CloudSaveService'

// Beta-final B1 (PR3) - the remote-authoritative adapter. All save I/O is
// the guarded RPC surface shipped by PR2; localStorage is reduced to a
// server-ACKed cache mirror (B1.5 - the split save/revision keys stay in
// their current shape until PR4 replaces them with the identity-bound
// envelope; nothing here reads them for authority).
//
// Contract surface consumed (supabase/migrations/202609300001_*):
//   load_game_state(p_session_id)
//     -> NO_CHARACTER | CHARACTER_UNINITIALIZED | CHARACTER_DELETED
//      | INCOMPATIBLE | SAVE_READY (+ character meta + serverCheckpoint)
//   write_character_save(session, expected_revision, schema_version,
//     payload, build_id, mutation_id, time_checkpoint)
//     -> COMMITTED | CONFLICT(SAVE_CONFLICT) | REJECTED(typed code)
//   heartbeat_session(p_session_id) -> fresh checkpoint when the adapter
//     needs one outside a boot load.
//
// Error mapping (B1.7): transport/PostgREST failures map to the
// BackendErrorCode taxonomy; server REJECTED codes keep their meaning
// through `detail` and are never collapsed to a generic unavailable.

interface SupabaseSaveBinding {
  sessionId: string
  userId?: string
  accessToken: string
}

interface LoadGameStateResponse {
  status?: string
  reason?: string
  character?: unknown
  save?: {
    schemaVersion?: number
    saveRevision?: number
    payload?: unknown
    updatedAt?: string
    progressionCutoffAt?: string | null
    lastClientBuildId?: string | null
    lastMutationId?: string | null
  }
  serverCheckpoint?: unknown
  serverTimeUtc?: string
}

interface HeartbeatResponse {
  status?: string
  serverTimeUtc?: string
  checkpoint?: unknown
}

interface WriteSaveResponse {
  status?: string
  alreadyCommitted?: boolean
  committedRevision?: number
  currentRevision?: number | null
  progressionCutoffAt?: string | null
  receipt?: unknown
  code?: string
  detail?: string
  serverTimeUtc?: string
}

export interface SupabaseCloudSaveServiceDeps {
  /** Test seam for deterministic elapsedMonotonicMs. */
  monotonicNow?: () => number
  /** Test seam replacing resolveSupabaseSession(config). */
  resolveBinding?: () => Promise<SupabaseSaveBinding | null>
}

function unavailable(
  code: BackendErrorCode,
  message: string,
  retryable: boolean,
  detail?: string,
): { status: 'unavailable'; code: BackendErrorCode; message: string; retryable: boolean; detail?: string } {
  return { status: 'unavailable', code, message, retryable, detail }
}

export class SupabaseCloudSaveService implements CloudSaveService {
  readonly capability = 'remote-authoritative' as const

  private checkpoint: RemoteTimeCheckpoint | null = null

  constructor(
    private readonly config: SupabaseConfig,
    private readonly build: ClientBuildInfo,
    private readonly deps: SupabaseCloudSaveServiceDeps = {},
  ) {}

  private monotonicNow(): number {
    return this.deps.monotonicNow ? this.deps.monotonicNow() : performance.now()
  }

  private async binding(): Promise<SupabaseSaveBinding | null> {
    if (this.deps.resolveBinding) return this.deps.resolveBinding()
    const session = await resolveSupabaseSession(this.config)
    if (!session) return null
    return { sessionId: session.sessionId, userId: session.userId, accessToken: session.accessToken }
  }

  private async rpc<T>(path: string, body: unknown, accessToken: string): Promise<T> {
    return requestSupabase<T>(this.config, path, { method: 'POST', body: JSON.stringify(body) }, accessToken)
  }

  /** PostgREST surfaces guarded-RPC raises as 400 {code:'28000',message};
   *  auth failures as 401/403; everything else falls through to generic
   *  transport classes. */
  private mapError(error: unknown): { status: 'unavailable'; code: BackendErrorCode; message: string; retryable: boolean; detail?: string } {
    if (error instanceof SupabaseHttpError) {
      const payload = error.payload
      const detail = typeof payload === 'object' && payload !== null
        ? String((payload as { message?: unknown }).message ?? (payload as { code?: unknown }).code ?? '')
        : ''

      if (detail === 'session revoked') {
        return unavailable('SESSION_REVOKED', 'Phiên đã bị thu hồi — đăng nhập lại để tiếp tục.', false, detail)
      }
      if (detail === 'SESSION_PROTOCOL_OUTDATED') {
        return unavailable('PROTOCOL_OUTDATED', 'Phiên bản ứng dụng không còn được hỗ trợ.', false, detail)
      }
      if (detail === 'AUTH_REQUIRED' || error.status === 401 || error.status === 403) {
        return unavailable('AUTH_EXPIRED', 'Phiên đăng nhập đã hết hạn — đăng nhập lại để tiếp tục.', true, detail)
      }
      if (detail === 'PROFILE_MISSING' || detail === 'SESSION_INVALID') {
        return unavailable('SESSION_REVOKED', 'Phiên đăng nhập không hợp lệ — đăng nhập lại để tiếp tục.', false, detail)
      }
      if (error.status >= 500) {
        return unavailable('SERVER_ERROR', 'Máy chủ đang gặp sự cố — thử lại sau.', true, detail)
      }
      return unavailable('SERVER_ERROR', 'Máy chủ từ chối yêu cầu.', false, detail)
    }

    // fetch() rejection / 10s timeout abort - transport never reached the
    // server, so the write may or may not have committed; retryable stays
    // false because only a fresh load resolves that ambiguity safely.
    return unavailable('NETWORK_UNAVAILABLE', 'Mất kết nối tới máy chủ — kiểm tra mạng rồi thử lại.', false)
  }

  /** The server-ACKed cache mirror (B1.5 transitional form - PR4 replaces
   *  it with the identity-bound envelope). Revision-first ordering mirrors
   *  the local adapter's crash-safety contract. Cache failure never flips
   *  an authoritative result: the remote row remains the truth. */
  private cacheAcked(raw: string, revision: number): void {
    try {
      localStorage.setItem(resolveRevisionKey(), String(revision))
      localStorage.setItem(resolveSaveKey(), raw)
    } catch (error: unknown) {
      console.error('[cloudSave] server-acked cache write failed', error)
    }
  }

  private storeCheckpoint(raw: unknown): void {
    const checkpoint = parseRemoteTimeCheckpoint(raw, this.monotonicNow())
    if (checkpoint) this.checkpoint = checkpoint
  }

  async load(): Promise<CloudSaveLoadResult> {
    const binding = await this.binding()

    if (!binding) {
      return unavailable('AUTH_EXPIRED', 'Phiên đăng nhập đã hết hạn — đăng nhập lại để tiếp tục.', false)
    }

    let response: LoadGameStateResponse

    try {
      response = await this.rpc<LoadGameStateResponse>(
        '/rest/v1/rpc/load_game_state',
        { p_session_id: binding.sessionId },
        binding.accessToken,
      )
    } catch (error: unknown) {
      return this.mapError(error)
    }

    if (response.serverCheckpoint !== undefined) {
      this.storeCheckpoint(response.serverCheckpoint)
    }

    switch (response.status) {
      case 'NO_CHARACTER':
        return { status: 'empty', revision: 0 }

      case 'CHARACTER_UNINITIALIZED': {
        const character = parseRemoteCharacterMetadata(response.character)
        if (!character) {
          return unavailable('SERVER_ERROR', 'Máy chủ trả metadata nhân vật không hợp lệ.', false, 'CHARACTER_META_INVALID')
        }
        return { status: 'uninitialized', character, revision: 0 }
      }

      case 'CHARACTER_DELETED': {
        const character = parseRemoteCharacterMetadata(response.character) ?? undefined
        return { status: 'deleted', character }
      }

      case 'INCOMPATIBLE': {
        const payload = response.save?.payload
        const raw = JSON.stringify(payload ?? null)
        const foundVersion = typeof response.save?.schemaVersion === 'number'
          ? response.save.schemaVersion
          : undefined

        // 'incompatible-schema' / 'version-mismatch' are recoverable via
        // the existing incompatible surface; everything else the server
        // classified (invalid-payload, empty-payload, owner-mismatch, ...)
        // is byte-level corruption preserved verbatim for recovery.
        if (response.reason === 'incompatible-schema' || response.reason === 'version-mismatch') {
          return { status: 'incompatible', foundVersion, raw }
        }
        return { status: 'corrupted', raw }
      }

      case 'SAVE_READY': {
        const save = response.save
        const revision = save?.saveRevision

        if (!save || typeof revision !== 'number' || !Number.isSafeInteger(revision)) {
          return unavailable('SERVER_ERROR', 'Máy chủ trả save không hợp lệ.', false, 'SAVE_READY_MALFORMED')
        }

        // B1.5 - a downloaded payload passes the SAME client pipeline the
        // local adapter runs: version gate -> shape validation ->
        // normalization -> acceptance. A payload the server committed but
        // this build cannot consume is contract drift, surfaced as
        // incompatible/corrupted with raw preserved for recovery.
        const raw = JSON.stringify(save.payload)
        const foundVersion = typeof (save.payload as { version?: unknown })?.version === 'number'
          ? (save.payload as { version: number }).version
          : undefined

        if (foundVersion !== CURRENT_SAVE_VERSION || save.schemaVersion !== CURRENT_SAVE_VERSION) {
          return { status: 'incompatible', foundVersion, raw }
        }

        const shape = validateGameSaveShape(save.payload)

        if (!shape.ok) {
          console.warn('[cloudSave] remote save failed shape validation:', shape.issues)
          return { status: 'corrupted', raw }
        }

        const normalized = shape.normalizedSave as GameSave

        if (!isSaveAcceptable(normalized, staticSaveAcceptanceCatalogs())) {
          console.warn('[cloudSave] remote save rejected by acceptance gate')
          return { status: 'corrupted', raw }
        }

        this.cacheAcked(raw, revision)
        return { status: 'ok', save: normalized, revision, discardedEquipmentCount: shape.discardedEquipmentCount, raw }
      }

      default:
        return unavailable('SERVER_ERROR', 'Máy chủ trả trạng thái không nhận diện được.', false, String(response.status))
    }
  }

  async save(save: GameSave, expectedRevision: number): Promise<CloudSaveWriteResult> {
    const binding = await this.binding()

    if (!binding) {
      return unavailable('AUTH_EXPIRED', 'Phiên đăng nhập đã hết hạn — đăng nhập lại để tiếp tục.', false)
    }

    // write_character_save REJECTs a missing checkpoint object
    // (CHECKPOINT_REQUIRED). The boot load always leaves one, but a
    // save-first path (e.g. a session that skipped the load) re-anchors
    // through heartbeat instead of failing on a fabricated value.
    if (!this.checkpoint) {
      try {
        const heartbeat = await this.rpc<HeartbeatResponse>(
          '/rest/v1/rpc/heartbeat_session',
          { p_session_id: binding.sessionId },
          binding.accessToken,
        )

        if (heartbeat.checkpoint) {
          this.storeCheckpoint(heartbeat.checkpoint)
        }
      } catch (error: unknown) {
        return this.mapError(error)
      }
    }

    if (!this.checkpoint) {
      // Heartbeat returned OK with no checkpoint: no live character row.
      return unavailable('SERVER_ERROR', 'Không có nhân vật nào trên máy chủ.', false, 'NO_CHARACTER')
    }

    const checkpoint = this.checkpoint
    const timeCheckpoint = {
      checkpointId: checkpoint.checkpointId,
      elapsedMonotonicMs: Math.max(0, this.monotonicNow() - checkpoint.receivedAtMonotonicMs),
    }

    let response: WriteSaveResponse

    try {
      response = await this.rpc<WriteSaveResponse>(
        '/rest/v1/rpc/write_character_save',
        {
          p_session_id: binding.sessionId,
          p_expected_revision: expectedRevision,
          p_schema_version: this.build.saveSchemaVersion,
          p_payload: save,
          p_build_id: this.build.buildId,
          p_mutation_id: crypto.randomUUID(),
          p_time_checkpoint: timeCheckpoint,
        },
        binding.accessToken,
      )
    } catch (error: unknown) {
      return this.mapError(error)
    }

    switch (response.status) {
      case 'COMMITTED': {
        const revision = response.committedRevision

        if (typeof revision !== 'number' || !Number.isSafeInteger(revision)) {
          return unavailable('SERVER_ERROR', 'Máy chủ xác nhận save nhưng revision không hợp lệ.', false, 'COMMITTED_MALFORMED')
        }

        this.cacheAcked(JSON.stringify(save), revision)
        return { status: 'ok', revision }
      }

      case 'CONFLICT':
        // remote-authoritative (B1.6): terminal - the coordinator returns
        // this unchanged; there is no load-latest/retry-overwrite path.
        return {
          status: 'conflict',
          currentRevision: typeof response.currentRevision === 'number' ? response.currentRevision : expectedRevision,
        }

      case 'REJECTED':
        switch (response.code) {
          case 'SAVE_INVALID':
          case 'SAVE_SCHEMA_UNSUPPORTED':
            return unavailable('SAVE_INVALID', 'Save bị máy chủ từ chối — dữ liệu không hợp lệ.', false, response.detail ?? response.code)
          case 'SAVE_TOO_LARGE':
            return unavailable('SAVE_TOO_LARGE', 'Save vượt giới hạn kích thước máy chủ cho phép.', false, response.code)
          case 'NO_CHARACTER':
          case 'CHARACTER_DELETED':
            return unavailable('SERVER_ERROR', 'Nhân vật không còn trên máy chủ.', false, response.code)
          default:
            // CHECKPOINT_*/CUTOFF_REGRESSION/MUTATION_ID_REUSED: server-
            // authority rejections a retry cannot fix inside this call -
            // recovery is a fresh authoritative load.
            return unavailable('SERVER_ERROR', 'Máy chủ từ chối ghi save.', false, response.code)
        }

      default:
        return unavailable('SERVER_ERROR', 'Máy chủ trả trạng thái không nhận diện được.', false, String(response.status))
    }
  }
}
