import type {
  PresentationHold,
  SessionPresentationPort,
  SessionRef,
} from '../core/presentation/PresentationSession'

export type Route = 'boot' | 'auth' | 'character' | 'home' | 'combat' | 'tribulation' | 'error'

export type RouteRequest =
  | Readonly<{
      target: 'combat' | 'tribulation'
      session: SessionRef
      /**
       * Domain work with visible effect, executed inside the closed-curtain window.
       * Runs after the curtain is fully closed and before the target is revealed.
       * Returning false fails the transition.
       */
      behindCurtain?: () => boolean
    }>
  | Readonly<{
      target: 'combat' | 'tribulation'
      /**
       * Domain work with visible effect, executed inside the closed-curtain window.
       * Runs after the curtain is fully closed and before the target is revealed.
       * Required (not merely allowed) on this arm: it is the ONLY source of a
       * session for a combat/tribulation request that does not already carry one
       * - without it there would be nothing to adopt in GamePresentationCoordinator.
       *
       * The return value is the accepted RouteRequest itself: the session the
       * domain command committed to travels with it to the coordinator, which
       * adopts THAT identity for the rest of the transition (ARCH-004) instead
       * of re-deriving one from ambient session state. null fails the transition.
       */
      behindCurtain: () => RouteRequest | null
    }>
  | Readonly<{
      target: 'boot' | 'auth' | 'character' | 'home' | 'error'
      /**
       * Domain work with visible effect, executed inside the closed-curtain window.
       * Runs after the curtain is fully closed and before the target is revealed.
       * Returning false fails the transition.
       */
      behindCurtain?: () => boolean
    }>

export type Phase =
  | 'idle'
  | 'closing'
  | 'loading'
  | 'activating'
  | 'awaiting-ready'
  | 'opening'
  | 'failed'

export type TransitionResult = Readonly<{
  status: 'entered' | 'unchanged' | 'rejected' | 'failed'
  transitionId: number
}>

export interface RendererPort {
  prepare(request: RouteRequest, id: number, signal: AbortSignal): Promise<void>
  deactivate(route: Route): Promise<void>
}

export interface CurtainPort {
  close(id: number, signal: AbortSignal): Promise<void>
  open(id: number, signal: AbortSignal): Promise<void>
}

export interface AssetPort {
  ensureFor(request: RouteRequest, signal: AbortSignal): Promise<void>
}

export interface DeadlineScheduler {
  set(callback: () => void, ms: number): unknown
  clear(handle: unknown): void
}

export type BootSubphase = 'intro' | 'loading_save' | 'initializing' | null

export type CoordinatorError = Readonly<{
  message: string
  failedRequest: RouteRequest
  availableRenderer: Route | null
}>

export type CoordinatorSnapshot = Readonly<{
  currentRoute: Route
  renderRoute: Route | null
  /**
   * Target of the in-flight transition, known from the moment it is admitted -
   * before the curtain closes and long before renderRoute is set. Hosts that
   * must EXIST for a transition to progress (the Phaser canvas, whose loader
   * scene the asset phase needs) mount on this; route SCREENS still mount on
   * renderRoute, behind the closed curtain.
   */
  targetRoute: Route | null
  currentSession: SessionRef | null
  targetSession: SessionRef | null
  phase: Phase
  transitionId: number
  bootSubphase: BootSubphase
  error: CoordinatorError | null
}>

import type { InjectionKey } from 'vue'
import type { PhaserSceneAdapter } from './PhaserSceneAdapter'
import type { AssetBundleManager } from './assets/AssetBundleManager'
import type { VueRouteAdapter } from './VueRouteAdapter'

export const PHASER_SCENE_ADAPTER_KEY: InjectionKey<PhaserSceneAdapter> = Symbol('phaserSceneAdapter')
export const ASSET_BUNDLE_MANAGER_KEY: InjectionKey<AssetBundleManager> = Symbol('assetBundleManager')
export const VUE_ROUTE_ADAPTER_KEY: InjectionKey<VueRouteAdapter> = Symbol('vueRouteAdapter')
export const GAME_PRESENTATION_KEY: InjectionKey<import('./createGamePresentation').GamePresentation> = Symbol('gamePresentation')

export const ASSET_LOADER_SCENE_KEY = 'AssetLoaderScene'
