// Final cultivation-gain diversion seam (design 2026-09-23 sec.10, master
// spec sec.8 HIDDEN-B pin) - the Quan The hidden mechanism hooks the point
// where addCultivation applies an incoming gain. CultivationSystem owns
// the call site; this module owns the registry so a mechanism registers
// itself WITHOUT editing CultivationSystem.
//
// Contract for a registered diverter:
//   - input: the player receiving the gain and the raw (pre-clamp)
//     amount addCultivation was asked to apply.
//   - returns the amount that actually lands on cultivation
//     (0 <= returned <= amount). The diverter owns the remainder
//     (the "diverted" share) - typically banking it into its own
//     mechanic state.
//   - TOTAL-CONSERVING: returning more than the input amount is a
//     contract violation; the call site asserts in dev and clamps.
//   - diversifiers run in registration order; each sees the amount
//     left by the previous (chain semantics - one diverter today).
//   - the diverter runs BEFORE the tier-required clamp, so a diverted
//     share never counts toward overflow either.

export interface FinalCultivationGainPlayer {
  realmId: string
  cultivation: number
  hiddenPerfection?: { realms: Record<string, unknown> }
}

export type FinalCultivationDiversion = (
  player: FinalCultivationGainPlayer,
  amount: number,
) => number

const DIVERSIONS: FinalCultivationDiversion[] = []

/**
 * Sibling-mission registration seam (HIDDEN-B Quan The). Registration
 * happens at the mechanism module's load time; the call site inside
 * addCultivation iterates this list on every gain.
 */
export function registerFinalCultivationDiversion(diverter: FinalCultivationDiversion): void {
  DIVERSIONS.push(diverter)
}

/** Test hook: clears the registry. Never called by production code. */
export function clearFinalCultivationDiversions(): void {
  DIVERSIONS.length = 0
}

/**
 * Run the registered diversion chain over an incoming gain. Returns the
 * amount that should land. An empty registry (today, before HIDDEN-B)
 * is a no-op returning the input unchanged.
 */
export function resolveFinalCultivationGain(
  player: FinalCultivationGainPlayer,
  amount: number,
): number {
  let remaining = amount
  for (const diverter of DIVERSIONS) {
    const landed = diverter(player, remaining)
    if (landed < 0 || landed > remaining || !Number.isFinite(landed)) {
      throw new Error(
        `FinalCultivationDiversion contract violation: returned ${landed} for input ${remaining}`,
      )
    }
    remaining = landed
  }
  return remaining
}
