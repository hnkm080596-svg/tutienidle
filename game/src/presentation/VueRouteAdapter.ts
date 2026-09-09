/**
 * VueRouteAdapter (AstraDoctrine Law A5, A7, AGENTS.md P17).
 * Reactive bridge from GamePresentationCoordinator to Vue templates,
 * and composite renderer coordinating Vue mount readiness with Phaser scene readiness.
 *
 * Invariant:
 * - Readonly reactive view of coordinator snapshots; does not expose route setters.
 * - renderRoute controls target mount behind the curtain.
 * - Composite renderer prepare awaits Vue READY plus Phaser READY for Phaser-backed routes.
 * - Non-Phaser routes (boot, auth, character, error) do not wait for Phaser.
 */

import { computed, nextTick, readonly, shallowRef, type ComputedRef, type Ref } from 'vue'
import type {
  BootSubphase,
  CoordinatorError,
  CoordinatorSnapshot,
  Phase,
  RendererPort,
  Route,
  RouteRequest,
} from './PresentationContracts'
import { PRIMARY_SCENE_ROUTES, type PhaserSceneAdapter } from './PhaserSceneAdapter'
import { GamePresentationCoordinator } from './GamePresentationCoordinator'
import type { SessionRef } from '../core/presentation/PresentationSession'

export class CompositeRenderer implements RendererPort {
  private pendingVueWaiter: {
    transitionId: number
    route: Route
    resolve: () => void
    reject: (err: Error) => void
  } | null = null

  /**
   * Routes whose Vue tree is currently mounted. This is evidence reported by
   * the mounted component itself - a timer or a snapshot notification only
   * proves the coordinator changed state, not that anything rendered.
   */
  private readonly mountedRoutes = new Set<Route>()

  constructor(private readonly phaserAdapter: PhaserSceneAdapter) {}

  markRouteMounted(route: Route): void {
    this.mountedRoutes.add(route)

    if (this.pendingVueWaiter?.route === route) {
      this.reportVueReady(this.pendingVueWaiter.transitionId)
    }
  }

  markRouteUnmounted(route: Route): void {
    this.mountedRoutes.delete(route)
  }

  isRouteMounted(route: Route): boolean {
    return this.mountedRoutes.has(route)
  }

  reportVueReady(transitionId: number): boolean {
    if (this.pendingVueWaiter && this.pendingVueWaiter.transitionId === transitionId) {
      const resolve = this.pendingVueWaiter.resolve
      this.pendingVueWaiter = null
      resolve()
      return true
    }
    return false
  }

  hasPendingVueWaiter(transitionId?: number): boolean {
    if (transitionId !== undefined) {
      return this.pendingVueWaiter?.transitionId === transitionId
    }
    return this.pendingVueWaiter !== null
  }

  async prepare(request: RouteRequest, transitionId: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) {
      throw new Error('Preparation aborted')
    }

    const vuePromise = new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        if (this.pendingVueWaiter?.transitionId === transitionId) {
          this.pendingVueWaiter = null
        }
        reject(new Error('Preparation aborted'))
      }

      signal.addEventListener('abort', onAbort, { once: true })

      this.pendingVueWaiter = {
        transitionId,
        route: request.target,
        resolve: () => {
          signal.removeEventListener('abort', onAbort)
          resolve()
        },
        reject: (err) => {
          signal.removeEventListener('abort', onAbort)
          reject(err)
        },
      }

      // Already mounted (re-entering a route whose tree stays alive, e.g. a
      // combat rebind under the same GameRoot) resolves without waiting.
      if (this.mountedRoutes.has(request.target)) {
        this.reportVueReady(transitionId)
      }
    })

    const isPhaserRoute = Boolean(PRIMARY_SCENE_ROUTES[request.target])
    if (isPhaserRoute) {
      await Promise.all([
        vuePromise,
        this.phaserAdapter.prepare(request, transitionId, signal),
      ])
    } else {
      await vuePromise
    }
  }

  async deactivate(route: Route): Promise<void> {
    await this.phaserAdapter.deactivate(route)
  }
}

