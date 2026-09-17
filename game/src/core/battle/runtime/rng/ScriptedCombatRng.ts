import type { CombatRng } from '../../contracts/rng'

/**
 * ScriptedCombatRng -- test/dev CombatRng that yields a fixed queue of
 * rolls in order. Throws on exhaustion: an unplanned roll in a scripted
 * scenario is a structural fault (contract sec.50), never a silent Math.random
 * fallback that would desync the expected sequence.
 */
export class ScriptedCombatRng implements CombatRng {
  private readonly queue: number[]

  constructor(rolls: readonly number[]) {
    this.queue = [...rolls]
  }

  roll(): number {
    const value = this.queue.shift()
    if (value === undefined) {
      throw new Error('ScriptedCombatRng: roll requested but the scripted queue is exhausted')
    }
    return value
  }

  rollChance(chance: number): boolean {
    // Exactly one consumption even at chance <= 0 / >= 1 -- see CombatRng.
    return this.roll() < chance
  }
}
