import { SupabaseHttpError, requestSupabase } from '../supabase/SupabaseHttp'
import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { resolveSupabaseSession } from '../supabase/SupabaseSession'
import { resolveSaveAccountId } from '../save/saveKeys'
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
import type { CloudSaveLoadResult, CloudSaveService, CloudSaveWriteResult, HeartbeatOutcome } from './CloudSaveService'
import {
  buildPendingSaveRecord,
  PendingSaveJournal,
  type PendingSaveRecord,
  type SaveEnvironmentBinding,
} from './PendingSaveJournal'
import { AckedSaveCache, buildAckedSaveEnvelope } from './AckedSaveCache'
import {
  reconcilePendingSave,
  type PendingReplayOutcome,
  type ReconcileDecision,
  type RemoteSaveHead,
} from './reconcilePendingSave'

// Beta-final B1 (PR3) + B1-C (PR4) - the remote-authoritative adapter.
// All save I/O is the guarded RPC surface shipped by PR2; localStorage
// now carries two identity-bound envelopes (B1-C): the pending-save
// journal (write-ahead record replayed on the next authoritative load)
// and the server-ACKed cache mirror (payload+revision+identity as one
// envelope). Nothing here reads localStorage for authority.
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
// Lost-ACK discipline (B1-C): every write first lands in the journal
// bound to {environment, user, character} with a fresh mutation id and
// the FROZEN {checkpointId, elapsedMonotonicMs} it is about to send. If
// the response is lost the next load replays the same record; an
// identical-mutation retry returns alreadyCommitted without incrementing
// the revision. The generation fence (advanceGeneration, driven by
// coordinator.reset()/logout/user-switch) keeps an old generation's
// in-flight continuation from touching checkpoint, journal, or cache
// when its transport resolves.
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
  /** Test seam for the journal/cache storage target (defaults to localStorage). */
  storage?: Storage
  /** Test seam for deterministic createdAtUtc/ackedAtUtc. */
  nowIso?: () => string
  /** Diagnostics/test hook: observes every reconcile decision made during load(). */
  reconcileObserver?: (decision: ReconcileDecision) => void
}

function unavailable(
  code: BackendErrorCode,
  message: string,
  retryable: boolean,
  detail?: string,
): { status: 'unavailable'; code: BackendErrorCode; message: string; retryable: boolean; detail?: string } {
  return { status: 'unavailable', code, message, retryable, detail }
}

/** environment + non-secret project fingerprint for envelope binding. */
function deriveSaveEnvironmentId(config: SupabaseConfig, build: ClientBuildInfo): string {
  let project = 'unknown-project'
  try {
    const host = new URL(config.url).hostname
    project = host.endsWith('.supabase.co') ? host.slice(0, -'.supabase.co'.length) : host
  } catch {
    // keep fallback
  }
  return `${build.releaseChannel}:${project}`
}

/** ISO/timestamptz -> ms epoch; malformed input stays undefined so the
 *  authorized restore window never fabricates a bound. */
function parseTimestampMs(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : undefined
}

type PendingResolution =
  | { kind: 'proceed' }
  | {
      kind: 'committed'
      committedRevision: number
      currentRevision: number
      cacheSource: 'pending' | 'remote'
    }
  | { kind: 'terminal'; result: CloudSaveLoadResult }

export class SupabaseCloudSaveService implements CloudSaveService {
  readonly capability = 'remote-authoritative' as const

  private checkpoint: RemoteTimeCheckpoint | null = null
  private characterId: string | null = null
  private generation = 0
  private readonly environmentId: string
  private readonly journal: PendingSaveJournal
  private readonly ackedCache: AckedSaveCache

  constructor(
    private readonly config: SupabaseConfig,
    private readonly build: ClientBuildInfo,
    private readonly deps: SupabaseCloudSaveServiceDeps = {},
  ) {
    this.environmentId = deriveSaveEnvironmentId(config, build)
    this.journal = new PendingSaveJournal(this.environmentId, {
      storage: deps.storage,
      nowIso: deps.nowIso,
    })
    this.ackedCache = new AckedSaveCache(this.environmentId, { storage: deps.storage })
  }

  /** B1-C generation fence: bump on reset/logout/user-switch so an
   *  in-flight continuation of the OLD generation cannot advance the
   *  journal/cache/checkpoint when its transport resolves. Identity and
   *  the anchored checkpoint are generation-scoped too: a new
   *  session/account must re-resolve them - a stale checkpoint belongs
   *  to the OLD session and a stale characterId stamps envelopes with
   *  the wrong identity. */
  advanceGeneration(): void {
    this.generation++
    this.characterId = null
    this.checkpoint = null
  }

