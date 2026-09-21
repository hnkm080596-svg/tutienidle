// P6-M1 - shared deterministic battle driver, extracted from
// runBattle's inline loop (plan Risk #4: one driver, two session hosts -
// the disposable benchmark battle AND the persistent EarlyGameSession
// drive the SAME stepping code). The caller supplies the consumed-step
// counter: metrics runs count via the collector's snapshot cadence, the
// early-game session counts clock advances directly.
import type { GameManager } from '../game/GameManager'
import type { ManualClockSource } from '../battle/turn/CombatClock'
import { COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'

export type BattleDriveOutcome = 'victory' | 'defeat' | 'timeout'

export interface BattleDriveOptions {
  gameManager: GameManager
  clock: ManualClockSource
  /** Consumed-step budget; drive stops as 'timeout' when reached. */
  maxConsumedSteps: number
  /**
   * Consumed-step counter - the authority on progress. Metrics runs pass
   * `() => collector.steps` (snapshot cadence); advance-counted hosts
   * pass a counter incremented per clock.advance call.
   */
  countSteps: () => number
  /** Fed-time chunk per advance (default: one combat step). A coarse
   * chunk can consume several steps per advance; feeding is clamped to
   * the remaining budget so consumed steps never overshoot the cap. */
  advanceChunkSeconds?: number
  /** Advances without consumed-step progress before declaring a stall
   * (engine paused mid-fight). Default 10_000 - generous, sub-step
   * chunks need several advances per consumed step. */
  stallLimit?: number
  /** Null-battle handling: default 'defeat' (post-teardown read). A
   * metrics run throws instead - an encounter that produced no battle
   * is a harness bug, not an outcome. */
  onMissingBattle?: () => BattleDriveOutcome
  /** Called after every clock.advance - advance-counted hosts
   * increment their step counter here. */
  onAdvance?: () => void
}

export function driveTurnBattleToTerminal(
  options: BattleDriveOptions,
): BattleDriveOutcome {
  const { gameManager, clock } = options
  const stallLimit = options.stallLimit ?? 10_000
  let lastSteps = -1
  let stalledAdvances = 0

  while (true) {
    const battle = gameManager.getTurnBattle()
    if (!battle) return options.onMissingBattle?.() ?? 'defeat'
    if (battle.state === 'victory') return 'victory'
    if (battle.state === 'defeat') return 'defeat'

    const consumed = options.countSteps()
    if (consumed >= options.maxConsumedSteps) return 'timeout'

    const remaining = options.maxConsumedSteps - consumed
    const feedSeconds = Math.min(
      options.advanceChunkSeconds ?? COMBAT_STEP_SECONDS,
      remaining * COMBAT_STEP_SECONDS,
    )
    clock.advance(feedSeconds)
    options.onAdvance?.()

    const after = options.countSteps()
    if (after === lastSteps) {
      if (++stalledAdvances >= stallLimit) return 'timeout'
    } else {
      stalledAdvances = 0
      lastSteps = after
    }
  }
}
