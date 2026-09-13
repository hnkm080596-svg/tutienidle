/**
 * PresentationSession primitive (AstraDoctrine Law A3, AGENTS.md P17).
 * Owns presentation session identity, generation tokens, and holding/attachment state.
 *
 * Core invariant:
 * - Domain session ID is allocated monotonically across GameManager lifetime.
 * - Interactive hold generation increments on each hold/re-hold attempt.
 * - Interactive sessions start held before they can tick.
 * - Presentation must attach before it can release.
 * - Release unblocks the interactive hold.
 * - Failure detach retains hold semantics; headless detach explicitly switches to headless.
 * - Queries are observational and never mutate readiness.
 */

export type SessionKind = 'combat' | 'tribulation'

export type PresentationMode = 'headless' | 'interactive'

export type SessionRef = Readonly<{
  kind: SessionKind
  sessionId: number
}>

export type PresentationHold = Readonly<{
  sessionId: number
  generation: number
}>

export interface SessionPresentationPort {
  /**
   * Recovery query: "any active session of any kind". Retained for the
   * buffered presentation_session_started recovery path only - it is NOT an
   * identity source for a transition that already knows which session it
   * committed to (that identity arrives on the accepted RouteRequest).
   */
  getCurrentSession(): SessionRef | null
  /**
   * Identity-scoped liveness check: is THIS exact session (kind + id) still
   * the live session of its own kind? retry() validates a recorded
   * failedRequest through this instead of an ambient unscoped read, which can
   * return a DIFFERENT kind's retained session.
   */
  isCurrentSession(session: SessionRef): boolean
  hold(session: SessionRef): PresentationHold | null
  attach(token: PresentationHold): boolean
  release(token: PresentationHold): boolean
  detach(token: PresentationHold, policy: 'hold' | 'headless'): boolean
}

export class SessionAllocator {
  private seq = 0

  allocate(): number {
    this.seq += 1
    return this.seq
  }
}

export class PresentationSession implements SessionPresentationPort {
  private currentSession: SessionRef | null = null
  private mode: PresentationMode = 'headless'
  private currentGeneration = 0
  private held = false
  private attached = false
  private released = false

  constructor(private readonly allocator: { allocate(): number } = new SessionAllocator()) {}

  allocate(): number {
    return this.allocator.allocate()
  }

  getCurrentSession(): SessionRef | null {
    return this.currentSession
  }

  isCurrentSession(session: SessionRef): boolean {
    return (
      this.currentSession !== null &&
      this.currentSession.sessionId === session.sessionId &&
      this.currentSession.kind === session.kind
    )
  }

  getMode(): PresentationMode {
    return this.mode
  }

  getGeneration(): number {
    return this.currentGeneration
  }

  begin(session: SessionRef, mode: PresentationMode): void {
    if (this.currentSession && (this.currentSession.sessionId !== session.sessionId || this.currentSession.kind !== session.kind)) {
      this.end(this.currentSession)
    }

    this.currentSession = session
    this.mode = mode
    this.currentGeneration = 0
    this.attached = false
    this.released = false
    this.held = mode === 'interactive'
  }

  hold(session: SessionRef): PresentationHold | null {
    if (
      !this.currentSession ||
      this.currentSession.sessionId !== session.sessionId ||
      this.currentSession.kind !== session.kind
    ) {
      return null
    }

    this.currentGeneration += 1
    this.held = true
    this.attached = false
    this.released = false

    return {
      sessionId: session.sessionId,
      generation: this.currentGeneration,
    }
  }

  attach(token: PresentationHold): boolean {
    if (!this.isValidToken(token)) {
      return false
    }

    this.attached = true
    return true
  }

  release(token: PresentationHold): boolean {
    if (!this.isValidToken(token) || !this.attached) {
      return false
    }

    this.released = true
    this.held = false
    return true
  }

  detach(token: PresentationHold, policy: 'hold' | 'headless'): boolean {
    if (!this.isValidToken(token)) {
      return false
    }

    if (policy === 'hold') {
      this.attached = false
      this.held = true
      this.released = false
      return true
    }

    if (policy === 'headless') {
      this.mode = 'headless'
      this.attached = false
      this.held = false
      this.released = true
      return true
    }

    return false
  }

  end(session: SessionRef): void {
    if (
      this.currentSession &&
      this.currentSession.sessionId === session.sessionId &&
      this.currentSession.kind === session.kind
    ) {
      this.currentSession = null
      this.held = false
      this.attached = false
      this.released = false
      this.currentGeneration = 0
    }
  }

  isBlocking(): boolean {
    if (this.mode === 'headless') {
      return false
    }

    if (!this.currentSession) {
      return false
    }

    return this.held || !this.released
  }

  private isValidToken(token: PresentationHold): boolean {
    if (!this.currentSession) {
      return false
    }

    // Generation 0 means "no hold has been taken on this session yet", so no
    // token can be current. Without this, a fabricated {generation: 0} token
    // would validate against a freshly begun session.
    if (this.currentGeneration === 0) {
      return false
    }

    return (
      token.sessionId === this.currentSession.sessionId &&
      token.generation === this.currentGeneration
    )
  }
}
