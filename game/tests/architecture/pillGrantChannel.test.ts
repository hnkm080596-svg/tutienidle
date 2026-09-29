/**
 * Pill grant-channel funnel guard (ruling 2026-09-29, follow-up).
 *
 * PillSystem.useProfessionPill is the baseStats pill authority, but it
 * is a stateless public method: calling it directly mints stats with
 * zero gates - no bag ownership/consumption, no realm check, no
 * in_battle refusal, no cap preflight. Every semantic gate lives in
 * GameManagerPillOps.usePillDetailed, which is the ONLY sanctioned
 * production caller. This guard pins that funnel.
 *
 * AST-based: ANY syntactic touch of the name `useProfessionPill` in a
 * non-allowed production file is flagged - property access, bracket
 * access, destructuring alias, const-string keys (`const m =
 * 'useProfessionPill'; ps[m]`), split-literal keys (`ps['useProfession'
 * + 'Pill']`, ``ps[`useProfession${'Pill'}`]``), reflective reads
 * (Reflect.get, Object.getOwnPropertyDescriptor), and .call/.apply/
 * .bind indirection - all reduce to spelling the name, which is what
 * the scan pins.
 *
 * Honest residual bound: name enumeration with no literal in sight
 * (`Object.keys(ps)` -> `ps[name]`), keys assembled at runtime
 * (crypto-style concat of variables), eval/imported bindings, and a
 * second wrapper authored inside an allowlisted file - the allowlist
 * is the trust boundary. Those are human-review lanes.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { join, relative } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { srcCorpus, SCAN_TIMEOUT } from './helpers/scanTs'
import { scriptBlocksOf } from './helpers/commentStrip'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')
const ELECTRON_DIR = join(GAME_ROOT, 'electron')

const TEST_EXT_RE = /\.test\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/

// The ops wrapper is the single sanctioned production caller; the
// system file holds the definition itself.
const ALLOWED_CALLERS = new Set([
  'src/core/game/GameManagerPillOps.ts',
  'src/core/pill/PillSystem.ts',
])

const PINNED = 'useProfessionPill'

/** Reflective lookup APIs that turn a string into a method handle. */
const REFLECTIVE_READ_ROOTS = new Set(['Object', 'Reflect'])

/** Expression-bearing regions in a .vue template (same lane as the
 * write-authority guard). */
function templateExpressions(text: string): string[] {
  const exprs: string[] = []
  const attrRe = /(?:^|\s)(?:v-|@|:|#)[\w:._-]*\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  const interpRe = /\{\{((?:[^{}]|\{[^{}]*\})*)\}\}/g
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(text)) !== null) {
    const v = m[1] ?? m[2] ?? m[3]
    if (v !== undefined && v.length > 0) exprs.push(v)
  }
  while ((m = interpRe.exec(text)) !== null) {
    const v = m[1]
    if (v !== undefined && v.length > 0) exprs.push(v)
  }
  return exprs
}

/**
 * True when `n` spells the pinned name directly or via a fragment that
 * can only concatenate to it (a string literal of 4+ chars contained
 * verbatim in PINNED counts as a split-literal attempt).
 */
