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
 * reads (Reflect.get, Object.getOwnPropertyDescriptor) including
 * element-callee spellings (`Reflect['get']`) and root aliases
 * (`const O = Object; O.getOwnPropertyDescriptor`), member captures
 * (`const f = ps.useProfessionPill`, `Reflect.get(ps, K)` bound
 * handles, `.bind/.call` chains, `{f: ps.useProfessionPill}` +
 * `o.f = ps...` member-position aliases), opaque code (`eval`,
 * `new Function`), `*.test*` specifier literals in any position
 * (import.meta.glob, Worker URLs, aliased require), and 4+-char
 * spelled fragments fed to string-search members - all reduce to
 * spelling the name, which is what the scan pins.
 *
 * Honest residual bound: name enumeration with no literal in sight
 * (`Object.keys(ps)` -> `ps[name]`), keys assembled at runtime
 * (crypto-style concat of variables), a bound handle passed through
 * opaque data flow and invoked far away (transitive member
 * forwarding), imported bindings, and a second wrapper authored inside
 * an allowlisted file - the allowlist is the trust boundary. Corpus
 * boundary: only `src/` + `electron/` production files are scanned;
 * tooling/scripts outside them can touch the name but are not
 * shipped lanes. Those are human-review lanes.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { join, relative } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import {
  srcCorpus,
  SCAN_TIMEOUT,
  looksLikeTestFile,
  isTestSpecifier,
  templateExpressions,
} from './helpers/scanTs'
import { scriptBlocksOf } from './helpers/commentStrip'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')
const ELECTRON_DIR = join(GAME_ROOT, 'electron')

// The ops wrapper is the single sanctioned production caller; the
// system file holds the definition itself.
const ALLOWED_CALLERS = new Set([
  'src/core/game/GameManagerPillOps.ts',
  'src/core/pill/PillSystem.ts',
])

const PINNED = 'useProfessionPill'

const GLOBAL_ROOTS = new Set([
  'globalThis',
  'window',
  'self',
  'parent',
  'frames',
  'top',
])
const REFLECTIVE_READ_ROOTS = new Set(['Object', 'Reflect'])
const INDIRECT_NAMES = new Set(['bind', 'call', 'apply'])
const FRAGMENT_CALLS = new Set([
  'startsWith', 'endsWith', 'includes', 'indexOf', 'lastIndexOf',
  'slice', 'substring', 'substr', 'charAt', 'charCodeAt', 'padStart',
  'padEnd', 'repeat', 'match', 'search', 'split', 'replace',
])
const REFLECTIVE_MEMBERS = new Set([
  'get', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors',
  'defineProperty', 'defineProperties', 'apply', 'construct',
])

/** Transparent wrappers around an expression: parens, nonnull, as,
 * satisfies, angle-bracket casts, comma sequences (`(0, x)` -> x). */
function unwrapExpr(e: ts.Expression): ts.Expression {
  let cur = e
  for (;;) {
    if (
      ts.isParenthesizedExpression(cur) ||
      ts.isNonNullExpression(cur) ||
      ts.isAsExpression(cur) ||
      ts.isSatisfiesExpression(cur)
    ) {
      cur = cur.expression
    } else if (cur.kind === ts.SyntaxKind.TypeAssertionExpression) {
      cur = (cur as ts.TypeAssertion).expression
    } else if (
      ts.isBinaryExpression(cur) &&
      cur.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
      cur = cur.right
    } else {
      return cur
    }
  }
}

/** Static knowledge a file's declarations yield. */
interface Bindings {
  constKeys: Map<string, string>
  /** Identifier bound to the pinned member: `const f = ps.useProfessionPill`,
   * `const f = Reflect.get(ps, K)`, `const f = ps.useProfessionPill.bind(ps)`. */
  memberAliases: Map<string, string>
  /** Dotted access path bound to the pinned member: `o.f = ps.useProfessionPill`,
   * `const o = {f: ps.useProfessionPill}` -> memberPaths['o.f']. */
  memberPaths: Map<string, string>
  rootAliases: Map<string, string>
}

