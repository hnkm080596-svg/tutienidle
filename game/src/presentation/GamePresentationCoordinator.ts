/**
 * GamePresentationCoordinator (AstraDoctrine Law A5, AGENTS.md P17).
 * Sole owner of presentation routing, transitions, and phase deadlines.
 *
 * Sequence:
 *   validate/admit -> hold session -> close curtain -> ensure host/assets ->
 *   deactivate prior -> set renderRoute -> prepare/READY ->
 *   commit currentRoute/attach -> open curtain -> release runtime -> idle.
 */

import type {
  PresentationHold,
  SessionPresentationPort,
  SessionRef,
} from '../core/presentation/PresentationSession'
import type {
  AssetPort,
  BootSubphase,
  CoordinatorError,
  CoordinatorSnapshot,
  CurtainPort,
  DeadlineScheduler,
  Phase,
  RendererPort,
  Route,
  RouteRequest,
  TransitionResult,
} from './PresentationContracts'

export const DEADLINES = {
  curtainClose: 2_000,
  curtainOpen: 2_000,
  assets: 30_000,
  deactivate: 10_000,
  prepareReady: 10_000,
} as const

export const defaultDeadlineScheduler: DeadlineScheduler = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

const ALLOWED_EDGES: Record<Route, readonly Route[]> = {
  boot: ['auth', 'character', 'home', 'error'],
  auth: ['boot', 'character', 'home', 'error'],
  character: ['auth', 'boot', 'home', 'error'],
  home: ['combat', 'tribulation', 'auth', 'error'],
  combat: ['home', 'combat', 'error'],
  tribulation: ['home', 'error'],
  error: ['boot', 'auth', 'character', 'home', 'combat', 'tribulation', 'error'],
}

export interface CoordinatorDeps {
  sessionPort: SessionPresentationPort
  renderer: RendererPort
  curtain: CurtainPort
  assets: AssetPort
  scheduler?: DeadlineScheduler
  initialRoute?: Route
  initialBootSubphase?: BootSubphase
  initialShowMainMenu?: boolean
}

export class GamePresentationCoordinator {
  private currentRoute: Route = 'boot'
  private renderRoute: Route | null = null
  private targetRoute: Route | null = null
  private currentSession: SessionRef | null = null
  private targetSession: SessionRef | null = null
  private phase: Phase = 'idle'
  private currentTransitionId = 0
  private nextTransitionId = 0
  private bootSubphase: BootSubphase = 'intro'
  private showMainMenu = false
  private error: CoordinatorError | null = null

  private readonly sessionPort: SessionPresentationPort
  private readonly renderer: RendererPort
  private readonly curtain: CurtainPort
  private readonly assets: AssetPort
  private readonly scheduler: DeadlineScheduler

  private readonly listeners = new Set<(snapshot: CoordinatorSnapshot) => void>()
  private inFlightRequest: RouteRequest | null = null
  private inFlightPromise: Promise<TransitionResult> | null = null
  private currentAbortController: AbortController | null = null
  private disposed = false

  constructor(deps: CoordinatorDeps) {
    this.sessionPort = deps.sessionPort
    this.renderer = deps.renderer
    this.curtain = deps.curtain
    this.assets = deps.assets
    this.scheduler = deps.scheduler ?? defaultDeadlineScheduler
    this.currentRoute = deps.initialRoute ?? 'boot'
    this.bootSubphase = deps.initialBootSubphase ?? (this.currentRoute === 'boot' ? 'intro' : null)
    this.showMainMenu = deps.initialShowMainMenu ?? false
  }

  getSnapshot(): CoordinatorSnapshot {
    return {
      currentRoute: this.currentRoute,
      renderRoute: this.renderRoute,
      targetRoute: this.targetRoute,
      currentSession: this.currentSession ? { ...this.currentSession } : null,
      targetSession: this.targetSession ? { ...this.targetSession } : null,
      phase: this.phase,
      transitionId: this.currentTransitionId,
      bootSubphase: this.bootSubphase,
      showMainMenu: this.showMainMenu,
      error: this.error ? { ...this.error } : null,
    }
  }

  subscribe(listener: (snapshot: CoordinatorSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.getSnapshot())
    return () => {
      this.listeners.delete(listener)
    }
  }

  setBootSubphase(subphase: BootSubphase): void {
    if (this.disposed || this.bootSubphase === subphase) return
    this.bootSubphase = subphase
    this.notify()
  }

  setShowMainMenu(show: boolean): void {
    if (this.disposed || this.showMainMenu === show) return
    this.showMainMenu = show
    this.notify()
  }

  clearError(): void {
    if (this.disposed || this.error === null) return
    this.error = null
    this.notify()
  }

  /**
   * Synchronous admissibility probe. Answers "would request() be able to enter
   * this route right now" WITHOUT allocating a transition or touching state.
   *
   * Application entry points must consult this BEFORE running a domain start
   * command, so a route that cannot be entered never leaves an accepted-but
   * unseen domain session running (spec S6).
   */
  canEnter(target: RouteRequest['target']): boolean {
    if (this.disposed) return false
    if (this.inFlightRequest) return false

    return target === this.currentRoute || this.isAllowedEdge(this.currentRoute, target)
  }

