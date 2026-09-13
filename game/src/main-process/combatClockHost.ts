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
      // Looks redundant next to the per-tick `last = now` above — it isn't.
      // That per-tick update tracks the *interval*'s own cadence; this is a
      // deliberate external re-anchor called from the OS 'resume' signal
      // (see attachPowerMonitorToClockHost below), so the tick right after a
      // real sleep is measured from the moment of resume, not against
      // whatever `last` held before the OS suspended the process. Ruling 3:
      // this is the precise signal, not a substitute for the elapsed
      // threshold above, which stays as the backstop for a stall that raises
      // no power event.
      last = Date.now()
    },
  }
}

/**
 * Wires the OS 'resume' power event to the clock host's reset(), plus an
 * optional caller hook (electron/main.ts uses it to forward 'system:resume'
 * to the renderer, as it already did before this host existed).
 *
 * Pulled out of electron/main.ts so this glue has test coverage: main.ts
 * itself has no test harness, and the failure modes here (wrong event name,
 * reset() never called, or called after the hook instead of before) would
 * otherwise sail through the suite untested. reset() is called before the
 * hook so the resume-forwarding path never observes a stale baseline.
 */
export function attachPowerMonitorToClockHost(
  powerMonitor: { on(event: 'resume', listener: () => void): void },
  host: CombatClockHost,
  onResume?: () => void,
): void {
  powerMonitor.on('resume', () => {
    host.reset()
    onResume?.()
  })
}