  private monotonicNow(): number {
    return this.deps.monotonicNow ? this.deps.monotonicNow() : performance.now()
  }

  private nowIso(): string {
    return this.deps.nowIso ? this.deps.nowIso() : new Date().toISOString()
  }

  private async binding(): Promise<SupabaseSaveBinding | null> {
    if (this.deps.resolveBinding) return this.deps.resolveBinding()
    const session = await resolveSupabaseSession(this.config)
    if (!session) return null
    return { sessionId: session.sessionId, userId: session.userId, accessToken: session.accessToken }
  }

  /** Envelope identity owner: the Supabase userId, else the resolved
   *  account slot (matches the journal key namespace). */
  private journalUserId(binding: SupabaseSaveBinding): string {
    return binding.userId ?? resolveSaveAccountId()
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

  private storeCheckpoint(raw: unknown): void {
    const checkpoint = parseRemoteTimeCheckpoint(raw, this.monotonicNow())
    if (checkpoint) this.checkpoint = checkpoint
  }

  private envelopeBinding(userId: string): SaveEnvironmentBinding {
    return {
      environmentId: this.environmentId,
      userId,
      characterId: this.characterId ?? '',
    }
  }

  /** Mirror the ACKed remote bytes into the single identity-bound
   *  envelope (B1.5's successor). Failure is reported, never flips the
   *  authoritative result - the server row remains the truth. */
  private mirrorAcked(userId: string, revision: number, rawPayload: string, ackedAtUtc?: string): string | undefined {
    const put = this.ackedCache.put(buildAckedSaveEnvelope({
      environmentId: this.environmentId,
      userId,
      characterId: this.characterId ?? '',
      revision,
      rawPayload,
      ackedAtUtc: ackedAtUtc ?? this.nowIso(),
    }))
    if (put.status === 'error') {
      console.error('[cloudSave] acked cache write failed:', put.reason, put.message)
      return `cache:${put.reason}`
    }
    return undefined
  }

  private clearPending(binding: SaveEnvironmentBinding, mutationId: string): string | undefined {
    const cleared = this.journal.clearMatching(binding, mutationId)
    if (cleared.status === 'error') {
      console.error('[cloudSave] journal clear failed:', cleared.reason, cleared.message)
      return `journal:${cleared.reason}`
    }
    return cleared.cleared ? undefined : 'journal:retained'
  }

  private quarantinePending(raw: string, reason: string): string | undefined {
    const moved = this.journal.quarantine(raw, reason)
    if (moved.status === 'error') {
      console.error('[cloudSave] quarantine write failed:', moved.reason, moved.message)
      return `quarantine:${moved.reason}`
    }
    return undefined
  }

  /** The pending record's frozen checkpoint + mutation id replayed
   *  verbatim - an identical retry is what makes the server resolve it
   *  as alreadyCommitted without bumping the revision. */
  private async replayPendingWrite(
    record: PendingSaveRecord,
    binding: SupabaseSaveBinding,
  ): Promise<PendingReplayOutcome> {
    let payload: unknown
    try {
      payload = JSON.parse(record.rawPayload)
    } catch {
      return { kind: 'rejected', code: 'PENDING_PAYLOAD_CORRUPT' }
    }

    let response: WriteSaveResponse

    try {
      response = await this.rpc<WriteSaveResponse>(
        '/rest/v1/rpc/write_character_save',
        {
          p_session_id: binding.sessionId,
          p_expected_revision: record.baseRevision,
          p_schema_version: record.schemaVersion,
          p_payload: payload,
          p_build_id: record.buildId,
          p_mutation_id: record.mutationId,
          p_time_checkpoint: record.timeCheckpoint,
        },
        binding.accessToken,
      )
    } catch {
      // Transport failure leaves the fate unresolved - retry-same.
      return { kind: 'unavailable' }
    }

    switch (response.status) {
      case 'COMMITTED': {
        const committed = response.committedRevision
        if (typeof committed !== 'number' || !Number.isSafeInteger(committed) || committed < 0) {
          return { kind: 'rejected', code: 'COMMITTED_MALFORMED' }
        }
        return {
          kind: 'committed',
          alreadyCommitted: response.alreadyCommitted === true,
          committedRevision: committed,
          currentRevision: typeof response.currentRevision === 'number' ? response.currentRevision : committed,
          serverTimeUtc: response.serverTimeUtc,
        }
      }
      case 'CONFLICT':
        return {
          kind: 'conflict',
          currentRevision: typeof response.currentRevision === 'number' ? response.currentRevision : record.baseRevision,
        }
      case 'REJECTED':
        return { kind: 'rejected', code: response.code ?? 'REJECTED' }
      default:
        return { kind: 'rejected', code: `UNRECOGNIZED:${String(response.status)}` }
    }
  }

  /** Reconcile one durable pending record during load(): replay the
   *  exact mutation and fold the receipt into a proceed/terminal
   *  resolution via the pure decider. */
  private async resolvePendingAtLoad(
    record: PendingSaveRecord,
    remote: RemoteSaveHead,
    binding: SupabaseSaveBinding,
    generation: number,
  ): Promise<PendingResolution> {
    const replay = await this.replayPendingWrite(record, binding)
    const decision = reconcilePendingSave(record, remote, replay)
    this.deps.reconcileObserver?.(decision)

    switch (decision.status) {
      case 'retry-same':
        // Fate unresolved - the record stays in the journal and replays
        // again on a later load.
        return { kind: 'proceed' }

      case 'conflict':
        // Genuine divergence: journal retained for the export surface.
        return {
          kind: 'terminal',
          result: {
            status: 'pending-conflict',
            currentRevision: decision.currentRevision,
            pendingRaw: record.rawPayload,
          },
        }

      case 'quarantine': {
        if (generation === this.generation) {
          this.quarantinePending(JSON.stringify(record), decision.reason)
          void this.journal.clearMatching(
            { environmentId: this.environmentId, userId: record.userId, characterId: record.characterId },
            record.mutationId,
          )
        }
        return {
          kind: 'terminal',
          result: {
            status: 'pending-quarantined',
            reason: decision.reason,
            pendingRaw: record.rawPayload,
          },
        }
      }

      case 'already-committed':
        return {
          kind: 'committed',
          committedRevision: decision.committedRevision,
          currentRevision: decision.currentRevision,
          cacheSource: decision.cachePayload,
        }
    }
  }

  /** The pending record committed during replay and is the remote head:
   *  run its bytes through the same client validation pipeline a
   *  SAVE_READY payload takes. */
  private adoptCommittedPending(
    record: PendingSaveRecord,
    committedRevision: number,
    authority?: { cutoffMs?: number; serverNowMs?: number },
  ): CloudSaveLoadResult {
    let parsed: unknown
    try {
      parsed = JSON.parse(record.rawPayload)
    } catch {
      return { status: 'corrupted', raw: record.rawPayload }
    }

    const foundVersion = typeof (parsed as { version?: unknown })?.version === 'number'
      ? (parsed as { version: number }).version
      : undefined

    if (foundVersion !== CURRENT_SAVE_VERSION || record.schemaVersion !== CURRENT_SAVE_VERSION) {
      return { status: 'incompatible', foundVersion, raw: record.rawPayload }
    }

    const shape = validateGameSaveShape(parsed)
    if (!shape.ok) {
      console.warn('[cloudSave] committed pending save failed shape validation:', shape.issues)
      return { status: 'corrupted', raw: record.rawPayload }
    }

    const normalized = shape.normalizedSave as GameSave
    if (!isSaveAcceptable(normalized, staticSaveAcceptanceCatalogs())) {
      console.warn('[cloudSave] committed pending save rejected by acceptance gate')
      return { status: 'corrupted', raw: record.rawPayload }
    }

    return {
      status: 'ok',
      save: normalized,
      revision: committedRevision,
      discardedEquipmentCount: shape.discardedEquipmentCount,
      raw: record.rawPayload,
      adoptedPending: true,
      serverAuthority:
        authority?.serverNowMs === undefined
          ? undefined
          : { cutoffMs: authority.cutoffMs, serverNowMs: authority.serverNowMs },
    }
  }

  /** A save-first path needs the character identity bound into the
   *  journal record; resolve it through the authoritative load RPC
   *  (which also re-anchors the server checkpoint). */
  private async ensureIdentityForSave(
    binding: SupabaseSaveBinding,
    generation: number,
  ): Promise<Extract<CloudSaveWriteResult, { status: 'unavailable' }> | null> {
    if (this.characterId) return null

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

    if (generation !== this.generation) {
      return unavailable('SESSION_REVOKED', 'Phiên đã đổi trong khi tải — thử lại.', false, 'STALE_GENERATION')
    }

    if (response.serverCheckpoint !== undefined) {
      this.storeCheckpoint(response.serverCheckpoint)
    }

    const character = parseRemoteCharacterMetadata(response.character)

    if (!character) {
      return response.status === 'CHARACTER_DELETED'
        ? unavailable('SERVER_ERROR', 'Nhân vật không còn trên máy chủ.', false, 'CHARACTER_DELETED')
        : unavailable('SERVER_ERROR', 'Không có nhân vật nào trên máy chủ.', false, 'NO_CHARACTER')
    }

    this.characterId = character.id
    return null
  }

  /**
   * B1-D - the active-session probe: the heartbeat RPC renews the
   *   server checkpoint lease and proves transport + auth + session-lock
   *   in ONE call. Errors keep the B1.7 taxonomy for the admission
   *   controller to classify (never collapse to a generic failure).
   */
  async heartbeat(): Promise<HeartbeatOutcome> {
    const binding = await this.binding()
    if (!binding) {
      return { status: 'unavailable', code: 'AUTH_EXPIRED', retryable: false }
    }
    try {
      const response = await this.rpc<HeartbeatResponse>(
        '/rest/v1/rpc/heartbeat_session',
        { p_session_id: binding.sessionId },
        binding.accessToken,
      )
      if (response.checkpoint !== undefined) {
        this.storeCheckpoint(response.checkpoint)
      }
      return { status: 'ok' }
    } catch (error: unknown) {
      return this.mapError(error)
    }
  }

  async readCachedSave(): Promise<{ raw: string; revision: number } | null> {
    const read = this.ackedCache.read()
    return read.status === 'ok'
      ? { raw: read.envelope.rawPayload, revision: read.envelope.revision }
      : null
  }

  async load(): Promise<CloudSaveLoadResult> {
    const generation = this.generation
    const sameGeneration = () => generation === this.generation
    let pendingReplayed = false

    // Two passes max: reconciling a pending record can end with the
    // remote head having moved past our commit - then the current row is
    // re-read instead of surfacing obsolete bytes.
    for (let attempt = 0; attempt < 2; attempt++) {
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

      if (sameGeneration() && response.serverCheckpoint !== undefined) {
        this.storeCheckpoint(response.serverCheckpoint)
      }

      const character = parseRemoteCharacterMetadata(response.character) ?? null
      if (sameGeneration() && character) this.characterId = character.id
      const userId = this.journalUserId(binding)

      const journalRead = character
        ? this.journal.read({
            environmentId: this.environmentId,
            userId,
            characterId: character.id,
          })
        : this.journal.readForUser(userId)

      if (journalRead.status === 'corrupt' || journalRead.status === 'mismatch') {
        // Corrupt bytes or a well-formed record bound to a different
        // env/user/character: neither can be replayed forward - park the
        // envelope for explicit export via the recovery surface.
        const reason = journalRead.status === 'corrupt'
          ? 'journal-envelope-corrupt'
          : 'journal-identity-mismatch'
        if (sameGeneration()) {
          this.quarantinePending(journalRead.raw, reason)
          this.journal.dropSlot()
        }
        return {
          status: 'pending-quarantined',
          reason,
          pendingRaw: journalRead.raw,
        }
      }

      const pending = journalRead.status === 'pending' && !pendingReplayed ? journalRead.record : null

      switch (response.status) {
        case 'NO_CHARACTER': {
          if (pending && sameGeneration()) {
            this.quarantinePending(JSON.stringify(pending), 'character-missing')
            void this.journal.clearMatching(
              { environmentId: this.environmentId, userId: pending.userId, characterId: pending.characterId },
              pending.mutationId,
            )
          }
          return { status: 'empty', revision: 0 }
        }

        case 'CHARACTER_UNINITIALIZED': {
          if (!character) {
            return unavailable('SERVER_ERROR', 'Máy chủ trả metadata nhân vật không hợp lệ.', false, 'CHARACTER_META_INVALID')
          }

          if (pending) {
            pendingReplayed = true
            const resolution = await this.resolvePendingAtLoad(pending, { status: 'no-save' }, binding, generation)

            if (resolution.kind === 'terminal') return resolution.result

            if (resolution.kind === 'committed') {
              if (sameGeneration()) {
                void this.journal.clearMatching(
                  { environmentId: this.environmentId, userId: pending.userId, characterId: pending.characterId },
                  pending.mutationId,
                )
              }
              if (resolution.currentRevision > resolution.committedRevision) {
                // Another writer moved the head after our commit: retrieve
                // the current row rather than surfacing the obsolete
                // pending payload.
                continue
              }
              // The pending bytes ARE the remote row now.
              if (sameGeneration()) {
                this.mirrorAcked(pending.userId, resolution.committedRevision, pending.rawPayload)
              }
              return this.adoptCommittedPending(pending, resolution.committedRevision, {
                cutoffMs: parseTimestampMs(response.save?.progressionCutoffAt),
                serverNowMs: parseTimestampMs(response.serverTimeUtc),
              })
            }
          }

          return { status: 'uninitialized', character, revision: 0 }
        }

        case 'CHARACTER_DELETED': {
          if (pending && sameGeneration()) {
            this.quarantinePending(JSON.stringify(pending), 'character-missing')
            void this.journal.clearMatching(
              { environmentId: this.environmentId, userId: pending.userId, characterId: pending.characterId },
              pending.mutationId,
            )
          }
          return { status: 'deleted', character: character ?? undefined }
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
          // is byte-level corruption preserved verbatim for recovery. A
          // retained pending record replays on the next load; the
          // recovery surface's delete path drops the envelope keys.
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

          const raw = JSON.stringify(save.payload)

          if (pending) {
            pendingReplayed = true
            const resolution = await this.resolvePendingAtLoad(
              pending,
              { status: 'save-row', currentRevision: revision },
              binding,
              generation,
            )

            if (resolution.kind === 'terminal') return resolution.result

            if (resolution.kind === 'committed' && sameGeneration()) {
              // The remote row already holds the authoritative bytes -
              // mirror IT (when the head moved past our commit the pending
              // payload is obsolete; when equal it is the same bytes).
              this.mirrorAcked(pending.userId, revision, raw)
              this.clearPending(
                { environmentId: this.environmentId, userId: pending.userId, characterId: pending.characterId },
                pending.mutationId,
              )
            }
          }

          // B1.5 - a downloaded payload passes the SAME client pipeline the
          // local adapter runs: version gate -> shape validation ->
          // normalization -> acceptance. A payload the server committed but
          // this build cannot consume is contract drift, surfaced as
          // incompatible/corrupted with raw preserved for recovery.
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

          if (sameGeneration()) {
            this.mirrorAcked(userId, revision, raw, response.serverTimeUtc)
          }
          const serverNowMs = parseTimestampMs(response.serverTimeUtc)
          return {
            status: 'ok',
            save: normalized,
            revision,
            discardedEquipmentCount: shape.discardedEquipmentCount,
            raw,
            serverAuthority: serverNowMs === undefined
              ? undefined
              : {
                  cutoffMs: parseTimestampMs(save.progressionCutoffAt),
                  serverNowMs,
                },
          }
        }

        default:
          return unavailable('SERVER_ERROR', 'Máy chủ trả trạng thái không nhận diện được.', false, String(response.status))
      }
    }

    // Unreachable in practice - the loop only continues once after an
    // already-committed replay and the re-read always returns.
    return unavailable('SERVER_ERROR', 'Tải save không hội tụ được.', false, 'LOAD_EXHAUSTED')
  }

  async save(save: GameSave, expectedRevision: number): Promise<CloudSaveWriteResult> {
    const generation = this.generation
    const binding = await this.binding()

    if (!binding) {
      return unavailable('AUTH_EXPIRED', 'Phiên đăng nhập đã hết hạn — đăng nhập lại để tiếp tục.', false)
    }

    const identityFailure = await this.ensureIdentityForSave(binding, generation)
    if (identityFailure) return identityFailure

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

        if (generation === this.generation && heartbeat.checkpoint) {
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
      // elapsed_monotonic_ms is a bigint column: the monotonic clock is a
      // float (performance.now), so the offset must be truncated to whole
      // ms or the server rejects it as CHECKPOINT_INVALID.
      elapsedMonotonicMs: Math.max(0, Math.floor(this.monotonicNow() - checkpoint.receivedAtMonotonicMs)),
    }

    if (generation !== this.generation) {
      // The checkpoint/identity the awaits above may have re-read belongs
      // to a NEW generation - a stale save must not journal or write a
      // remote mutation under borrowed identity.
      return unavailable('SERVER_ERROR', 'Save dropped: the session was reset while saving.', false, 'STALE_GENERATION')
    }

    const userId = this.journalUserId(binding)
    const envelopeBinding = this.envelopeBinding(userId)
    const rawPayload = JSON.stringify(save)

    // Journal-first (WAL): the record carries the same mutation id and
    // frozen checkpoint the RPC below sends. An unjournaled write could
    // never be recovered after a lost ACK, so a journal failure aborts
    // the transport attempt entirely - remote is never touched.
    const pending = buildPendingSaveRecord({
      environmentId: this.environmentId,
      userId,
      characterId: envelopeBinding.characterId,
      mutationId: crypto.randomUUID(),
      baseRevision: expectedRevision,
      timeCheckpoint,
      schemaVersion: this.build.saveSchemaVersion,
      buildId: this.build.buildId,
      createdAtUtc: this.nowIso(),
      rawPayload,
    })

    const put = this.journal.put(pending)
    if (put.status === 'error') {
      return unavailable(
        'SERVER_ERROR',
        'Không ghi được nhật ký save tạm — tiến trình chưa được gửi.',
        false,
        `PENDING_JOURNAL_${put.reason.toUpperCase()}`,
      )
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
          p_mutation_id: pending.mutationId,
          p_time_checkpoint: timeCheckpoint,
        },
        binding.accessToken,
      )
    } catch (error: unknown) {
      // Lost response or transport failure: the pending record stays in
      // the journal; the next authoritative load replays the same
      // mutation and the server resolves it as alreadyCommitted.
      return this.mapError(error)
    }

