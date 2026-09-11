// useDynamicRegion — the mechanics of hosting a dynamic region.
//
// Mechanism 2 of
// docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md §5.
//
// `PhaserCanvas.vue` and `TranPhapPanel.vue` each hand-rolled construction,
// dynamic import, resize observation, teardown and error handling, in two
// different bodies of code. Neither was wrong. But under §2 a static shell
// hosting a dynamic region is the STANDARD composition, so the third and fourth
// region would each have been a third and fourth copy — and Mission 0 §13 warns
// specifically that reusing a renderer does not make a hosting lifecycle
// correct.
//
// What this is not (§5.3): a scene abstraction, a renderer wrapper, or a second
// coordinator. `GamePresentationCoordinator` keeps route and readiness
// authority untouched. This owns hosting mechanics only; what a region draws is
// entirely the scene's business.
import { onUnmounted, readonly, ref, type Ref } from 'vue'
import { assertGateSeeded, type GateRegistry } from '@/presentation/gate/PresentationGate'

/** Phaser's own scene-class shape. No new abstraction is introduced. */
export type SceneCtor = new (...args: never[]) => Phaser.Scene

export interface DynamicRegionModules {
  /**
   * Phaser's default export — `(await import('phaser')).default`.
   *
   * Typed structurally rather than as `typeof import('phaser')`: in this
   * project that expression resolves to the ambient `Phaser` NAMESPACE, which
   * has no `default` member, so the namespace form does not describe the value
   * a caller actually holds. Two members are all the host uses.
   */
  Phaser: {
    Game: new (config: Phaser.Types.Core.GameConfig) => Phaser.Game
    AUTO: number
  }
  scenes: SceneCtor[]
}

export interface DynamicRegionOptions {
  container: Ref<HTMLElement | null>

  /** Dynamic import of Phaser plus the region's scenes. Code-split preserved. */
  load: () => Promise<DynamicRegionModules>

  /**
   * Game config MINUS the four fields the host owns: `parent`, `width`,
   * `height` and `scene`. A region that set those would be deciding its own
   * hosting, which is the thing being centralised.
   */
  config?: Omit<Phaser.Types.Core.GameConfig, 'parent' | 'width' | 'height' | 'scene'>

  /**
   * Fixed pixel size. Omit to take the size from the container and track it
   * with a `ResizeObserver` — the combat canvas does the latter, the Formation
   * preview the former.
   */
  size?: { width: number; height: number }

  /**
   * Seed the gate. Runs immediately after construction, before any scene's
   * `create()` can read it. May return a cleanup, run at teardown.
   */
  seed?: (registry: GateRegistry) => (() => void) | void

  /**
   * Assert every required gate key is present once `seed` has run (§4.2). Off
   * by default: a region that seeds nothing — the Formation preview — is a
   * legitimate configuration, not a wiring bug.
   */
  validateSeed?: boolean

  /** The game exists, is seeded, and is about to be observed. */
  onBooted?: (game: Phaser.Game) => void

  /**
   * The game has booted and its scenes have run `create()`.
   *
   * Deliberately takes no argument: this is the moment a shell wants to push
   * initial state, and handing it the `Phaser.Game` to do so would hand back
   * exactly what §3.6 removes. Use `dispatch`.
   */
  onReady?: () => void

  /** The container changed size and `game.scale.resize` has been applied. */
  onResized?: (game: Phaser.Game, width: number, height: number) => void

  /** Runs during teardown, BEFORE the game is destroyed. */
  onTeardown?: () => void
}

export interface DynamicRegion {
  /** Bumped on every teardown, so in-flight callbacks can tell they are stale. */
  generation: Readonly<Ref<number>>

  /** Local to the region: a failed canvas must not take the app down. */
  bootError: Readonly<Ref<string | null>>

  /** Capture at creation; compare before acting. */
  currentGeneration(): number

  /**
   * Begin the dynamic import and construct. Explicit rather than automatic,
   * because the two regions start at different moments: the combat canvas on
   * mount, the Formation preview when its panel opens. §5.2 did not list this;
   * the Formation panel is why it exists.
   */
  start(): void

  destroy(): void

