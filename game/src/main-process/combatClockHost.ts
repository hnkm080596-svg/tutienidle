/**
 * Main-process clock host. The renderer's requestAnimationFrame can be
 * throttled by Chromium; the main process timer is not. This host ticks at a
 * fixed interval and sends the elapsed seconds to the renderer over IPC. The
 * combat engine sees only the injected ClockSource, so the transport is
 * invisible to it.
 */

/**
 * A gap larger than this means the process was not running - OS sleep, lid
 * close, suspension. It is reported as nothing at all rather than as elapsed
 * combat time, mirroring RafClockSource's STALL_THRESHOLD_MS. Combat has no
 * catch-up; a battle nobody was running did not advance.
 *
 * This is the backstop for a stall that raises no OS signal (a hung process,
 * a debugger pause). The precise case - an actual OS sleep - is caught
 * earlier by reset(), called from electron/main.ts's powerMonitor 'resume'
 * handler, which re-anchors `last` before this threshold would ever see the
 * gap.
 */
const STALL_THRESHOLD_SECONDS = 1

export interface CombatClockHost {
  start(intervalMs: number, send: (elapsedSeconds: number) => void): void
  stop(): void
  /**
   * Re-anchors the elapsed-time baseline to now without emitting a tick.
   * Call this from the OS 'resume' signal (powerMonitor) so the interval
   * immediately after a sleep measures only time since resume, instead of
   * tripping the stall guard against the pre-sleep timestamp.
   */
  reset(): void
}

export function createCombatClockHost(): CombatClockHost {
  let handle: ReturnType<typeof setInterval> | null = null
  let last = 0

  return {
    start(intervalMs, send) {
      if (handle !== null) {
        return
      }

      last = Date.now()

      handle = setInterval(() => {
        const now = Date.now()
        const elapsed = (now - last) / 1000
        last = now

        // Stall guard. An OS sleep, a lid close or a suspended process makes
        // setInterval fire once with an enormous elapsed - eight hours asleep
        // would hand the renderer 288000 steps to replay. That is catch-up, and
        // combat has none: a stalled interval reports nothing and the battle
        // simply resumes where it stood.
        if (elapsed > STALL_THRESHOLD_SECONDS) {
          return
        }

        if (elapsed > 0) {
          send(elapsed)
        }
      }, intervalMs)
    },

    stop() {
      if (handle !== null) {
        clearInterval(handle)
      }

      handle = null
    },

    reset() {
      last = Date.now()
    },
  }
}
