import type { BackendErrorCode } from './BackendStatus'
import type { CloudSaveWriteResult } from '../cloudSave/CloudSaveService'
import type { GameSave } from '../save/SaveSystem'
import type { FlushResult } from '../../shared/session/FlushResult'

/**
 * B1-D (beta-final PR5) - the online-admission authority. One instance owns
 * every decision about whether the client may mutate: the tick loop, the
 * autosave, the combat clock and every command consult `canMutate()` before
 * doing work. The controller drives the 30s heartbeat probe, the <=40s
 * health lease, the spec-ordered reconnect pipeline and the result-bearing
 * flush used by quit/update/logout.
 *
 * States:
 * - 'signed-out'   : no active game session admitted.
 * - 'checking'     : boot admission (auth/session/compatibility/load/
 *                    pending/restore/durability) in progress.
 * - 'ready'        : admitted - mutation is permitted inside the health lease.
 * - 'reconnecting' : paused after an OBSERVED authority loss; auto-retries
 *                    the spec-ordered reconnect pipeline.
 * - terminal       : 'revoked' | 'conflict' | 'recovery' | 'maintenance' |
 *                    'update-required' - stay until an owned acknowledgement
 *                    returns the user to auth.
 *
 * Remote authority only: in local/mock mode probe/reconnect are absent,
 * admission reaches 'ready' directly and no heartbeat is armed; pause(),
 * the mutation gate, suspend/resume and flush() still work uniformly.
 */

export type AuthorityState =
  | 'signed-out'
  | 'checking'
  | 'ready'
  | 'reconnecting'
  | 'conflict'
  | 'revoked'
  | 'recovery'
  | 'maintenance'
  | 'update-required'

export type PauseReason =
  | 'heartbeat-timeout'
  | 'heartbeat-failed'
  | 'save-failed'
  | 'health-lease-expired'
  | 'suspend'
  | 'terminal'

export type ReconnectOutcome =
  | {
      status: 'resumed'
      lineage: 'same' | 'replaced'
      /** 'replaced' lineage hands the authoritative payload back: the
       *  caller restores queues/jobs from it WITHOUT catch-up
       *  (zero-accrual live replacement, B1-D). */
      save?: GameSave
      /** Server clock bound from the reconnect load (ms epoch). */
      serverAuthority?: { cutoffMs?: number; serverNowMs: number }
    }
  | { status: 'unavailable' }
  | { status: 'terminal'; state: AuthorityState }

export interface ProbeOutcome {
  status: 'ok' | 'unavailable'
  code?: BackendErrorCode
  retryable?: boolean
}

export interface OnlineSessionControllerDeps {
  /** One authenticated probe of the active session (the heartbeat RPC).
   *  Absent in local/mock mode - no heartbeat is armed and the health
   *  lease stays unbounded. */
  probe?: () => Promise<ProbeOutcome>
  /** The spec-ordered reconnect pipeline: regain transport, refresh auth,
   *  heartbeat the active session, load the authoritative revision,
   *  reconcile the pending journal, restore or confirm one coherent state. */
  reconnect?: () => Promise<ReconnectOutcome>
  /** The ONE save queue - joins/drains it for flush(). */
  flushSave?: () => Promise<CloudSaveWriteResult>
  monotonicNow: () => number
  scheduleInterval: (callback: () => void, timeoutMs: number) => number
  clearHandle: (handle: number) => void
  /** Fires once per transition out of 'ready' - pauses the simulation. */
  onPause?: (reason: PauseReason) => void
  /** Fires when the authority is 'ready' again after a reconnect;
   *  'replaced' lineage carries the authoritative payload the caller
   *  must live-restore (zero-accrual) before resuming the sim. */
  onResume?: (
    lineage: 'same' | 'replaced',
    save?: GameSave,
    serverAuthority?: { cutoffMs?: number; serverNowMs: number },
  // Awaited: an async implementation's rejection is classified by the
  // same catch path a synchronous throw takes, and markReady waits for
  // the restore to actually land (W7-COR-4).
  ) => void | Promise<void>
  onStateChange?: (state: AuthorityState) => void
  heartbeatIntervalMs?: number
  healthLeaseMs?: number
  reconnectRetryMs?: number
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000
const DEFAULT_HEALTH_LEASE_MS = 40_000
const DEFAULT_RECONNECT_RETRY_MS = 10_000
/** Consecutive onResume throws before a deterministic resume fault
 *  escalates from 'reconnecting' (retry-forever) to 'recovery'. */
const RESUME_FAILURE_BUDGET = 3

const TERMINAL_STATES: ReadonlySet<AuthorityState> = new Set([
  'conflict',
  'revoked',
  'recovery',
  'maintenance',
  'update-required',
])

/** Maps a backend error code onto the authority state the failure implies. */
export function authorityStateForError(code: BackendErrorCode | undefined): AuthorityState {
  switch (code) {
    case 'SESSION_REVOKED':
      return 'revoked'
    case 'SAVE_CONFLICT':
      return 'conflict'
    case 'PROTOCOL_OUTDATED':
      return 'update-required'
    case 'MAINTENANCE':
      return 'maintenance'
    case 'SAVE_INVALID':
    case 'SAVE_TOO_LARGE':
    case 'CONFIGURATION_ERROR':
      return 'recovery'
    default:
      // NETWORK_UNAVAILABLE, SERVER_ERROR, AUTH_EXPIRED (retryable) and
      // unknown codes are transient: pause and reconnect.
      return 'reconnecting'
  }
}

export function createOnlineSessionController(
  deps: OnlineSessionControllerDeps,
): OnlineSessionController {
  return new OnlineSessionController(deps)
}

export class OnlineSessionController {
  private state: AuthorityState = 'signed-out'
  /** Epoch counter - bumps on every invalidating transition so an async
   *  continuation that outlives the transition (heartbeat result, flush
   *  resolve, reconnect outcome) can never settle into the wrong state. */
  private generation = 0
  /** Monotonic deadline for the health lease (<=40s after the last
   *  successful authenticated operation). Infinity while no probe exists. */
  private healthDeadlineMs = Number.POSITIVE_INFINITY
  private heartbeatHandle: number | undefined
  private retryHandle: number | undefined
  private reconnectInFlight = false
  private resumeFailureStreak = 0

