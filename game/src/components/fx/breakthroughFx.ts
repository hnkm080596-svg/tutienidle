// Minor-floor Dot Pha cinematic channel (owner spec 2026-10-11): on a
// minor breakthrough the whole screen dims and locks, the luyen-the
// seated silhouette manifests center-screen and trembles while spirit-qi
// motes stream in from every direction, then a qi ring blasts out to
// full screen. The floor commit waits for the burst: callers await
// playBreakthroughFx() and apply the domain change while the flash
// still covers the swap. Major-realm ceremonies (do kiep) untouched.
//
// Plumbing mirrors the decompose channel: module-scoped pending queue
// drained by the single BreakthroughFxLayer mounted in GameRoot, rAF
// timeline, viewport coordinates, Teleport to body, reduced-motion skip.
import { ref } from 'vue'

export interface BreakthroughFxRun {
  id: number
  resolve: () => void
}

const pending = ref<BreakthroughFxRun[]>([])
let nextRunId = 0
let layerMounted = false

/** GameRoot layer reports its mount state so callers never await a
 *  cinematic that cannot render (tests, isolated surfaces). */
export function setBreakthroughFxLayerMounted(mounted: boolean): void {
  layerMounted = mounted
}

/**
 * Play the minor breakthrough cinematic; resolves at the qi-burst peak
 * so the caller commits the floor advance under cover of the flash.
 * Resolves immediately when the layer is absent (tests) - the advance
 * still lands, just without the show.
 */
export function playBreakthroughFx(): Promise<void> {
  if (!layerMounted) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const id = ++nextRunId
    pending.value = [...pending.value, { id, resolve }]
    // Watchdog: the cinematic must never block progression. If the
    // layer dies mid-flight (HMR teardown, thrown frame), the floor
    // still commits once the show's own window has elapsed.
    setTimeout(() => {
      settleBreakthroughFxRun(id)
      resolve()
    }, 8200)
  })
}

/** Queue the GameRoot layer watches. */
export function useBreakthroughFxRuns() {
  return pending
}

/** Remove a run from the queue - the layer calls this when it settles. */
export function settleBreakthroughFxRun(id: number): void {
  pending.value = pending.value.filter((run) => run.id !== id)
}
