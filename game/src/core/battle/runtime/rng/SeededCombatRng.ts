import type { CombatRng } from '../../contracts/rng'

/**
 * SeededCombatRng — mulberry32, a tiny deterministic 32-bit PRNG.
 *
 * Algorithm (per roll):
 *   state = (state + 0x6D2B79F5) mod 2^32         // Weyl-sequence step
 *   t     = state
 *   t     = imul(t ^ (t >>> 15), t | 1)           // avalanche mix
 *   t     = t ^ (t + imul(t ^ (t >>> 7), t | 61)) // second mix round
 *   out   = ((t ^ (t >>> 14)) >>> 0) / 2^32       // -> [0, 1)
 *
 * Same seed -> identical sequence. This MUST stay bit-identical to
 * `mulberry32` in core/battle/SeededRandom.ts — the M4 reroute swaps the
 * legacy cycle `() => number` for this class and the roll stream must not
 * shift. The implementation is duplicated here on purpose: runtime/ keeps
 * its dependency surface to contracts/ only.
 */
export class SeededCombatRng implements CombatRng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  roll(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0

    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  rollChance(chance: number): boolean {
    // Consumes exactly ONE roll even when the outcome is forced
    // (chance <= 0 / >= 1): legacy `rng() < chance` parity — skipping the
    // roll would shift every subsequent consumer of the stream.
    return this.roll() < chance
  }
}