  /**
   * Re-runs the failed request under a fresh transition generation. The domain
   * session must still be the current one - a changed/ended session rejects,
   * because retry never re-issues the domain start command.
   */
  async retry(): Promise<TransitionResult> {
    const failed = this.error?.failedRequest

    if (this.disposed || !failed) {
      return { status: 'rejected', transitionId: this.currentTransitionId }
    }

    if ('session' in failed) {
      const current = this.sessionPort.getCurrentSession()

      if (
        !current ||
        current.sessionId !== failed.session.sessionId ||
        current.kind !== failed.session.kind
      ) {
        return { status: 'rejected', transitionId: this.currentTransitionId }
      }
    }

    this.clearError()

    return this.request(failed)
  }

  async request(request: RouteRequest): Promise<TransitionResult> {
    if (this.disposed) {
      return { status: 'rejected', transitionId: this.currentTransitionId }
    }

    // Validate request contract
    if (!this.isValidRequest(request)) {
      return { status: 'rejected', transitionId: this.currentTransitionId }
    }

    // Same route & session while idle and healthy is unchanged
    if (this.isUnchanged(request)) {
      return { status: 'unchanged', transitionId: this.currentTransitionId }
    }

    // Duplicate in-flight request shares the same promise
    if (this.inFlightRequest && this.inFlightPromise) {
      if (this.isSameRequest(request, this.inFlightRequest)) {
        return this.inFlightPromise
      }
      // Conflicting in-flight request is rejected
      return { status: 'rejected', transitionId: this.currentTransitionId }
    }

    // Validate route edge
    if (!this.isAllowedEdge(this.currentRoute, request.target)) {
      return { status: 'rejected', transitionId: this.currentTransitionId }
    }

    const transitionId = ++this.nextTransitionId
    this.currentTransitionId = transitionId
    this.inFlightRequest = request

    const controller = new AbortController()
    this.currentAbortController = controller

    const promise = this.executeTransition(request, transitionId, controller)
    this.inFlightPromise = promise

    try {
      return await promise
    } finally {
      if (this.inFlightPromise === promise) {
        this.inFlightPromise = null
        this.inFlightRequest = null
        this.currentAbortController = null
      }
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    this.currentAbortController?.abort()
    this.currentAbortController = null
    this.inFlightPromise = null
    this.inFlightRequest = null

    this.listeners.clear()
  }

  private async executeTransition(
    request: RouteRequest,
    transitionId: number,
    controller: AbortController,
  ): Promise<TransitionResult> {
    const signal = controller.signal
    let holdToken: PresentationHold | null = null
    let priorDeactivated = false

    // When behindCurtain is set, no session exists yet - the domain command
    // produces it inside the closed-curtain window (see below). Any session
    // field on the request in that case is unused; adoption happens only
    // after the command runs.
    const sessionInRequest = !request.behindCurtain && 'session' in request ? request.session : null
    this.targetSession = sessionInRequest
    this.targetRoute = request.target
    this.notify()
    let curtainClosed = false

    try {
      // Step 1: acquire hold if session requested
      if (sessionInRequest) {
        holdToken = this.sessionPort.hold(sessionInRequest)
        if (!holdToken) {
          throw new Error(`Failed to acquire hold for session ${sessionInRequest.sessionId}`)
        }
      }

      this.checkAborted(signal)

      // Step 2: close curtain
      this.phase = 'closing'
      this.notify()

      await this.withTimeout(
        this.curtain.close(transitionId, signal),
        DEADLINES.curtainClose,
        'Curtain close timed out',
        signal,
      )
      curtainClosed = true

      this.checkAborted(signal)

      // Step 2b: run the domain command behind the closed curtain, then adopt
      // the session it produces. A combat/tribulation refight against a live
      // renderer must never reset visibly - this is why the command runs here
      // instead of before the transition was requested.
      if (request.behindCurtain && !request.behindCurtain()) {
        throw new Error('Domain command rejected inside the closed-curtain window')
      }

      if (request.behindCurtain) {
        const produced = this.sessionPort.getCurrentSession()

        if (!produced || produced.kind !== request.target) {
          throw new Error('Domain command produced no session for the target route')
        }

        this.targetSession = produced
        holdToken = this.sessionPort.hold(produced)

        if (!holdToken) {
          throw new Error(`Failed to acquire hold for session ${produced.sessionId}`)
        }
      }

      this.checkAborted(signal)

      // Step 3: ensure assets
      this.phase = 'loading'
      this.notify()

      await this.withTimeout(
        this.assets.ensureFor(request, signal),
        DEADLINES.assets,
        'Asset loading timed out',
        signal,
      )

      this.checkAborted(signal)

      // Step 4: deactivate prior renderer if route changed
      this.phase = 'activating'
      this.notify()

      if (this.currentRoute !== request.target) {
        await this.withTimeout(
          this.renderer.deactivate(this.currentRoute),
          DEADLINES.deactivate,
          'Renderer deactivation timed out',
          signal,
        )
        priorDeactivated = true
      }

      this.checkAborted(signal)

      // Step 5: mount target & wait READY
      this.renderRoute = request.target
      this.phase = 'awaiting-ready'
      this.notify()

      await this.withTimeout(
        this.renderer.prepare(request, transitionId, signal),
        DEADLINES.prepareReady,
        'Renderer readiness timed out',
        signal,
      )

      this.checkAborted(signal)

      // Step 6: commit currentRoute and attach hold
      this.currentRoute = request.target
      this.currentSession = this.targetSession
      this.renderRoute = null

      if (holdToken) {
        const attached = this.sessionPort.attach(holdToken)
        if (!attached) {
          throw new Error(`Failed to attach hold token for session ${holdToken.sessionId}`)
        }
      }

      this.checkAborted(signal)

      // Step 7: open curtain
      this.phase = 'opening'
      this.notify()

      await this.withTimeout(
        this.curtain.open(transitionId, signal),
        DEADLINES.curtainOpen,
        'Curtain open timed out',
        signal,
      )

      this.checkAborted(signal)

      // Step 8: release runtime and return to idle
      if (holdToken) {
        const released = this.sessionPort.release(holdToken)
        if (!released) {
          throw new Error(`Failed to release hold token for session ${holdToken.sessionId}`)
        }
      }

      this.targetSession = null
      this.targetRoute = null
      this.phase = 'idle'
      this.error = null
      this.notify()

      return { status: 'entered', transitionId }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)

      // A deadline fires without aborting anything by itself. Abort here so
      // every scoped listener/waiter this transition registered (asset waiters,
      // scene readiness waiters, curtain transitionend handlers) is torn down
      // instead of leaking until the next transition.
      controller.abort()

      // Failure detaches with 'hold' policy: never drain pending work
      if (holdToken) {
        this.sessionPort.detach(holdToken, 'hold')
      } else if (request.behindCurtain && curtainClosed) {
        // The domain command was rejected (or produced no session) before any
        // hold was ever taken, and nothing downstream (assets, deactivate) has
        // run yet - the prior route is still fully intact. Reopen the curtain
        // best-effort so the failure surfaces as an error card over the
        // unchanged prior screen instead of a permanently closed curtain. Use
        // a fresh signal: the transition's own signal was just aborted above,
        // and the curtain rejects immediately on an already-aborted signal.
        void this.curtain.open(transitionId, new AbortController().signal).catch(() => {})
      }

      this.phase = 'failed'
      this.renderRoute = null
      this.targetSession = null
      this.targetRoute = null
      this.error = {
        message,
        failedRequest: request,
        availableRenderer: priorDeactivated ? null : this.currentRoute,
      }
      this.notify()

      return { status: 'failed', transitionId }
    }
  }

