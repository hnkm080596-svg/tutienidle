import type { ClockSource } from '@/core/battle/turn/CombatClock'

/**
 * The renderer-side shape of window.electronAPI.combatClock (see
 * electron/preload.ts). Kept as its own narrow interface so this class stays
 * testable without importing the global Window augmentation.
 */
export interface CombatClockBridge {
  onTick(callback: (elapsedSeconds: number) => void): () => void
  stop(): void
}

/**
 * Production ClockSource under Electron: wraps the preload bridge so combat
 * receives ticks from the main-process host (combatClockHost.ts) instead of
 * the renderer's requestAnimationFrame. The combat engine only ever sees the
 * ClockSource interface, so this transport is invisible to it.
 */
export class MainProcessClockSource implements ClockSource {
  private detach: (() => void) | null = null

  constructor(private readonly bridge: CombatClockBridge) {}

  start(onFrame: (elapsedSeconds: number) => void): void {
    if (this.detach !== null) {
      return
    }

    this.detach = this.bridge.onTick(onFrame)
  }

  stop(): void {
    this.detach?.()
    this.detach = null
    this.bridge.stop()
  }
}
