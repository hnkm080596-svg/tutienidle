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

  start(onFrame: (elapsedSeconds: number) => void): void {
    if (this.handle !== null) {
      return
    }

    const frame = (timestamp: number) => {
      if (this.lastTimestamp !== null) {
        const deltaMs = timestamp - this.lastTimestamp

        if (deltaMs < STALL_THRESHOLD_MS) {
          onFrame(deltaMs / 1000)
        }
      }

      this.lastTimestamp = timestamp
      this.handle = requestAnimationFrame(frame)
    }

    this.handle = requestAnimationFrame(frame)
  }

  stop(): void {
    if (this.handle !== null) {
      cancelAnimationFrame(this.handle)
    }

    this.handle = null
    this.lastTimestamp = null
  }
}
