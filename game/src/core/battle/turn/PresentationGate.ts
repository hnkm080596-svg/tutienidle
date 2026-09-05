/**
 * Boot-race fix (Defect Task 3, 2026-09-05) — gates GameManager's fixed-step
 * battle ticking until a real Phaser presentation layer has attached, WITHOUT
 * relying on wall-clock timing as the primary mechanism (a wall-clock-only
 * gate breaks fast synchronous tests: they finish well under any reasonable
 * timeout and never call markReady(), so they'd stay blocked forever from
 * their own point of view). Instead this is an explicit-intent gate:
 *
 * - Headless/test GameManager instances never call expect() → isBlocking()
 *   is always false → zero behavior change for the 75+ existing tests.
 * - The real app calls expect() once at boot (App.vue). Until CombatScene
 *   mounts for the first time and calls markReady() (via
 *   GameManager.setPresentationActive(true)), combat ticking pauses.
 * - markReady() is sticky forever — leaving/re-entering CombatScene later
 *   (setPresentationActive(false) then true again) does NOT re-block,
 *   because PhaserCanvas only ever boots once per app session.
 * - A wall-clock timeout is kept ONLY as a defensive fallback for a genuine
 *   Phaser bootstrap failure (see PhaserCanvas.vue's bootError handling) —
 *   not as the mechanism relied on in the normal case.
 */
export class PresentationGate {
  private status: 'not-expected' | 'awaiting' | 'ready' = 'not-expected'
  private awaitingSinceMs: number | null = null

  /** Call once, only from real-app bootstrap — never from a test fixture.
   * Optional sinceMs for deterministic tests (defaults to Date.now()). */
  expect(sinceMs: number = Date.now()): void {
    if (this.status === 'ready') {
      return
    }

    this.status = 'awaiting'
    this.awaitingSinceMs = sinceMs
  }

  /** Call when a real presentation layer attaches for the first time. Sticky. */
  markReady(): void {
    this.status = 'ready'
    this.awaitingSinceMs = null
  }

  isBlocking(nowMs: number = Date.now(), timeoutMs = 15_000): boolean {
    if (this.status !== 'awaiting') {
      return false
    }

    if (this.awaitingSinceMs !== null && nowMs - this.awaitingSinceMs > timeoutMs) {
      this.status = 'ready'
      this.awaitingSinceMs = null

      return false
    }

    return true
  }
}