const LITERALIZE_DEPTH_CAP = 400

/** Evaluate a spelled string position: literal, const-key binding,
 * concat/template of spelled pieces, or `String(x)` on a spelled arg.
 * `Symbol.for` is intentionally NOT resolved - a Symbol key cannot
 * equal a string member name. */
function literalize(
  e: ts.Expression | undefined,
  b: Bindings,
  depth = 0,
): string | undefined {
  if (e === undefined || depth > LITERALIZE_DEPTH_CAP) return undefined
  const un = unwrapExpr(e)
  if (ts.isStringLiteral(un) || ts.isNoSubstitutionTemplateLiteral(un)) {
    return un.text
  }
  if (ts.isIdentifier(un)) return b.constKeys.get(un.text)
  // `'a'+'a'+...` - left-associative spine iterates so deep concats
  // cannot blow the call stack.
  if (
    ts.isBinaryExpression(un) &&
    un.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    let acc = ''
    let cur: ts.Expression = un
    for (;;) {
      if (
        ts.isBinaryExpression(cur) &&
        cur.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        const r = literalize(cur.right, b, depth + 1)
        if (r === undefined) return undefined
        acc = r + acc
        cur = cur.left
      } else {
        const l = literalize(cur, b, depth + 1)
        if (l === undefined) return undefined
        return l + acc
      }
    }
  }
  if (ts.isTemplateExpression(un)) {
    let joined = un.head.text
    for (const span of un.templateSpans) {
      const mid = literalize(span.expression, b, depth + 1)
      if (mid === undefined) return undefined
      joined += mid + span.literal.text
    }
    return joined
  }
  if (
    ts.isCallExpression(un) &&
    un.arguments.length === 1 &&
    un.arguments[0] !== undefined
  ) {
    const callee = unwrapExpr(un.expression)
    const isStringCtor =
      (ts.isIdentifier(callee) && callee.text === 'String') ||
      (ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'String' &&
        ts.isIdentifier(unwrapExpr(callee.expression)) &&
        GLOBAL_ROOTS.has((unwrapExpr(callee.expression) as ts.Identifier).text))
    if (isStringCtor) return literalize(un.arguments[0], b, depth + 1)
  }
  return undefined
}

/** Dotted access path for `a.b.c` / `a['b'].c` / `this.f` chains. */
function accessPath(e: ts.Expression, b: Bindings): string | undefined {
  const un = unwrapExpr(e)
  if (ts.isIdentifier(un)) return un.text
  if (un.kind === ts.SyntaxKind.ThisKeyword) return 'this'
  if (ts.isPropertyAccessExpression(un)) {
    const base = accessPath(un.expression, b)
    return base === undefined ? undefined : `${base}.${un.name.text}`
  }
  if (ts.isElementAccessExpression(un) && un.argumentExpression !== undefined) {
    const key = literalize(un.argumentExpression, b)
    if (key === undefined) return undefined
    const base = accessPath(un.expression, b)
    return base === undefined ? undefined : `${base}.${key}`
  }
  return undefined
}

/** Member name at the end of an access: `x.f` -> 'f', `x['f']` -> 'f'. */
function memberNameOf(e: ts.Expression, b: Bindings): string | undefined {
  const un = unwrapExpr(e)
  if (ts.isPropertyAccessExpression(un)) return un.name.text
  if (
    ts.isElementAccessExpression(un) &&
    un.argumentExpression !== undefined
  ) {
    return literalize(un.argumentExpression, b)
  }
  return undefined
}

/** Root identifier name of an access chain, resolved through root
 * aliases (`const O = Object`). */
function rootOf(e: ts.Expression, b: Bindings): string | undefined {
  const path = accessPath(e, b)
  if (path === undefined) return undefined
  const head = path.split('.')[0]!
  return b.rootAliases.get(head) ?? head
}

