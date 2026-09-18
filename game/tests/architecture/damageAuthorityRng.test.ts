/**
 * Skill-Definition post-merge guard (Finding 1): canonical battle damage
 * consumes ONE CombatRng source -- the battle's cycle rng.
 *
 *   - CombatSystemDamageAdapter (the DamageAuthority) must never mint or
 *     fall back to an implicit random source: `rng` is a required dep.
 *   - Every production construction site must bind an EXISTING rng
 *     (the shared cycle rng), never a freshly-minted inline source --
 *     a second `new FunctionCombatRng(() => Math.random())` inside a
 *     deps literal would silently fork the deterministic stream.
 *
 * Deliberately NOT asserted: the ops-level cycle-rng default
 * (`FunctionCombatRng(() => Math.random())` in GameManagerTurnBattleOps)
 * is the documented UNSEEDED-battle fallback owned by the GameManager
 * wiring -- one canonical source, not an adapter-side fork.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { listProductionTs, readTs } from './helpers/scanTs'

const SRC = join(process.cwd(), 'src')
const ADAPTER = join(SRC, 'core/battle/runtime/scheduler/adapters/CombatSystemDamageAdapter.ts')

describe('damage authority rng -- single canonical source', () => {
  it('the canonical adapter never references an implicit random source', () => {
    const source = readTs(ADAPTER)
    expect(source.match(/Math\.random/g) ?? []).toEqual([])
    expect(source.match(/new (Function|Seeded|Scripted)CombatRng/g) ?? []).toEqual([])
  })

  it('every CombatSystemDamageAdapter construction binds an existing rng -- never an inline mint', () => {
    const sites: string[] = []
    for (const file of listProductionTs(SRC)) {
      if (file === ADAPTER) continue
      const text = readTs(file)
      let idx = text.indexOf('new CombatSystemDamageAdapter')
      while (idx >= 0) {
        // The deps literal closes well within 800 chars of `new`.
        // Comments are stripped so prose containing 'rng' cannot
        // satisfy or trip the assertion.
        const deps = text
          .slice(idx, idx + 800)
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
        sites.push(`${file}@${idx}`)
        // `rng: x` or shorthand `{ rng }` -- either binds an existing source.
        expect(deps, `adapter construction at ${file}:${idx} must pass rng:`).toMatch(
          /\brng\s*[:,}]/,
        )
        expect(
          deps.match(/new (Function|Seeded|Scripted)CombatRng|Math\.random/g) ?? [],
          `adapter construction at ${file}:${idx} mints its own rng -- bind the shared cycle rng`,
        ).toEqual([])
        idx = text.indexOf('new CombatSystemDamageAdapter', idx + 1)
      }
    }
    // The production wiring site must exist -- the gate silently
    // passing with zero sites would prove nothing.
    expect(sites.length).toBeGreaterThanOrEqual(1)
  })
})
