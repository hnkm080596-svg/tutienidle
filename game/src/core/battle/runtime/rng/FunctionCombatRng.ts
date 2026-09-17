import type { CombatRng } from '../../contracts/rng'

/**
 * FunctionCombatRng — adapts a bare `() => number` source (e.g. the
 * legacy per-cycle closure, `Math.random`) to the CombatRng interface.
 *
 * The source is invoked once per roll — lazily, at call time — so a
 * `() => Math.random()` wrapper stays interceptable by
 * `vi.spyOn(Math, 'random')` and a shared closure keeps its position in
 * the stream.
 */
export class FunctionCombatRng implements CombatRng {
  private readonly source: () => number

  constructor(source: () => number) {
    this.source = source
  }

  roll(): number {
    return this.source()
  }

  rollChance(chance: number): boolean {
    // Exactly one consumption even at chance <= 0 / >= 1 — see CombatRng.
    return this.roll() < chance
  }
}
