/**
 * Combat's own clock.
 *
 * It counts for itself. There is deliberately no `advance(dt)` on this class:
 * a clock that receives its delta from another clock is a subscriber and
 * inherits that clock's cadence, throttling, and catch-up. Time enters only
 * through the injected ClockSource.
 *
 * It publishes steps and gates nobody. The only thing it knows is whether it
 * is allowed to count and, if not, which reasons are holding it back. It has
 * no turn-related concept of its own: "freeze while a turn is in flight" is a
 * reason supplied by the caller, not a rule stored here.
 *
 * Off-screen and mid-turn time are discarded, never banked.
 */

export const COMBAT_STEP_SECONDS = 0.1

export type CombatClockState = 'running' | 'frozen' | 'stopped'

/**
 * Reasons the clock may be held back. `tab-hidden` and `not-revealed` describe
 * the battle not being on screen. `turn-in-flight` describes the turn engine
 * having claimed the token and not yet released it. All three compose
 * uniformly: the clock runs only when the reason set is empty.
 */
export type FreezeReason = 'tab-hidden' | 'not-revealed' | 'turn-in-flight'

export interface ClockSource {
  start(onFrame: (elapsedSeconds: number) => void): void
  stop(): void
}

/** Test/headless source: time moves only when a caller says so. */
export class ManualClockSource implements ClockSource {
  private onFrame: ((elapsedSeconds: number) => void) | null = null

  start(onFrame: (elapsedSeconds: number) => void): void {
    this.onFrame = onFrame
  }

  stop(): void {
    this.onFrame = null
  }

  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return
    }

    this.onFrame?.(seconds)
  }
}

export class CombatClock {
  private state: CombatClockState = 'stopped'
  private readonly reasons = new Set<FreezeReason>()
  private readonly listeners = new Set<(steps: number) => void>()
  private carrySeconds = 0
  private elapsedSteps = 0

  constructor(private readonly source: ClockSource) {}

  start(): void {
    if (this.state !== 'stopped') {
      return
    }

    this.state = this.reasons.size > 0 ? 'frozen' : 'running'
    this.carrySeconds = 0
    this.source.start((elapsed) => this.onFrame(elapsed))
  }

  stop(): void {
    if (this.state === 'stopped') {
      return
    }

    this.state = 'stopped'
    this.reasons.clear()
    this.carrySeconds = 0
    this.source.stop()
  }

  freeze(reason: FreezeReason): void {
    if (this.state === 'stopped') {
      return
    }

    this.reasons.add(reason)
    this.state = 'frozen'
    this.carrySeconds = 0
  }

  resume(reason: FreezeReason): void {
    if (this.state === 'stopped') {
      return
    }

    this.reasons.delete(reason)

    if (this.reasons.size === 0) {
      this.state = 'running'
    }
  }

  getState(): CombatClockState {
    return this.state
  }

  getFreezeReasons(): readonly FreezeReason[] {
    return [...this.reasons]
  }

  getElapsedSteps(): number {
    return this.elapsedSteps
  }

  onStep(listener: (steps: number) => void): () => void {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  private onFrame(elapsedSeconds: number): void {
    if (this.state !== 'running' || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
      return
    }

    this.carrySeconds += elapsedSeconds

    const steps = Math.floor((this.carrySeconds + 1e-10) / COMBAT_STEP_SECONDS)

    if (steps <= 0) {
      return
    }

    this.carrySeconds -= steps * COMBAT_STEP_SECONDS
    this.elapsedSteps += steps

    for (const listener of this.listeners) {
      listener(steps)
    }
  }
}