  private readonly heartbeatIntervalMs: number
  private readonly healthLeaseMs: number
  private readonly reconnectRetryMs: number

  constructor(private readonly deps: OnlineSessionControllerDeps) {
    this.heartbeatIntervalMs = deps.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
    this.healthLeaseMs = deps.healthLeaseMs ?? DEFAULT_HEALTH_LEASE_MS
    this.reconnectRetryMs = deps.reconnectRetryMs ?? DEFAULT_RECONNECT_RETRY_MS
  }

  get authorityState(): AuthorityState {
    return this.state
  }

  get currentGeneration(): number {
    return this.generation
  }

  /**
   * The mutation gate every clock/command consults. 'ready' inside the
   * health lease is the only yes - an expired lease is itself an observed
   * authority loss and pauses immediately (B1.7: silent packet drop is
   * unknowable until the deadline).
   */
  canMutate(): boolean {
    if (this.state !== 'ready') {
      return false
    }
    if (this.deps.monotonicNow() >= this.healthDeadlineMs) {
      this.pause('health-lease-expired')
      return false
    }
    return true
  }

  /** Boot-admission entry: signed-out/recovery/reconnecting -> checking. */
  beginChecking(): void {
    if (
      this.state === 'ready'
      || this.state === 'checking'
      || (TERMINAL_STATES.has(this.state) && this.state !== 'recovery')
    ) {
      return
    }
    this.generation++
    // A fresh admission owns a fresh resume-failure budget - a prior
    // session's throws must not shorten this one's retry runway.
    this.resumeFailureStreak = 0
    this.transition('checking')
  }

  /** Admission checks passed: renew the lease and arm the heartbeat. */
  markReady(): void {
    this.renewHealthLease()
    this.transition('ready')
    this.armHeartbeat()
    this.clearRetry()
  }

  /** A boot admission check failed - record the failure class. The boot
   *  error surface owns the retry UX; 'reconnecting' here is bookkeeping
   *  only (no auto-retry while no simulation is running to pause). */
  markFailed(code: BackendErrorCode | 'recovery' | undefined): void {
    const mapped = code === 'recovery' ? 'recovery' : authorityStateForError(code)
    if (mapped === 'reconnecting') {
      this.generation++
      this.transition('reconnecting')
      return
    }
    this.enterTerminal(mapped)
  }

  /** Reversible pause - 'ready' -> 'reconnecting': the simulation stops,
   *  the generation bumps (in-flight continuations become stale), and the
   *  spec-ordered reconnect pipeline starts auto-retrying. Distinct from
   *  stopAll(), which is terminal teardown. */
  pause(reason: PauseReason): void {
    if (this.state !== 'ready') {
      return
    }
    this.generation++
    this.transition('reconnecting')
    this.clearHeartbeat()
    this.deps.onPause?.(reason)
    this.armRetry()
    if (this.deps.reconnect) {
      void this.attemptReconnect()
    }
  }

  /** OS suspend observed - invalidates admission immediately. Resume must
   *  revalidate before any simulation continues. */
  suspend(): void {
    if (this.state === 'ready') {
      this.pause('suspend')
    }
  }

