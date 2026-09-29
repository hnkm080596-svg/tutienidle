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
 * 'useProfessionPill'; ps[m]`), split-literal keys of ANY fragment
 * size (`ps['use'+'ProfessionPill']`, ``ps[`useProfession${'Pill'}`]``),
 * verbatim string literals in ANY position (including `k === 'x'`
 * comparisons), bare identifiers, JSX attribute names, reflective
 * reads (Reflect.get, Object.getOwnPropertyDescriptor), and
 * .call/.apply/.bind indirection - all reduce to spelling the name,
 * which is what the scan pins.
 *
 * Honest residual bound: name enumeration with no literal in sight
 * (`Object.keys(ps)` -> `ps[name]`), keys assembled at runtime
 * (crypto-style concat of variables), eval/imported bindings, and a
 * second wrapper authored inside an allowlisted file - the allowlist
 * is the trust boundary. Corpus boundary: only `src/` + `electron/`
 * production files are scanned; tooling/scripts outside them can
 * touch the name but are not shipped lanes - human-review territory.
 * Those are human-review lanes.
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
  const attrRe = /(?:^|\s)(?:v-|@|:|#)[\w:._[\]-]*\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  const interpRe = /\{\{((?:[^{}]|\{[^{}]*\})*)\}\}/g
  // Dynamic directive arguments: `@[expr]`, `:[expr]`, `#[expr]` - the
  // bracket contents are a JS expression evaluated per render.
  const dynRe = /(?:@|:|#)\[((?:[^\[\]"']|"[^"]*"|'[^']*')*)\]\s*=/g
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(text)) !== null) {
    const v = m[1] ?? m[2] ?? m[3]
    if (v !== undefined && v.length > 0) exprs.push(v)
  }
  while ((m = interpRe.exec(text)) !== null) {
    const v = m[1]
    if (v !== undefined && v.length > 0) exprs.push(v)
  }
  while ((m = dynRe.exec(text)) !== null) {
    const v = m[1]
    if (v !== undefined && v.length > 0) exprs.push(v)
  }
  return exprs
}

/** Evaluate a spelled string position: literal, const-key binding,
 * or a `'a'+'b'` concatenation of literals. Returns undefined when
 * the value is not statically provable. */
function literalize(
  e: ts.Expression,
  constKeys: ReadonlyMap<string, string>,
): string | undefined {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    return e.text
  }
  if (ts.isIdentifier(e)) return constKeys.get(e.text)
  if (ts.isParenthesizedExpression(e)) return literalize(e.expression, constKeys)
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = literalize(e.left, constKeys)
    const r = literalize(e.right, constKeys)
    if (l !== undefined && r !== undefined) return l + r
  }
  return undefined
}

/** True when `n` spells the pinned name in ANY syntactic position -
 * member access, element key (literal/const/concat of ANY fragment
 * size), verbatim string literal (including comparisons and
 * reflective-call args), bare identifier, binding element, or JSX
 * attribute name. */
function touchesPinnedName(n: ts.Node, constKeys: ReadonlyMap<string, string>): boolean {
  // Verbatim string literal in any position: element key, comparison
  // operand (`k === 'useProfessionPill'`), reflective arg, object
  // literal key - a spelled literal outside the allowlist is only
  // ever useful for reflective/enumerated access.
  if (
    (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
    n.text === PINNED
  ) {
    return true
  }
  // Bare identifier spelling the name: shorthand destructuring,
  // JSX props, export specifiers, computed refs - all reduce to the
  // same name token. Declaration-name positions in a non-allowed file
  // are equally suspect (shadowing the pinned name).
  if (ts.isIdentifier(n) && n.text === PINNED) return true
  if (ts.isJsxAttribute(n) && n.name.getText() === PINNED) return true
  if (ts.isPropertyAccessExpression(n) && n.name.text === PINNED) return true
  if (ts.isElementAccessExpression(n) && n.argumentExpression !== undefined) {
    const arg = n.argumentExpression
    if (literalize(arg, constKeys) === PINNED) return true
    // Split-literal / template keys that only partially evaluate: any
    // string fragment inside the key expression that is a 4+ char
    // substring of the pinned name remains suspect.
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
      if (ts.isIdentifier(x)) {
        const bound = constKeys.get(x.text)
        if (
          bound === PINNED ||
          (bound !== undefined && bound.length >= 4 && PINNED.includes(bound))
        ) {
          fragHit = true
          return
        }
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
        const hit = n.arguments.some((a) => literalize(a, constKeys) === PINNED)
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
          // pass 1: const keys bound to the pinned name (literal or
          // literalizeable concat, in declaration order)
          const constKeys = new Map<string, string>()
          const collectKeys = (n: ts.Node): void => {
            if (
              ts.isVariableDeclaration(n) &&
              ts.isIdentifier(n.name) &&
              n.initializer !== undefined
            ) {
              const lit = literalize(n.initializer, constKeys)
              if (lit !== undefined) {
                constKeys.set(n.name.text, lit)
              }
            }
            ts.forEachChild(n, collectKeys)
          }
          ts.forEachChild(sf, collectKeys)
          // pass 2: flag every syntactic touch (dedupe per file+text -
          // nested arms can match the same node twice)
          const seen = new Set<string>()
          const visit = (n: ts.Node): void => {
            if (touchesPinnedName(n, constKeys)) {
              const entry = `${rel}: ${n.getText(sf).slice(0, 120)}`
              if (!seen.has(entry)) {
                seen.add(entry)
                offenders.push(entry)
              }
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