/** True when `n` spells the pinned name in ANY syntactic position. */
function touchesPinnedName(n: ts.Node, b: Bindings): boolean {
  if (
    (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
    n.text === PINNED
  ) {
    return true
  }
  if (
    ts.isIdentifier(n) &&
    (n.text === PINNED || b.memberAliases.get(n.text) === PINNED)
  ) {
    return true
  }
  if (ts.isJsxAttribute(n) && n.name.getText() === PINNED) return true
  if (
    (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) &&
    memberNameOf(n as ts.Expression, b) === PINNED
  ) {
    return true
  }
  // Member-position alias: `box.f` was bound to the pinned member.
  if (
    (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) &&
    b.memberPaths.get(accessPath(n as ts.Expression, b) ?? '') === PINNED
  ) {
    return true
  }
  if (ts.isElementAccessExpression(n) && n.argumentExpression !== undefined) {
    // Split-literal / template keys that only partially evaluate: any
    // string fragment inside the key expression that is a 4+ char
    // substring of the pinned name remains suspect.
    const arg = n.argumentExpression
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
        const bound = b.constKeys.get(x.text)
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
    if (fragHit) return true
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
  // Reflective reads/writes with the name spelled in an argument:
  // Reflect.get(ps, 'useProfessionPill'), Reflect['get'](ps, K),
  // O.getOwnPropertyDescriptor(ps, 'useProfessionPill') with `O = Object`.
  if (ts.isCallExpression(n)) {
    const callee = unwrapExpr(n.expression)
    const member = memberNameOf(callee, b)
    const root =
      ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)
        ? rootOf(callee.expression, b)
        : undefined
    if (
      root !== undefined &&
      REFLECTIVE_READ_ROOTS.has(root) &&
      member !== undefined &&
      REFLECTIVE_MEMBERS.has(member)
    ) {
      const hit = n.arguments.some((a) => literalize(a, b) === PINNED)
      if (hit) return true
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
        if (looksLikeTestFile(file.path, file.text)) continue
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
        const sfs = blocks.map((block) =>
          ts.createSourceFile(
            block.jsx ? 'probe.tsx' : 'probe.ts',
            block.body,
            ts.ScriptTarget.ESNext,
            true,
            block.jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
          ),
        )
        // pass 1: bindings SHARED across every block of this file -
        // script + template lanes share the module scope (a const in
        // script setup is visible to template expressions).
        const binds: Bindings = {
          constKeys: new Map(),
          memberAliases: new Map(),
          memberPaths: new Map(),
          rootAliases: new Map(),
        }
        const memberOfExpr = (e: ts.Expression): string | undefined => {
          // resolves `ps.useProfessionPill`, `ps[K]`, `box.f` (memberPath),
          // `Reflect.get(ps, K)` / `O.getOwnPropertyDescriptor(ps, K)`,
          // and `.bind/.call/.apply` indirection down to the invoked
          // member name.
          const un = unwrapExpr(e)
          const direct = memberNameOf(un, binds)
          if (direct === PINNED) return PINNED
          const path = accessPath(un, binds)
          if (path !== undefined && binds.memberPaths.get(path) === PINNED) {
            return PINNED
          }
          if (ts.isIdentifier(un) && binds.memberAliases.get(un.text) === PINNED) {
            return PINNED
          }
          if (ts.isCallExpression(un)) {
            const callee = unwrapExpr(un.expression)
            const calleeMember = memberNameOf(callee, binds)
            const calleeRoot =
              ts.isPropertyAccessExpression(callee) ||
              ts.isElementAccessExpression(callee)
                ? rootOf(callee.expression, binds)
                : undefined
            if (
              calleeRoot !== undefined &&
              REFLECTIVE_READ_ROOTS.has(calleeRoot) &&
              calleeMember !== undefined &&
              REFLECTIVE_MEMBERS.has(calleeMember) &&
              un.arguments.some((a) => literalize(a, binds) === PINNED)
            ) {
              return PINNED
            }
            // `.bind/.call/.apply` chains: `fn.bind(t)` yields the
            // receiver's member; `bind.call(fn,t)` yields arg0.
            const indirectMember = (x: ts.Expression): string | undefined =>
              memberNameOf(x, binds)
            if (
              calleeMember !== undefined &&
              INDIRECT_NAMES.has(calleeMember) &&
              (ts.isPropertyAccessExpression(callee) ||
                ts.isElementAccessExpression(callee))
            ) {
              const recvExpr = callee.expression
              const recvIsIndirect = INDIRECT_NAMES.has(
                indirectMember(recvExpr) ?? '',
              )
              let target: ts.Expression
              if (
                (calleeMember === 'call' || calleeMember === 'apply') &&
                recvIsIndirect
              ) {
                const arg0 = un.arguments[0]
                if (arg0 === undefined) return undefined
                target = arg0
              } else {
                target = recvExpr
              }
              const t = memberOfExpr(target)
              if (t !== undefined) return t
            }
          }
          return undefined
        }
        const collect = (n: ts.Node): void => {
          if (
            ts.isVariableDeclaration(n) &&
            ts.isIdentifier(n.name) &&
            n.initializer !== undefined
          ) {
            const lit = literalize(n.initializer, binds)
            if (lit !== undefined) binds.constKeys.set(n.name.text, lit)
            if (memberOfExpr(n.initializer) === PINNED) {
              binds.memberAliases.set(n.name.text, PINNED)
            }
            const init = unwrapExpr(n.initializer)
            if (ts.isIdentifier(init)) {
              const p = accessPath(init, binds)
              if (
                p !== undefined &&
                (REFLECTIVE_READ_ROOTS.has(p) ||
                  p === 'Proxy' ||
                  p === 'Function')
              ) {
                binds.rootAliases.set(n.name.text, p)
              }
            } else if (
              (ts.isPropertyAccessExpression(init) ||
                ts.isElementAccessExpression(init)) &&
              rootOf(init, binds) !== undefined &&
              GLOBAL_ROOTS.has(rootOf(init, binds)!)
            ) {
              // `const R = globalThis.Reflect`
              const r = memberNameOf(init, binds)
              if (r !== undefined && REFLECTIVE_READ_ROOTS.has(r)) {
                binds.rootAliases.set(n.name.text, r)
              }
            }
            // `const o = {f: ps.useProfessionPill, g: Reflect.get(ps,K)}`
            if (ts.isObjectLiteralExpression(init)) {
              for (const prop of init.properties) {
                let propName: string | undefined
                let propInit: ts.Expression | undefined
                if (ts.isPropertyAssignment(prop)) {
                  propName = ts.isIdentifier(prop.name)
                    ? prop.name.text
                    : ts.isStringLiteral(prop.name) ||
                        ts.isNumericLiteral(prop.name)
                      ? prop.name.text
                      : ts.isComputedPropertyName(prop.name)
                        ? literalize(prop.name.expression, binds)
                        : undefined
                  propInit = prop.initializer
                }
                if (
                  propName !== undefined &&
                  propInit !== undefined &&
                  memberOfExpr(propInit) === PINNED
                ) {
                  binds.memberPaths.set(`${n.name.text}.${propName}`, PINNED)
                }
              }
            }
          }
          // `o.f = ps.useProfessionPill` / `o[K] = Reflect.get(ps,K)`
          if (
            ts.isBinaryExpression(n) &&
            n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(n.left)
          ) {
            const path = accessPath(n.left, binds)
            if (
              path !== undefined &&
              memberOfExpr(n.right) === PINNED
            ) {
              binds.memberPaths.set(path, PINNED)
            }
          }
          if (
            ts.isBinaryExpression(n) &&
            n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isElementAccessExpression(n.left)
          ) {
            const path = accessPath(n.left, binds)
            if (
              path !== undefined &&
              memberOfExpr(n.right) === PINNED
            ) {
              binds.memberPaths.set(path, PINNED)
            }
          }
          ts.forEachChild(n, collect)
        }
        for (const sf of sfs) ts.forEachChild(sf, collect)
        // pass 2: flag every syntactic touch (dedupe per file+text -
        // nested arms can match the same node twice)
        const seen = new Set<string>()
        const note = (text: string): void => {
          const entry = `${rel}: ${text.slice(0, 120)}`
          if (!seen.has(entry)) {
            seen.add(entry)
            offenders.push(entry)
          }
        }
        const visit = (n: ts.Node): void => {
          // Import barrier: `*.test*` modules are outside the funnel
          // corpus - importing one smuggles an unscanned caller.
          if (
            ts.isImportDeclaration(n) ||
            (ts.isExportDeclaration(n) && n.moduleSpecifier !== undefined)
          ) {
            const spec = ts.isImportDeclaration(n)
              ? n.moduleSpecifier
              : (n as ts.ExportDeclaration).moduleSpecifier
            if (
              spec !== undefined &&
              ts.isStringLiteral(spec) &&
              isTestSpecifier(spec.text)
            ) {
              note(`imports a test file: ${spec.getText()}`)
            }
          }
          if (
            ts.isImportEqualsDeclaration(n) &&
            ts.isExternalModuleReference(n.moduleReference) &&
            ts.isStringLiteral(n.moduleReference.expression) &&
            isTestSpecifier(n.moduleReference.expression.text)
          ) {
            note(`import= of a test file: ${n.moduleReference.getText()}`)
          }
          if (
            ts.isCallExpression(n) &&
            n.arguments[0] !== undefined &&
            ts.isStringLiteral(n.arguments[0])
          ) {
            const callee = n.expression
            const isRequire = ts.isIdentifier(callee) && callee.text === 'require'
            const isDynamic = callee.kind === ts.SyntaxKind.ImportKeyword
            if ((isRequire || isDynamic) && isTestSpecifier(n.arguments[0].text)) {
              note(
                `${isRequire ? 'require' : 'dynamic import'} of a test file: ${n.arguments[0].getText()}`,
              )
            }
          }
          // A spelled `*.test*` specifier literal ANYWHERE in
          // production: import.meta.glob, `new Worker(new URL(
          // './x.test', ...))`, aliased require - all smuggle an
          // unscanned module past the corpus. Specifiers always carry
          // a path separator; fixture ids like `root.test.1` do not.
          if (
            (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
            n.text.includes('/') &&
            isTestSpecifier(n.text)
          ) {
            note(`test-module specifier: ${n.getText()}`)
          }
          // Opaque code can spell anything.
          if (ts.isCallExpression(n)) {
            const callee = unwrapExpr(n.expression)
            if (ts.isIdentifier(callee) && callee.text === 'eval') {
              note(`eval: ${n.getText()}`)
            }
            if (
              ts.isIdentifier(callee) &&
              (binds.rootAliases.get(callee.text) ?? callee.text) === 'Function'
            ) {
              note(`Function() opaque code: ${n.getText()}`)
            }
            const member = memberNameOf(callee, binds)
            if (member !== undefined && FRAGMENT_CALLS.has(member)) {
              const fragHit = n.arguments.some((a) => {
                const lit = literalize(a, binds)
                return (
                  lit !== undefined &&
                  lit.length >= 4 &&
                  PINNED.includes(lit) &&
                  lit !== PINNED
                )
              })
              if (fragHit) note(`key-fragment arg: ${n.getText()}`)
            }
          }
          if (
            ts.isNewExpression(n) &&
            ts.isIdentifier(n.expression) &&
            (binds.rootAliases.get(n.expression.text) ?? n.expression.text) ===
              'Function'
          ) {
            note(`new Function() opaque code: ${n.getText()}`)
          }
          if (touchesPinnedName(n, binds)) {
            note(n.getText())
          }
          ts.forEachChild(n, visit)
        }
        for (const sf of sfs) ts.forEachChild(sf, visit)
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