export interface VueRouteAdapter {
  readonly currentRoute: Ref<Route>
  readonly renderRoute: Ref<Route | null>
  readonly targetRoute: Ref<Route | null>
  readonly activeRoute: ComputedRef<Route>
  readonly currentSession: Ref<SessionRef | null>
  readonly targetSession: Ref<SessionRef | null>
  readonly phase: Ref<Phase>
  readonly transitionId: Ref<number>
  readonly bootSubphase: Ref<BootSubphase>
  readonly showMainMenu: Ref<boolean>
  readonly error: Ref<CoordinatorError | null>
  readonly isTransitioning: ComputedRef<boolean>
  readonly isLocked: ComputedRef<boolean>
  reportVueReady(transitionId: number): boolean
  markRouteMounted(route: Route): void
  markRouteUnmounted(route: Route): void
  dispose(): void
}

export function createVueRouteAdapter(
  coordinator: GamePresentationCoordinator,
  compositeRenderer: CompositeRenderer,
): VueRouteAdapter {
  const currentSnapshot = coordinator.getSnapshot()

  const currentRoute = shallowRef<Route>(currentSnapshot.currentRoute)
  const renderRoute = shallowRef<Route | null>(currentSnapshot.renderRoute)
  const targetRoute = shallowRef<Route | null>(currentSnapshot.targetRoute)
  const currentSession = shallowRef<SessionRef | null>(currentSnapshot.currentSession)
  const targetSession = shallowRef<SessionRef | null>(currentSnapshot.targetSession)
  const phase = shallowRef<Phase>(currentSnapshot.phase)
  const transitionId = shallowRef<number>(currentSnapshot.transitionId)
  const bootSubphase = shallowRef<BootSubphase>(currentSnapshot.bootSubphase)
  const showMainMenu = shallowRef<boolean>(currentSnapshot.showMainMenu)
  const error = shallowRef<CoordinatorError | null>(currentSnapshot.error)

  const activeRoute = computed<Route>(() => renderRoute.value ?? currentRoute.value)
  const isTransitioning = computed<boolean>(
    () => phase.value !== 'idle' && phase.value !== 'failed',
  )
  const isLocked = computed<boolean>(() => phase.value !== 'idle')

  const unsubscribe = coordinator.subscribe((snapshot) => {
    currentRoute.value = snapshot.currentRoute
    renderRoute.value = snapshot.renderRoute
    targetRoute.value = snapshot.targetRoute
    currentSession.value = snapshot.currentSession
    targetSession.value = snapshot.targetSession
    phase.value = snapshot.phase
    transitionId.value = snapshot.transitionId
    bootSubphase.value = snapshot.bootSubphase
    showMainMenu.value = snapshot.showMainMenu
    error.value = snapshot.error
  })

  function reportVueReady(id: number): boolean {
    return compositeRenderer.reportVueReady(id)
  }

  /**
   * Called by the component that renders a route, on mount. Deferred one tick
   * so the whole subtree (overlays/chrome inside it) has flushed before the
   * route claims to be ready.
   */
  function markRouteMounted(route: Route): void {
    void nextTick(() => {
      compositeRenderer.markRouteMounted(route)
    })
  }

  function markRouteUnmounted(route: Route): void {
    compositeRenderer.markRouteUnmounted(route)
  }

  function dispose(): void {
    unsubscribe()
  }

  return {
    currentRoute: readonly(currentRoute) as Ref<Route>,
    renderRoute: readonly(renderRoute) as Ref<Route | null>,
    targetRoute: readonly(targetRoute) as Ref<Route | null>,
    activeRoute,
    currentSession: readonly(currentSession) as Ref<SessionRef | null>,
    targetSession: readonly(targetSession) as Ref<SessionRef | null>,
    phase: readonly(phase) as Ref<Phase>,
    transitionId: readonly(transitionId) as Ref<number>,
    bootSubphase: readonly(bootSubphase) as Ref<BootSubphase>,
    showMainMenu: readonly(showMainMenu) as Ref<boolean>,
    error: readonly(error) as Ref<CoordinatorError | null>,
    isTransitioning,
    isLocked,
    reportVueReady,
    markRouteMounted,
    markRouteUnmounted,
    dispose,
  }
}
