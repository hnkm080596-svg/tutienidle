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
const BOOTSTRAP_FILE = join(SRC, 'core/game/GameManagerTurnBattleOps.ts')

/** Replace comments with spaces -- offsets preserved, so prose tokens
    can neither satisfy nor trip a structural assertion and every index
    still addresses the original text. */
function maskComments(text: string): string {
  return text
    .replace(/\/\/[^\n]*/g, (match) => ' '.repeat(match.length))
    .replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length))
}

/** The [openBrace, closeBrace) span of the `constructor(...)` body of
    `className` in comment-masked source: anchored at the class
    declaration so a helper class earlier in the file cannot shadow the
    lookup; paren-match the parameter list first (the inline deps object
    type nests braces INSIDE the parens), then brace-match the body. */
function constructorBodySpan(
  masked: string,
  className: string,
): { start: number; end: number } | undefined {
  const classIdx = masked.search(new RegExp(`\\bclass\\s+${className}\\b`))
  if (classIdx < 0) return undefined
  const kw = masked.slice(classIdx).search(/\bconstructor\s*\(/)
  if (kw < 0) return undefined
  const ctorAt = classIdx + kw
  const openParen = masked.indexOf('(', ctorAt)
  let depth = 0
  let closeParen = -1
  for (let i = openParen; i < masked.length; i++) {
    if (masked[i] === '(') depth += 1
    if (masked[i] === ')') {
      depth -= 1
      if (depth === 0) {
        closeParen = i
        break
      }
    }
  }
  if (closeParen < 0) return undefined
  const openBrace = masked.indexOf('{', closeParen)
  if (openBrace < 0) return undefined
  depth = 0
  for (let i = openBrace; i < masked.length; i++) {
    if (masked[i] === '{') depth += 1
    if (masked[i] === '}') {
      depth -= 1
      if (depth === 0) return { start: openBrace, end: i }
    }
  }
  return undefined
}

/** Parse the positional args of `new TurnBattleSystem(...)` at `idx` in
    `text`: comments are stripped first (prose cannot satisfy or trip an
    assertion), the arg list is found by paren depth within a 2000-char
    window, and split on top-level commas (nesting tracked via
    ()[]{}). Returns undefined when the window truncates the call. */
function constructionArgs(text: string, idx: number): string[] | undefined {
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
  if (end < 0) return undefined
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
  return args
}

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
        const args = constructionArgs(text, idx)
        expect(
          args !== undefined,
          `TurnBattleSystem construction at ${file}:${idx} exceeds the 2000-char scan window`,
        ).toBe(true)
        const rngArg = args![7]?.trim()
        sites.push(`${file}@${idx}`)
        expect(
          args!.length >= 8 && rngArg !== undefined && rngArg !== '' && rngArg !== 'undefined',
          `TurnBattleSystem construction at ${file}:${idx} must inject an explicit CombatRng (8th arg)`,
        ).toBe(true)
        idx = text.indexOf('new TurnBattleSystem(', idx + 1)
      }
    }
    // Both production sites live in GameManagerTurnBattleOps -- the
    // gate proves they exist rather than silently passing on zero.
    expect(sites.length).toBeGreaterThanOrEqual(1)
  })

  /**
   * M7.5c -- the runtime===undefined engine lane is the RETIRED active-
   * skill execution representation, kept only as the engine-unit test
   * lane. A production root that constructs TurnBattleSystem without a
   * TurnCombatRuntime silently routes every cast through it. The ONE
   * legitimate undefined-runtime site is the documented bootstrap
   * placeholder in the GameManagerTurnBattleOps CONSTRUCTOR -- inert by
   * construction (stepTurnBattle early-returns until beginBattleCycle
   * replaces it). The guard asserts the exact approved identity -- file
   * AND constructor-body membership -- so an unrelated future
   * runtime-less site fails even when the total count stays one.
   */
  it('the only runtime-omitting TurnBattleSystem construction is the GameManagerTurnBattleOps bootstrap constructor', () => {
    const runtimeLess: { file: string; idx: number }[] = []
    for (const file of listProductionTs(SRC)) {
      const text = readTs(file)
      let idx = text.indexOf('new TurnBattleSystem(')
      while (idx >= 0) {
        const args = constructionArgs(text, idx)
        expect(
          args !== undefined,
          `TurnBattleSystem construction at ${file}:${idx} exceeds the 2000-char scan window`,
        ).toBe(true)
        const runtimeArg = args![4]?.trim()
        if (runtimeArg === undefined || runtimeArg === '' || runtimeArg === 'undefined') {
          runtimeLess.push({ file, idx })
        }
        idx = text.indexOf('new TurnBattleSystem(', idx + 1)
      }
    }
    expect(
      runtimeLess.map((site) => site.file),
      `production TurnBattleSystem sites without a TurnCombatRuntime must be exactly the documented bootstrap placeholder: ${runtimeLess.map((s) => `${s.file}@${s.idx}`).join(', ')}`,
    ).toEqual([BOOTSTRAP_FILE])
    const span = constructorBodySpan(maskComments(readTs(BOOTSTRAP_FILE)), 'GameManagerTurnBattleOps')
    expect(span !== undefined, 'GameManagerTurnBattleOps constructor not found').toBe(true)
    const site = runtimeLess[0]!
    expect(
      site.idx > span!.start && site.idx < span!.end,
      `the runtime-less site at ${BOOTSTRAP_FILE}:${site.idx} must sit inside the constructor body (the bootstrap placeholder -- not a runtime-bound method like beginBattleCycle)`,
    ).toBe(true)
    // Structural identity: the placeholder assigns the disposable engine
    // to `this.turnBattleSystem` -- an unrelated runtime-less
    // construction inside the same constructor still fails.
    const assignment = maskComments(readTs(BOOTSTRAP_FILE)).slice(Math.max(0, site.idx - 80), site.idx)
    expect(
      /this\.turnBattleSystem\s*=\s*$/.test(assignment),
      `the runtime-less site at ${BOOTSTRAP_FILE}:${site.idx} must be the \`this.turnBattleSystem =\` bootstrap assignment`,
    ).toBe(true)
  })
})
