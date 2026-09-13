import type { ClockSource } from '@/core/battle/turn/CombatClock'

/**
 * Fallback ClockSource for the browser path: combat counts on the render
 * cadence, so the battle advances exactly as fast as it is drawn. DOM-aware,
 * so it lives outside core/ — core must stay headlessly testable.
 *
 * The production source under Electron is MainProcessClockSource. This one
 * remains for development in a plain browser and for tests.
 *
 * A frame that arrives more than STALL_THRESHOLD after the previous one is
 * treated as a stall and its gap is dropped. If the tab was hidden, the freeze
 * reason set handles it explicitly; if the stall was a browser-level throttle
 * with the tab still visible, dropping the gap is the honest behaviour,
 * because no catch-up is allowed in combat.
 */
const STALL_THRESHOLD_MS = 500

export class RafClockSource implements ClockSource {
  private handle: number | null = null
  private lastTimestamp: number | null = null
  // ARCH-013/L04 — a scheduled frame belongs to the start() that armed it.
  // stop() bumps the generation, so a frame whose callback stopped (or
  // stopped-then-restarted) the clock never re-arms: without the fence the
  // tail `requestAnimationFrame(frame)` below would resurrect the loop after
  // every stop() that ran inside onFrame, leaving a self-perpetuating ghost
  // loop of no-op frames (combat-over calls stop() from exactly there).
  private generation = 0

  start(onFrame: (elapsedSeconds: number) => void): void {
    if (this.handle !== null) {
      return
    }

    const generation = this.generation

    const frame = (timestamp: number) => {
      if (generation !== this.generation) {
        return
      }

      if (this.lastTimestamp !== null) {
        const deltaMs = timestamp - this.lastTimestamp

        if (deltaMs < STALL_THRESHOLD_MS) {
          // A throw from anywhere in the turn stack must not kill the loop:
          // the rAF is re-armed below, and start() would refuse to re-arm it
          // because handle is still non-null. Combat would stop forever.
          try {
            onFrame(deltaMs / 1000)
          } catch (error) {
            console.error('[RafClockSource] combat frame threw; clock continues', error)
          }
        }
      }

      // Re-check AFTER the callback: onFrame is the whole turn stack and may
      // have stopped this clock (combat-over) or even restarted it. A stale
      // generation must neither record its timestamp nor re-arm; a restarted
      // clock owns a NEW frame closure under a new generation, so re-arming
      // here would double the loop.
      if (generation !== this.generation) {
        return
      }

      this.lastTimestamp = timestamp
      this.handle = requestAnimationFrame(frame)
    }

    this.handle = requestAnimationFrame(frame)
  }

  stop(): void {
    this.generation += 1

    if (this.handle !== null) {
      cancelAnimationFrame(this.handle)
    }

    this.handle = null
    this.lastTimestamp = null
  }
}
