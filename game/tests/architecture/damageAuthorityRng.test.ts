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

  /**
   * M7 F-A -- TurnBattleSystem keeps a lazy `Math.random` CombatRng
   * default ONLY for the engine-unit/test lane (the documented
   * `vi.spyOn(Math, 'random')` interception contract). Every
   * NON-TEST construction must bind the shared cycle rng explicitly
   * -- the 8th positional arg -- so a production root can never
   * silently mint its own random source onto the canonical path.
   */
  it('every production TurnBattleSystem construction injects an explicit CombatRng', () => {
    const sites: string[] = []
    for (const file of listProductionTs(SRC)) {
      const text = readTs(file)
      let idx = text.indexOf('new TurnBattleSystem(')
      while (idx >= 0) {
        // Extract the argument list by paren depth; strip comments so
        // prose cannot satisfy or trip the assertion.
        const window = text
          .slice(idx, idx + 2000)
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
        const open = window.indexOf('(')
        let depth = 0
        let end = -1
        for (let i = open; i < window.length; i++) {
          if (window[i] === '(') depth += 1
          if (window[i] === ')') depth -= 1
          if (depth === 0) {
            end = i
            break
          }
        }
        expect(
          end >= 0,
          `TurnBattleSystem construction at ${file}:${idx} exceeds the 2000-char scan window`,
        ).toBe(true)
        const argsText = window.slice(open + 1, end)
        const args: string[] = []
        let current = ''
        let nest = 0
        for (const ch of argsText) {
          if ('([{'.includes(ch)) nest += 1
          if (')]}'.includes(ch)) nest -= 1
          if (ch === ',' && nest === 0) {
            args.push(current)
            current = ''
          } else {
            current += ch
          }
        }
        args.push(current)
        const rngArg = args[7]?.trim()
        sites.push(`${file}@${idx}`)
        expect(
          args.length >= 8 && rngArg !== undefined && rngArg !== '' && rngArg !== 'undefined',
          `TurnBattleSystem construction at ${file}:${idx} must inject an explicit CombatRng (8th arg)`,
        ).toBe(true)
        idx = text.indexOf('new TurnBattleSystem(', idx + 1)
      }
    }
    // Both production sites live in GameManagerTurnBattleOps -- the
    // gate proves they exist rather than silently passing on zero.
    expect(sites.length).toBeGreaterThanOrEqual(1)
  })
})
