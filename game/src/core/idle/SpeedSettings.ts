/**
 * Real game-loop tick cadence (ms between outer ticks) - the single
 * authority consumed by useAppLifecycle's tick loop. Value only controls
 * SMOOTHNESS, never pace: the tick consumes the real measured deltaSeconds
 * (App.vue), so a delayed timer still simulates the full elapsed time and
 * combat's fixed-step coalescing (CombatScene applyPendingPositions)
 * absorbs bursts. The older 1000 -> 200 -> 100ms shortening plan never
 * landed; 1000ms is the measured live cadence.
 */
export const TICK_INTERVAL_MS = 1_000