    switch (response.status) {
      case 'COMMITTED': {
        const committed = response.committedRevision

        if (typeof committed !== 'number' || !Number.isSafeInteger(committed) || committed < 0) {
          return unavailable('SERVER_ERROR', 'Máy chủ xác nhận save nhưng revision không hợp lệ.', false, 'COMMITTED_MALFORMED')
        }

        const current = typeof response.currentRevision === 'number' ? response.currentRevision : committed

        if (generation !== this.generation) {
          // reset/logout/user-switch resolved mid-flight: the server ACK
          // stands (the write committed) but the old generation may not
          // touch the journal/cache. The retained record self-heals as
          // alreadyCommitted on the next authoritative load.
          return { status: 'ok', revision: current, storageWarning: 'stale-generation' }
        }

        const warnings: string[] = []

        if (current > committed) {
          // A writer landed between our commit and the receipt: the
          // pending bytes are already obsolete - retrieve the current
          // row rather than caching them.
          try {
            const fresh = await this.rpc<LoadGameStateResponse>(
              '/rest/v1/rpc/load_game_state',
              { p_session_id: binding.sessionId },
              binding.accessToken,
            )
            const freshRevision = fresh.save?.saveRevision
            if (
              generation === this.generation
              && fresh.status === 'SAVE_READY'
              && typeof freshRevision === 'number'
              && Number.isSafeInteger(freshRevision)
            ) {
              const warning = this.mirrorAcked(userId, freshRevision, JSON.stringify(fresh.save?.payload), fresh.serverTimeUtc)
              if (warning) warnings.push(warning)
              if (fresh.serverCheckpoint !== undefined) this.storeCheckpoint(fresh.serverCheckpoint)
            } else {
              warnings.push('refresh-failed')
            }
          } catch {
            warnings.push('refresh-failed')
          }
        } else {
          const warning = this.mirrorAcked(userId, committed, rawPayload, response.serverTimeUtc)
          if (warning) warnings.push(warning)
        }

        const clearWarning = this.clearPending(envelopeBinding, pending.mutationId)
        if (clearWarning) warnings.push(clearWarning)

        return {
          status: 'ok',
          revision: current,
          storageWarning: warnings.length ? warnings.join(';') : undefined,
        }
      }

      case 'CONFLICT':
        // remote-authoritative (B1.6): terminal - the coordinator returns
        // this unchanged; there is no load-latest/retry-overwrite path.
        // The journal record stays so the next load's replay can decide
        // whether our mutation ever landed.
        return {
          status: 'conflict',
          currentRevision: typeof response.currentRevision === 'number' ? response.currentRevision : expectedRevision,
        }

      case 'REJECTED': {
        // The server settled this mutation's fate: it can never commit.
        // Drop the just-written pending record - nothing to recover.
        if (generation === this.generation) {
          void this.journal.clearMatching(envelopeBinding, pending.mutationId)
        }
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
      }

      default:
        return unavailable('SERVER_ERROR', 'Máy chủ trả trạng thái không nhận diện được.', false, String(response.status))
    }
  }
}