  /**
   * Send a scoped event to the region (§3.6, surface two). The shell addresses
   * the REGION, never a scene object: a shell holding a scene can call every
   * public method on it and nobody reviews that.
   */
  dispatch(event: string, payload?: unknown): void
}

export function useDynamicRegion(options: DynamicRegionOptions): DynamicRegion {
  const generation = ref(0)
  const bootError = ref<string | null>(null)

  let game: Phaser.Game | null = null
  let resizeObserver: ResizeObserver | null = null
  let seedCleanup: (() => void) | null = null

  const currentGeneration = () => generation.value

  function start(): void {
    const container = options.container.value

    if (!container || game) {
      return
    }

    // Captured BEFORE the await. Everything after it compares against this, so
    // a teardown mid-import leaves a resolving import() harmless rather than
    // writing into a destroyed container.
    const bootGeneration = generation.value

    void (async () => {
      try {
        const modules = await options.load()

        // Two separate facts: the region may have been torn down (generation
        // moved), or the container may simply be gone.
        if (bootGeneration !== generation.value || !options.container.value) {
          return
        }

        construct(modules, options.container.value)
      } catch (error) {
        if (bootGeneration !== generation.value) {
          return
        }

        const message = error instanceof Error ? error.message : String(error)

        console.error('[useDynamicRegion] bootstrap failed:', error)

        // The same cleanup teardown runs. A throw part-way through construct()
        // can leave an observer, a seed cleanup or a game behind, and orphaning
        // any of them is how a "failed" region keeps running.
        teardownResources()

        bootError.value = message
      }
    })()
  }

  function construct(modules: DynamicRegionModules, container: HTMLElement): void {
    const Phaser = modules.Phaser

    const size = options.size ?? {
      width: container.clientWidth,
      height: container.clientHeight,
    }

    const created = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: size.width,
      height: size.height,
      scene: modules.scenes,
      ...options.config,
    })

    game = created

    const cleanup = options.seed?.(created.registry as unknown as GateRegistry)
    seedCleanup = typeof cleanup === 'function' ? cleanup : null

    if (options.validateSeed) {
      assertGateSeeded(created.registry as unknown as GateRegistry)
    }

    options.onBooted?.(created)

    // A fixed-size region has nothing to observe: its canvas is the size it was
    // asked for, and resizing it from the container would contradict that.
    if (!options.size) {
      observe(container)
    }

    // Subscribed LAST, after the observer exists. The order is load-bearing:
    // a throw from `observe` must surface as itself, not as a later failure in
    // a callback that only got registered because the observer had not been
    // set up yet. PhaserCanvas.test.ts asserts exactly that message.
    if (options.onReady) {
      const readyGeneration = generation.value
      const onReady = options.onReady

      // A teardown between boot and 'ready' must not deliver it.
      created.events.once('ready', () => {
        if (readyGeneration === generation.value) {
          onReady()
        }
      })
    }
  }

  function observe(container: HTMLElement): void {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      const live = game

      if (!entry || !live) {
        return
      }

      const { width, height } = entry.contentRect

      if (width > 0 && height > 0) {
        live.scale.resize(width, height)
        options.onResized?.(live, width, height)
      }
    })

    resizeObserver.observe(container)
  }

  /**
   * Teardown order is part of the contract, not an implementation detail
   * (§5.2). A teardown that destroys the game before invalidating in-flight
   * work leaves a resolved dynamic import writing into a destroyed container.
   */
  function teardownResources(): void {
    // 1. Every in-flight callback is now stale.
    generation.value += 1

    // 2. Stop observing before the game can be resized into oblivion.
    resizeObserver?.disconnect()
    resizeObserver = null

    // 3. Let the region drop what it registered, while the game still exists.
    options.onTeardown?.()

    seedCleanup?.()
    seedCleanup = null

    // 4. Phaser tears down scenes, tweens and timers.
    game?.destroy(true)

    // 5. Null the refs.
    game = null
  }

  function destroy(): void {
    teardownResources()
  }

  function dispatch(event: string, payload?: unknown): void {
    game?.events.emit(event, payload)
  }

  onUnmounted(destroy)

  return {
    generation: readonly(generation),
    bootError: readonly(bootError),
    currentGeneration,
    start,
    destroy,
    dispatch,
  }
}