  /** OS resume observed - revalidates now rather than waiting on the retry
   *  cadence; clocks re-anchor through onResume so the paused delta is
   *  discarded. */
  resumeFromSuspend(): void {
    if (this.state === 'reconnecting') {
      void this.attemptReconnect()
    }
  }

  /** A save outcome flowed through the queue: 'ok' renews freshness;
   *  failure pauses or terminates admission by its error class. */
  observeSaveResult(result: CloudSaveWriteResult): void {
    if (result.status === 'ok') {
      this.renewHealthLease()
      return
    }
    const code: BackendErrorCode | undefined =
      result.status === 'conflict'
        ? 'SAVE_CONFLICT'
        : result.status === 'unavailable'
          ? result.code
          : undefined
    if (!this.deps.reconnect) {
      // Local-only mode has no authority to lose: a failed write is the
      // caller's own error surface, never an admission transition.
      return
    }
    if (code === 'AUTH_EXPIRED' && result.status === 'unavailable' && result.retryable === false) {
      // No credential left to retry with - the only owned path is re-auth.
      this.enterTerminal('revoked')
      return
    }
    const mapped = authorityStateForError(code)
    if (mapped === 'reconnecting') {
      this.pause('save-failed')
    } else {
      this.enterTerminal(mapped)
    }
  }

  /** Renew the freshness deadline after a successful authenticated op
   *  (heartbeat or save). Without a probe the lease is unbounded. */
  notifyWriteAck(): void {
    this.renewHealthLease()
  }

  /**
   * The one result-bearing flush (B1.9a): joins the save queue, waits for
   * the remote ACK, and reports a request/generation-bound result.
   * 'blocked' = authority forbids the write outright (terminal state or
   * signed out); 'failed' = the write was attempted and lost; a stale
   * generation never reports 'saved'.
   */
  async flush(requestId: string): Promise<FlushResult> {
    const generation = this.generation

    if (!this.deps.flushSave || TERMINAL_STATES.has(this.state) || this.state === 'signed-out') {
      return { status: 'blocked', requestId, generation, code: `AUTHORITY_${this.state.toUpperCase()}` }
    }

    try {
      const result = await this.deps.flushSave()
      if (generation !== this.generation) {
        return { status: 'failed', requestId, generation: this.generation, code: 'STALE_GENERATION' }
      }
      if (result.status === 'ok') {
        this.renewHealthLease()
        return { status: 'saved', requestId, generation, revision: result.revision }
      }
      const code =
        result.status === 'conflict' ? 'SAVE_CONFLICT' : result.code ?? 'FLUSH_FAILED'
      return { status: 'failed', requestId, generation, code }
    } catch {
      return { status: 'failed', requestId, generation: this.generation, code: 'FLUSH_FAILED' }
    }
  }

  /** Owned acknowledgement - the only path back to auth. Terminal states
   *  require it; 'reconnecting' also accepts it as the explicit give-up
   *  escape (the retry cadence and any in-flight pipeline die here). */
  acknowledge(): void {
    if (!TERMINAL_STATES.has(this.state) && this.state !== 'reconnecting') {
      return
    }
    this.generation++
    this.resumeFailureStreak = 0
    this.clearHeartbeat()
    this.clearRetry()
    this.transition('signed-out')
  }

  /** Terminal teardown: every timer cleared, generation bumped so pending
   *  continuations die stale. Idempotent; NOT the same as pause(). */
  stopAll(): void {
    this.generation++
    this.clearHeartbeat()
    this.clearRetry()
    this.transition('signed-out')
  }

  private transition(next: AuthorityState): void {
    if (this.state === next) {
      return
    }
    this.state = next
    this.deps.onStateChange?.(next)
  }

  private enterTerminal(state: AuthorityState): void {
    if (!TERMINAL_STATES.has(state)) {
      return
    }
    this.generation++
    this.transition(state)
    this.clearHeartbeat()
    this.clearRetry()
    // Terminal states still freeze the simulation until the owned
    // acknowledgement; onPause is idempotent on the lifecycle side.
    this.deps.onPause?.('terminal')
  }

  private renewHealthLease(): void {
    this.healthDeadlineMs = this.deps.probe
      ? this.deps.monotonicNow() + this.healthLeaseMs
      : Number.POSITIVE_INFINITY
  }

  private armHeartbeat(): void {
    if (this.heartbeatHandle !== undefined || !this.deps.probe) {
      return
    }
    this.heartbeatHandle = this.deps.scheduleInterval(
      () => void this.heartbeatTick(),
      this.heartbeatIntervalMs,
    )
  }

