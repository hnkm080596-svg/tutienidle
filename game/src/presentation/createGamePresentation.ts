/**
 * createGamePresentation (AstraDoctrine Law A5, AGENTS.md P17).
 * Application command facade and admission manager.
 *
 * Invariant:
 * - Synchronous reservation before invoking start command.
 * - If locked, rejected without invoking callback.
 * - Callback returning null releases reservation and retains current UI.
 * - Buffered notification bridge dedupes session with reservation.
 * - External session start is observed and transitioned without racing.
 */

import type { SessionRef } from '../core/presentation/PresentationSession'
import type {
  CoordinatorSnapshot,
  RouteRequest,
  TransitionResult,
} from './PresentationContracts'
import { GamePresentationCoordinator } from './GamePresentationCoordinator'

export interface EventBusLike {
  on<T>(event: string, handler: (e: T) => void): void
  off<T>(event: string, handler: (e: T) => void): void
}

export interface GamePresentationDeps {
  coordinator: GamePresentationCoordinator
  eventBus?: EventBusLike
  getCurrentSession?: () => SessionRef | null
}

export interface AdmittedCommandOptions {
  /**
   * Undoes the domain command when it was accepted but the route could not be
   * entered at all (status 'rejected' - no transition ran, so nothing holds or
   * renders the session). NOT called for 'failed': a failed transition holds a
   * valid session and the error shell offers retry, so undoing it there would
   * destroy recoverable progress.
   */
  compensate?: () => void
}

export interface GamePresentation {
  readonly coordinator: GamePresentationCoordinator
  runAdmitted(
    target: RouteRequest['target'],
    command: () => RouteRequest | null,
    options?: AdmittedCommandOptions,
  ): Promise<TransitionResult>
  getSnapshot(): CoordinatorSnapshot
  subscribe(listener: (snapshot: CoordinatorSnapshot) => void): () => void
  dispose(): void
}

export function createGamePresentation(deps: GamePresentationDeps): GamePresentation {
  const coordinator = deps.coordinator
  const eventBus = deps.eventBus

  let isAdmitting = false
  let reservedSessionId: number | null = null
  const handledSessionIds = new Set<number>()

  const handleSessionStarted = (session: SessionRef) => {
    if (handledSessionIds.has(session.sessionId)) {
      return
    }

    if (isAdmitting) {
      reservedSessionId = session.sessionId
      handledSessionIds.add(session.sessionId)
      return
    }

    if (reservedSessionId === session.sessionId) {
      return
    }

    handledSessionIds.add(session.sessionId)
    void coordinator.request({ target: session.kind, session })
  }

  // Subscribe first to catch notifications
  if (eventBus) {
    eventBus.on<SessionRef>('presentation_session_started', handleSessionStarted)
  }

  // Query second to recover any already-active session
  if (deps.getCurrentSession) {
    const current = deps.getCurrentSession()
    if (current && !handledSessionIds.has(current.sessionId)) {
      handleSessionStarted(current)
    }
  }

  async function runAdmitted(
    target: RouteRequest['target'],
    command: () => RouteRequest | null,
    options: AdmittedCommandOptions = {},
  ): Promise<TransitionResult> {
    const rejected = (): TransitionResult => ({
      status: 'rejected',
      transitionId: coordinator.getSnapshot().transitionId,
    })

    if (isAdmitting) {
      return rejected()
    }

    // Admission is decided BEFORE the domain command runs. Asking the
    // coordinator afterwards is what allowed an accepted start (stage running,
    // gear unequipped, session held) to be orphaned by a route the coordinator
    // was never going to allow.
    if (!coordinator.canEnter(target)) {
      return rejected()
    }

    isAdmitting = true
    let accepted: RouteRequest | null = null

    // Runs behind the closed curtain (GamePresentationCoordinator.executeTransition),
    // after admission is already decided above. A combat -> combat refight is a
    // transition against a renderer that is already live, so running the domain
    // command before the transition (as this used to) reset the battle in full view.
    const behindCurtain = (): boolean => {
      try {
        accepted = command()
      } catch {
        accepted = null
      }

      if (accepted && 'session' in accepted && accepted.session) {
        reservedSessionId = accepted.session.sessionId
        handledSessionIds.add(accepted.session.sessionId)
      }

      return accepted !== null
    }

    // Narrowing target per-branch (rather than one `{ target, behindCurtain }`
    // literal) lets each branch structurally satisfy RouteRequest on its own -
    // the combat/tribulation arm has no `session` field (behindCurtain is its
    // only source of one), so a single literal typed against the full
    // RouteRequest['target'] union would need an `as RouteRequest` cast.
    let request: RouteRequest
    if (target === 'combat' || target === 'tribulation') {
      request = { target, behindCurtain }
    } else {
      request = { target, behindCurtain }
    }

    let result: TransitionResult
    try {
      result = await coordinator.request(request)
    } finally {
      isAdmitting = false
      reservedSessionId = null
    }

    if (result.status === 'rejected' && accepted) {
      // Unreachable while canEnter and request agree, but an accepted domain
      // command with no transition is the one outcome that must never survive
      // silently - the session would run held and unrendered forever.
      forgetSession(accepted)
      options.compensate?.()
    }

    return result
  }

  function forgetSession(request: RouteRequest): void {
    if ('session' in request && request.session) {
      handledSessionIds.delete(request.session.sessionId)
    }
  }

  function dispose(): void {
    if (eventBus) {
      eventBus.off<SessionRef>('presentation_session_started', handleSessionStarted)
    }
    coordinator.dispose()
  }

  return {
    coordinator,
    runAdmitted,
    getSnapshot: () => coordinator.getSnapshot(),
    subscribe: (listener) => coordinator.subscribe(listener),
    dispose,
  }
}
