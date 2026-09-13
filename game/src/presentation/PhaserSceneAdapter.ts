/**
 * PhaserSceneAdapter (AstraDoctrine Law A5, A6, AGENTS.md P17).
 * Sole owner of primary Phaser scene lifecycle, scene switching, and readiness reporting.
 *
 * Invariant:
 * - Only adapter starts/stops primary scenes (MainScene, CombatScene, TribulationScene).
 * - Registers readiness waiter with {transitionId, sessionId, gameGeneration} before scene start.
 * - Public reportReady resolves matching pending waiter once.
 * - Same-route combat transition calls explicit scene rebind instead of destroying Game.
 * - Maintains exactly one active primary scene in steady state.
 */

import type Phaser from 'phaser'
import type { RendererPort, Route, RouteRequest } from './PresentationContracts'

export const PRIMARY_SCENE_ROUTES: Record<string, string> = {
  home: 'MainScene',
  combat: 'CombatScene',
  tribulation: 'TribulationScene',
}

export interface ReadyContext {
  transitionId: number
  /**
   * Optional on the type because non-session routes (MainScene) have none -
   * but for a session-route waiter READY only resolves when this echoes the
   * exact session id the adapter registered.
   */
  sessionId?: number
  /**
   * Required echo of the gameGeneration the adapter handed the scene in its
   * start/rebind payload. READY is an identity ack: all three fields must
   * match the pending waiter exactly - there is no "undefined matches
   * anything" acceptance (ARCH-004).
   */
  gameGeneration: number
}

interface PendingWaiter {
  transitionId: number
  sessionId?: number
  gameGeneration: number
  sceneKey: string
  resolve: () => void
  reject: (reason?: unknown) => void
}

export class PhaserSceneAdapter implements RendererPort {
  private game: Phaser.Game | null = null
  private gameGeneration = 0
  private activePrimarySceneKey: string | null = null
  private pendingWaiter: PendingWaiter | null = null
  private gameReadyResolvers = new Set<() => void>()
  private disposed = false

  setGame(game: Phaser.Game | null): void {
    if (this.game !== game) {
      this.gameGeneration += 1

      // Cancel any pending waiter from previous game generation
      if (this.pendingWaiter) {
        this.pendingWaiter.reject(new Error('Game instance replaced or destroyed'))
        this.pendingWaiter = null
      }

      this.activePrimarySceneKey = null
      this.game = game

      if (game) {
        for (const resolver of this.gameReadyResolvers) {
          resolver()
        }
        this.gameReadyResolvers.clear()
      }
    }
  }

  getGameGeneration(): number {
    return this.gameGeneration
  }

  getActivePrimarySceneKey(): string | null {
    return this.activePrimarySceneKey
  }

  isPrimarySceneActive(sceneKey: string): boolean {
    if (!this.game) return false
    try {
      return this.game.scene.isActive(sceneKey)
    } catch {
      return false
    }
  }

  reportReady(context: ReadyContext): boolean {
    const waiter = this.pendingWaiter

    if (!waiter) {
      return false
    }

    // Exact-identity ack: transitionId + sessionId + gameGeneration must all
    // equal what the waiter registered. A session-route READY that omits its
    // session id, or any READY from a replaced game host, resolves nothing -
    // the waiter stays pending for the genuine report or the deadline.
    if (waiter.transitionId !== context.transitionId) {
      return false
    }

    if (waiter.sessionId !== context.sessionId) {
      return false
    }

    if (waiter.gameGeneration !== context.gameGeneration) {
      return false
    }

    const resolve = waiter.resolve
    this.pendingWaiter = null
    resolve()
    return true
  }

  async prepare(request: RouteRequest, transitionId: number, signal: AbortSignal): Promise<void> {
    if (this.disposed) {
      throw new Error('PhaserSceneAdapter disposed')
    }
    if (signal.aborted) {
      throw new Error('Preparation aborted')
    }

    const sceneKey = PRIMARY_SCENE_ROUTES[request.target]
    if (!sceneKey) {
      // Non-Phaser route (boot, auth, character, error): no Phaser scene required
      return
    }

    if (!this.game) {
      await this.waitForGameReady(signal)
    }

    if (!this.game) {
      throw new Error('No Phaser.Game host available')
    }

    const sessionId = 'session' in request ? request.session.sessionId : undefined
    const currentGeneration = this.gameGeneration

    // Case 1: Same Combat route rebind
    if (request.target === 'combat' && this.activePrimarySceneKey === 'CombatScene') {
      const scene = this.game.scene.getScene('CombatScene') as {
        rebindSession?: (context: ReadyContext) => void
      }

      if (scene && typeof scene.rebindSession === 'function') {
        return this.registerWaiter(sceneKey, transitionId, sessionId, currentGeneration, signal, () => {
          scene.rebindSession!({
            transitionId,
            sessionId,
            gameGeneration: currentGeneration,
          })
        })
      }
    }

    // Case 2: New primary scene activation
    this.stopActivePrimary()

    return this.registerWaiter(sceneKey, transitionId, sessionId, currentGeneration, signal, () => {
      this.activePrimarySceneKey = sceneKey
      this.game!.scene.start(sceneKey, {
        transitionId,
        sessionId,
        gameGeneration: currentGeneration,
      })
    })
  }

  async deactivate(route: Route): Promise<void> {
    const sceneKey = PRIMARY_SCENE_ROUTES[route]
    if (sceneKey && this.activePrimarySceneKey === sceneKey) {
      this.stopActivePrimary()
    }
  }

  stopActivePrimary(): void {
    if (this.activePrimarySceneKey && this.game) {
      try {
        if (this.game.scene.isActive(this.activePrimarySceneKey)) {
          this.game.scene.stop(this.activePrimarySceneKey)
        }
      } catch {
        // Safe cleanup
      }
      this.activePrimarySceneKey = null
    }

    if (this.pendingWaiter) {
      this.pendingWaiter.reject(new Error('Scene activation cancelled'))
      this.pendingWaiter = null
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stopActivePrimary()
    this.setGame(null)
    this.gameReadyResolvers.clear()
  }

  private registerWaiter(
    sceneKey: string,
    transitionId: number,
    sessionId: number | undefined,
    generation: number,
    signal: AbortSignal,
    trigger: () => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let onAbort: (() => void) | undefined

      const cleanup = () => {
        if (onAbort) {
          signal.removeEventListener('abort', onAbort)
        }
      }

      onAbort = () => {
        if (this.pendingWaiter?.transitionId === transitionId) {
          this.pendingWaiter = null
        }
        cleanup()
        reject(new Error('Preparation aborted'))
      }

      signal.addEventListener('abort', onAbort, { once: true })

      this.pendingWaiter = {
        transitionId,
        sessionId,
        gameGeneration: generation,
        sceneKey,
        resolve: () => {
          cleanup()
          resolve()
        },
        reject: (err) => {
          cleanup()
          reject(err)
        },
      }

      try {
        trigger()
      } catch (err) {
        this.pendingWaiter = null
        cleanup()
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  private waitForGameReady(signal: AbortSignal): Promise<void> {
    if (this.game) return Promise.resolve()

    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        this.gameReadyResolvers.delete(resolver)
        reject(new Error('Game host wait aborted'))
      }

      const resolver = () => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      }

      signal.addEventListener('abort', onAbort, { once: true })
      this.gameReadyResolvers.add(resolver)
    })
  }
}