  private clearHeartbeat(): void {
    if (this.heartbeatHandle !== undefined) {
      this.deps.clearHandle(this.heartbeatHandle)
      this.heartbeatHandle = undefined
    }
  }

  private async heartbeatTick(): Promise<void> {
    const generation = this.generation
    if (this.state !== 'ready' || !this.deps.probe) {
      return
    }

    // Lease watchdog: the deadline expiring between ticks is itself an
    // observed loss - pause before another probe can silently succeed.
    if (this.deps.monotonicNow() >= this.healthDeadlineMs) {
      this.pause('health-lease-expired')
      return
    }

    try {
      const outcome = await this.deps.probe()
      if (generation !== this.generation) {
        return
      }
      if (outcome.status === 'ok') {
        this.renewHealthLease()
        return
      }
      if (outcome.code === 'AUTH_EXPIRED' && outcome.retryable === false) {
        this.enterTerminal('revoked')
        return
      }
      const mapped = authorityStateForError(outcome.code)
      if (mapped === 'reconnecting') {
        this.pause('heartbeat-failed')
      } else {
        this.enterTerminal(mapped)
      }
    } catch {
      if (generation !== this.generation) {
        return
      }
      this.pause('heartbeat-timeout')
    }
  }

  private armRetry(): void {
    if (this.retryHandle !== undefined || !this.deps.reconnect) {
      return
    }
    this.retryHandle = this.deps.scheduleInterval(
      () => void this.attemptReconnect(),
      this.reconnectRetryMs,
    )
  }

  private clearRetry(): void {
    if (this.retryHandle !== undefined) {
      this.deps.clearHandle(this.retryHandle)
      this.retryHandle = undefined
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectInFlight) {
      return
    }
    const generation = this.generation
    // The in-flight guard covers BOTH branches: the contract now admits
    // Promise-returning onResume, and even a synchronous one suspends to
    // a microtask inside the await - a suspend/resume burst in that
    // window must not re-enter a pending restore (W8-COR-3).
    this.reconnectInFlight = true
    if (!this.deps.reconnect) {
      // markReady runs only after onResume finishes: a throwing resume
      // must not leave a 'ready' session whose restore never landed.
      // The generation guard also lets a rejecting resume (markFailed
      // inside onResume) win - the failure stays authoritative. A throw
      // (from onResume or from markReady's own state-change fan-out) is
      // classified like 'unavailable': stay 'reconnecting' until the
      // resume-failure budget escalates a deterministic thrower to
      // 'recovery' - gated on the same generation so a deliberate exit
      // parked inside onResume is not dragged back out.
      try {
        await this.deps.onResume?.('same')
        this.resumeFailureStreak = 0
        if (generation === this.generation) {
          this.markReady()
        }
      } catch {
        this.resumeFailureStreak++
        if (this.resumeFailureStreak >= RESUME_FAILURE_BUDGET && generation === this.generation) {
          this.markFailed('recovery')
        }
      } finally {
        this.reconnectInFlight = false
      }
      return
    }

    try {
      const outcome = await this.deps.reconnect()
      if (generation !== this.generation) {
        return
      }
      if (outcome.status === 'resumed') {
        // Same ordering: resume restores state first; only then may the
        // mutation gate open. A throw is classified 'unavailable' -
        // the session stays 'reconnecting' and retries - but a
        // deterministic thrower hits the resume-failure budget and
        // escalates to 'recovery' instead of churning the reconnect
        // RPC forever, under the same generation fence the success path
        // applies. A rejecting resume calls markFailed (which bumps
        // generation), so only an untouched controller earns markReady.
        try {
          await this.deps.onResume?.(outcome.lineage, outcome.save, outcome.serverAuthority)
          this.resumeFailureStreak = 0
          if (generation === this.generation) {
            this.markReady()
          }
        } catch {
          this.resumeFailureStreak++
          if (this.resumeFailureStreak >= RESUME_FAILURE_BUDGET && generation === this.generation) {
            this.markFailed('recovery')
          }
        }
        return
      }
      this.resumeFailureStreak = 0
      if (outcome.status === 'terminal') {
        this.enterTerminal(outcome.state)
      }
      // 'unavailable' stays 'reconnecting' - the retry interval fires again.
    } catch {
      // A throwing pipeline is classified 'unavailable' too - but an
      // always-throwing reconnect dep would churn the RPC cadence
      // forever, so it shares the resume-failure budget.
      this.resumeFailureStreak++
      if (this.resumeFailureStreak >= RESUME_FAILURE_BUDGET && generation === this.generation) {
        this.markFailed('recovery')
      }
    } finally {
      this.reconnectInFlight = false
    }
  }
}
