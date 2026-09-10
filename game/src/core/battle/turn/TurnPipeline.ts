/**
 * The resolution pipeline. One serial queue of steps; a step fully completes
 * before the next begins; steps may push new steps onto the same queue. The
 * pipeline is the sole definition of when a turn is in flight: as long as it
 * has steps, the turn has not ended.
 */

export const MAX_CHAIN_DEPTH = 10

/**
 * Every step calls `done()` exactly once. Mechanical steps call it inline and
 * behave like a plain serial loop; ANIMATION and SEMANTIC_VFX call it when the
 * renderer reports completion (spec 4.1a).
 */
export type StepRun = (done: () => void) => void

export type PipelineStep =
  | { kind: 'awaiting-input'; run: StepRun }
  | { kind: 'animation'; actorId: string; animationId: string; run: StepRun }
  | { kind: 'hit'; run: StepRun }
  | { kind: 'reaction'; run: StepRun }
  | { kind: 'death-check'; run: StepRun }
  | { kind: 'semantic-vfx'; run: StepRun }
  | { kind: 'idle-check'; run: StepRun }

export interface DrainResult {
  chainDepthLimited: boolean
  /** True = parked on a step that has not completed yet; it will resume itself. */
  parked: boolean
}

/** Steps that still run after the chain-depth guard fires (spec 4.3). */
const MECHANICAL_AFTER_LIMIT: ReadonlySet<PipelineStep['kind']> = new Set([
  'semantic-vfx',
  'idle-check',
])

export class TurnPipeline {
  private queue: PipelineStep[] = []
  private reactionDepth = 0
  private running = false
  private parkedOn: PipelineStep | null = null
  private chainDepthLimited = false

  /** Fired when the queue empties and nothing is parked - the turn has ended. */
  constructor(private readonly onDrained: () => void = () => {}) {}

  push(step: PipelineStep): void {
    this.queue.push(step)
  }

  getDepth(): number {
    return this.queue.length + (this.parkedOn === null ? 0 : 1)
  }

  isDrained(): boolean {
    return this.queue.length === 0 && this.parkedOn === null
  }

  wasChainDepthLimited(): boolean {
    return this.chainDepthLimited
  }

  /**
   * Clears everything for a new turn. The chain-depth counter belongs to the
   * TURN, not to a drain() call, so only this resets it - otherwise an async
   * step in the middle of a reaction chain would silently reset the guard.
   */
  reset(): void {
    this.queue = []
    this.parkedOn = null
    this.running = false
    this.reactionDepth = 0
    this.chainDepthLimited = false
  }

  drain(): DrainResult {
    if (this.running) {
      // Re-entrant call from inside a running step. That step already appended
      // to the queue and the outer traversal will reach it; starting a second
      // traversal here would interleave steps and break serial execution.
      return { chainDepthLimited: this.chainDepthLimited, parked: false }
    }

    this.running = true

    while (this.queue.length > 0) {
      const step = this.queue.shift()!

      this.parkedOn = step
      step.run(() => this.completeStep(step))

      if (this.parkedOn === step) {
        // Did not complete synchronously: park and wait to be resumed.
        this.running = false

        return { chainDepthLimited: this.chainDepthLimited, parked: true }
      }

      if (step.kind === 'reaction') {
        this.reactionDepth += 1

        if (this.reactionDepth >= MAX_CHAIN_DEPTH && !this.chainDepthLimited) {
          this.chainDepthLimited = true
          console.warn(
            `[combat] reaction chain depth limit (${MAX_CHAIN_DEPTH}) reached; forcing resolution`,
          )

          // Spec 4.3: drop the reaction chain but let the remaining mechanical
          // steps finish, so the turn terminates normally rather than being cut.
          this.queue = this.queue.filter((queued) => MECHANICAL_AFTER_LIMIT.has(queued.kind))
        }
      }
    }

    this.running = false

    if (this.isDrained()) {
      this.onDrained()
    }

    return { chainDepthLimited: this.chainDepthLimited, parked: false }
  }

  /** Idempotent per step: an event and its fallback timer may both fire. */
  private completeStep(step: PipelineStep): void {
    if (this.parkedOn !== step) {
      return
    }

    this.parkedOn = null

    if (!this.running) {
      // Async completion arrived after we parked - resume the traversal.
      this.drain()
    }
  }
}
