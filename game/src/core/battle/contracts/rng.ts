// contracts/rng.ts — INTERFACE only here; impls live in runtime/rng/.

export interface CombatRng {
  /** One consumption, always — no early-return shortcuts. */
  roll(): number
  /** Consumes exactly ONE roll even at chance<=0 / >=1 (legacy parity:
      `rng() < chance` always consumed — skipping the roll at 0/1 shifts
      the whole stream). */
  rollChance(chance: number): boolean
}