  private isValidRequest(request: RouteRequest): boolean {
    // A behindCurtain request produces its session inside the closed-curtain
    // window (see executeTransition) - it cannot carry one up front.
    if (request.behindCurtain) {
      return true
    }

    if (request.target === 'combat' || request.target === 'tribulation') {
      return (
        'session' in request &&
        request.session !== undefined &&
        request.session !== null &&
        request.session.kind === request.target &&
        typeof request.session.sessionId === 'number'
      )
    }
    return true
  }

  private isUnchanged(request: RouteRequest): boolean {
    if (this.phase !== 'idle' || this.error !== null) {
      return false
    }

    if (request.target !== this.currentRoute) {
      return false
    }

    if (request.target === 'combat' || request.target === 'tribulation') {
      const reqSession = 'session' in request ? request.session : null
      return (
        this.currentSession !== null &&
        reqSession !== null &&
        this.currentSession.sessionId === reqSession.sessionId &&
        this.currentSession.kind === reqSession.kind
      )
    }

    return true
  }

  private isSameRequest(a: RouteRequest, b: RouteRequest): boolean {
    if (a.target !== b.target) return false
    const aSession = 'session' in a ? a.session : null
    const bSession = 'session' in b ? b.session : null
    if (!aSession && !bSession) return true
    if (!aSession || !bSession) return false
    return aSession.sessionId === bSession.sessionId && aSession.kind === bSession.kind
  }

  private isAllowedEdge(from: Route, to: Route): boolean {
    const allowed = ALLOWED_EDGES[from]
    return allowed ? allowed.includes(to) : false
  }

  private checkAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new Error('Transition aborted')
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
    signal: AbortSignal,
  ): Promise<T> {
    this.checkAborted(signal)

    let handle: unknown
    let abortListener: (() => void) | undefined

    const timeoutPromise = new Promise<never>((_, reject) => {
      handle = this.scheduler.set(() => {
        reject(new Error(errorMessage))
      }, timeoutMs)
    })

    const abortPromise = new Promise<never>((_, reject) => {
      abortListener = () => reject(new Error('Transition aborted'))
      signal.addEventListener('abort', abortListener, { once: true })
    })

    try {
      return await Promise.race([promise, timeoutPromise, abortPromise])
    } finally {
      if (handle !== undefined) {
        this.scheduler.clear(handle)
      }
      if (abortListener) {
        signal.removeEventListener('abort', abortListener)
      }
    }
  }

  private notify(): void {
    if (this.disposed) return
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