function touchesPinnedName(n: ts.Node, constKeys: ReadonlySet<string>): boolean {
  if (ts.isPropertyAccessExpression(n) && n.name.text === PINNED) return true
  if (ts.isElementAccessExpression(n) && n.argumentExpression !== undefined) {
    const arg = n.argumentExpression
    if (
      (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) &&
      arg.text === PINNED
    ) {
      return true
    }
    if (ts.isIdentifier(arg) && constKeys.has(arg.text)) return true
    // Split-literal / template keys: any string fragment inside the key
    // expression that is a 4+ char substring of the pinned name.
    let fragHit = false
    const walk = (x: ts.Node): void => {
      if (fragHit) return
      if (
        (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) &&
        x.text.length >= 4 &&
        PINNED.includes(x.text)
      ) {
        fragHit = true
        return
      }
      if (ts.isIdentifier(x) && constKeys.has(x.text)) {
        fragHit = true
        return
      }
      ts.forEachChild(x, walk)
    }
    walk(arg)
    return fragHit
  }
  if (ts.isBindingElement(n)) {
    const prop = n.propertyName
    if (
      prop !== undefined &&
      (ts.isIdentifier(prop) ||
        ts.isStringLiteral(prop) ||
        ts.isNoSubstitutionTemplateLiteral(prop)) &&
      prop.text === PINNED
    ) {
      return true
    }
    if (prop === undefined && ts.isIdentifier(n.name) && n.name.text === PINNED) {
      return true
    }
  }
  // Reflective method reads with the name spelled in an argument:
  // Reflect.get(ps, 'useProfessionPill'),
  // Object.getOwnPropertyDescriptor(ps, 'useProfessionPill'),
  // Object.defineProperty(ps, 'useProfessionPill', {...}).
  if (ts.isCallExpression(n)) {
    const callee = n.expression
    if (ts.isPropertyAccessExpression(callee)) {
      const root = ts.isIdentifier(callee.expression)
        ? callee.expression.text
        : callee.expression.getText()
      if (
        REFLECTIVE_READ_ROOTS.has(root) &&
        ['get', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors', 'defineProperty', 'defineProperties', 'apply'].includes(
          callee.name.text,
        )
      ) {
        const hit = n.arguments.some((a) => {
          let found = false
          const walk = (x: ts.Node): void => {
            if (found) return
            if (
              (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) &&
              x.text === PINNED
            ) {
              found = true
              return
            }
            if (ts.isIdentifier(x) && constKeys.has(x.text)) {
              found = true
              return
            }
            ts.forEachChild(x, walk)
          }
          walk(a)
          return found
        })
        if (hit) return true
      }
    }
  }
  return false
}

describe('pill grant channel - ops wrapper is the only production caller', () => {
  it(
    'no production file touches useProfessionPill outside GameManagerPillOps',
    { timeout: SCAN_TIMEOUT },
    () => {
      const offenders: string[] = []
      const corpus = [...srcCorpus(SRC_DIR)]
      if (existsSync(ELECTRON_DIR)) corpus.push(...srcCorpus(ELECTRON_DIR))
      for (const file of corpus) {
        if (TEST_EXT_RE.test(file.path)) continue
        const rel = relative(GAME_ROOT, file.path).replaceAll('\\', '/')
        if (ALLOWED_CALLERS.has(rel)) continue
        const text = readFileSync(file.path, 'utf8')
        const blocks = rel.endsWith('.vue')
          ? scriptBlocksOf(text).map((b) => ({ body: b.body, jsx: b.jsx }))
          : [{ body: text, jsx: rel.endsWith('.tsx') || rel.endsWith('.jsx') }]
        if (rel.endsWith('.vue')) {
          for (const expr of templateExpressions(text)) {
            blocks.push({ body: `function __t(){ ${expr} }`, jsx: false })
          }
        }
        for (const block of blocks) {
          const sf = ts.createSourceFile(
            block.jsx ? 'probe.tsx' : 'probe.ts',
            block.body,
            ts.ScriptTarget.ESNext,
            true,
            block.jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
          )
          // pass 1: const keys bound to the pinned name
          const constKeys = new Set<string>()
          const collectKeys = (n: ts.Node): void => {
            if (
              ts.isVariableDeclaration(n) &&
              ts.isIdentifier(n.name) &&
              n.initializer !== undefined &&
              (ts.isStringLiteral(n.initializer) ||
                ts.isNoSubstitutionTemplateLiteral(n.initializer)) &&
              n.initializer.text === PINNED
            ) {
              constKeys.add(n.name.text)
            }
            ts.forEachChild(n, collectKeys)
          }
          ts.forEachChild(sf, collectKeys)
          // pass 2: flag every syntactic touch
          const visit = (n: ts.Node): void => {
            if (touchesPinnedName(n, constKeys)) {
              offenders.push(`${rel}: ${n.getText(sf).slice(0, 120)}`)
            }
            ts.forEachChild(n, visit)
          }
          ts.forEachChild(sf, visit)
        }
      }
      expect(
        offenders,
        'A production file touched PillSystem.useProfessionPill directly - ' +
          'that mints baseStats with zero ownership/realm/battle/cap gates. ' +
          'Go through GameManagerPillOps.usePillDetailed.',
      ).toEqual([])
    },
  )
})
