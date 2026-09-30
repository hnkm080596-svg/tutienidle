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
 * `o.f = ps...` member-position aliases), opaque code (`eval` and
 * global-name destructures like `const {eval: e} = globalThis`,
 * `x.eval(c)`/`x.constructor(c)` member calls, `new Function`,
 * setTimeout/setInterval string args, `new Worker`/`SharedWorker`,
 * opaque/data:/blob: `import()` channels), indirect invocation via
 * `.call/.apply/.bind` on a receiver that resolves to the pinned
 * handle (`ps.useProfessionPill.call(t)`), `*.test*` specifier
 * literals in any position or shape (`/` paths, `*`/`{`/`?` glob and
 * query forms; import.meta.glob, Worker URLs, aliased require,
 * literalized specifiers), and 4+-char
 * spelled fragments fed to string-search members - all reduce to
 * spelling the name, which is what the scan pins. R13 additions:
 * opaque handles carry through re-alias (`const g = mm`),
 * `.bind/.call/.apply` (`const b = mm.bind(t)`, `mm.call(t)`),
 * `new mm()` construction, and clone-carrier dispatch
 * (`structuredClone(ps)[k]()`, `wrap(ps)[k]()`) - a call fed the
 * pill system returns a pill-ish carrier. R14 additions: resolved
 * enumeration-member callees (`const k = Object.keys; k(ps)`,
 * `const rd = Object.getOwnPropertyDescriptor`, `const g =
 * globalThis.Reflect.get` - a bound global member invoked by name),
 * the `get` member read (`Reflect.get(ps, k)`, `ps.get(k)` gated on
 * a Reflect/Object/global/pill-ish root so `map.get(ps)` stays
 * silent), element-position `.bind/.call/.apply` captures
 * (`const b = ps[k].bind(ps)`), `new Proxy(ps, {})` forwarding
 * carriers, and member-position pill carriers (`this.ps[k]`,
 * `holder.pill[k]`).
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

// A pill-system-ish name: `ps` exact, or `pill`/`pillSystem`/`pillOps`
// camel-start. `pillar`/`spill`/`pillow` are ordinary words - substring
// matching on 'pill' was a proven false positive (R14 FP4); a camelCase
// `myPill` root is the documented bound instead.
const PILLISH_NAME_RE = /^pill(?=[A-Z_]|$)|^ps$/i

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
/** Global names a destructure (`const {eval: e} = globalThis`) can
 * capture into a local opaque-code handle. */
const GLOBAL_NAMES = new Set([
  'eval', 'Function', 'Object', 'Reflect', 'Proxy', 'Worker',
  'SharedWorker', 'Promise', 'globalThis', 'window', 'setTimeout',
  'setInterval', 'document', 'import', 'require', 'process',
])
const FRAGMENT_CALLS = new Set([
  'startsWith', 'endsWith', 'includes', 'indexOf', 'lastIndexOf',
  'slice', 'substring', 'substr', 'charAt', 'charCodeAt', 'padStart',
  'padEnd', 'repeat', 'match', 'search', 'split', 'replace',
])
const REFLECTIVE_MEMBERS = new Set([
  'get', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors',
  'defineProperty', 'defineProperties', 'apply', 'construct',
])
/** Member names that enumerate or read slots of a pill-ish root:
 * `Object.keys(ps)`, `Reflect.get(ps, k)`, `Object.getOwnProperty*`. */
const ENUMERATE_MEMBERS = new Set([
  'keys', 'values', 'entries', 'ownKeys', 'get',
  'getOwnPropertyNames', 'getOwnPropertyDescriptors',
  'getOwnPropertyDescriptor',
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
  /** Identifier bound to an UNRESOLVED value off a pill-ish root:
   * `const mm = ps[k]`, `const g = Reflect.get(ps, k)`,
   * `const d = getOwnPropertyDescriptor(ps,k).value` - invoking it
   * reaches an opaque member slot. */
  opaqueHandles: Set<string>
  /** Identifier bound to a one-step pill carrier whose own name is
   * opaque: `const c = {...ps}`, `const c = {s: ps}`, `const [m] = [ps]`,
   * `new Box(ps)` - member/element reads on it forward pill slots. */
  pillCarriers: Set<string>
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
  if (ts.isCallExpression(un)) {
    const callee = unwrapExpr(un.expression)
    const isStringCtor =
      (ts.isIdentifier(callee) && callee.text === 'String') ||
      (ts.isPropertyAccessExpression(callee) &&
        callee.name.text === 'String' &&
        ts.isIdentifier(unwrapExpr(callee.expression)) &&
        GLOBAL_ROOTS.has((unwrapExpr(callee.expression) as ts.Identifier).text))
    if (
      isStringCtor &&
      un.arguments.length === 1 &&
      un.arguments[0] !== undefined
    ) {
      return literalize(un.arguments[0], b, depth + 1)
    }
    // Pure string methods on spelled receivers - deterministic name
    // assembly channels (`['use','Profession','Pill'].join('')`).
    if (
      ts.isPropertyAccessExpression(callee) ||
      ts.isElementAccessExpression(callee)
    ) {
      const m =
        ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : literalize(callee.argumentExpression, b, depth + 1)
      const recv = unwrapExpr(callee.expression)
      if (m === 'join' && ts.isArrayLiteralExpression(recv)) {
        const parts: string[] = []
        let ok = true
        for (const el of recv.elements) {
          const piece = ts.isSpreadElement(el) ? el.expression : (el as ts.Expression)
          const lit = literalize(piece, b, depth + 1)
          if (lit === undefined) {
            ok = false
            break
          }
          parts.push(lit)
        }
        const sep =
          un.arguments[0] !== undefined
            ? literalize(un.arguments[0], b, depth + 1)
            : undefined
        if (ok) return parts.join(sep ?? ',')
      }
      const recvLit = literalize(recv, b, depth + 1)
      if (recvLit !== undefined && m !== undefined) {
        const arg0 =
          un.arguments[0] !== undefined
            ? literalize(un.arguments[0], b, depth + 1)
            : undefined
        switch (m) {
          case 'concat': {
            const rest: string[] = []
            let ok = true
            for (const a of un.arguments) {
              const lit = literalize(a, b, depth + 1)
              if (lit === undefined) {
                ok = false
                break
              }
              rest.push(lit)
            }
            if (ok) return recvLit + rest.join('')
            break
          }
          case 'trim':
            return recvLit.trim()
          case 'toLowerCase':
            return recvLit.toLowerCase()
          case 'toUpperCase':
            return recvLit.toUpperCase()
          case 'repeat':
            if (arg0 !== undefined && /^\d+$/.test(arg0)) {
              return recvLit.repeat(parseInt(arg0, 10))
            }
            break
        }
      }
    }
  }
  return undefined
}

/** Dotted access path for `a.b.c` / `a['b'].c` / `this.f` chains.
 * Iterative (a pathological deep chain cannot exhaust the call stack);
 * beyond ACCESS_PATH_CAP segments the chain is treated as opaque - a
 * documented residual bound, not a crash. */
const ACCESS_PATH_CAP = 512
function accessPath(e: ts.Expression, b: Bindings): string | undefined {
  const parts: string[] = []
  let cur: ts.Expression = e
  for (;;) {
    if (parts.length > ACCESS_PATH_CAP) return undefined
    const un = unwrapExpr(cur)
    if (ts.isIdentifier(un)) {
      parts.unshift(un.text)
      return parts.join('.')
    }
    if (un.kind === ts.SyntaxKind.ThisKeyword) {
      parts.unshift('this')
      return parts.join('.')
    }
    if (ts.isPropertyAccessExpression(un)) {
      parts.unshift(un.name.text)
      cur = un.expression
      continue
    }
    if (ts.isElementAccessExpression(un) && un.argumentExpression !== undefined) {
      const key = literalize(un.argumentExpression, b)
      if (key === undefined) return undefined
      parts.unshift(key)
      cur = un.expression
      continue
    }
    return undefined
  }
}

/** Depth-safe preorder walk - recursion on a deeply nested expression
 * (a generated 20k-member chain) overflows the stack. */
function walkAll(root: ts.Node, cb: (n: ts.Node) => boolean | void): void {
  const stack: ts.Node[] = [root]
  while (stack.length > 0) {
    const n = stack.pop()!
    if (cb(n) === true) continue
    n.forEachChild((c) => {
      stack.push(c)
    })
  }
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
    n.text.includes(PINNED)
  ) {
    // Spelled inside a longer payload string (script text, error text,
    // generated code) - the name is verbatim inside, so the lane is
    // still a spelled touch.
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
    walkAll(arg, (x) => {
      if (fragHit) return true
      if (
        (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) &&
        x.text.length >= 4 &&
        PINNED.includes(x.text)
      ) {
        fragHit = true
        return true
      }
      if (ts.isIdentifier(x)) {
        const bound = b.constKeys.get(x.text)
        if (
          bound === PINNED ||
          (bound !== undefined && bound.length >= 4 && PINNED.includes(bound))
        ) {
          fragHit = true
          return true
        }
      }
      return
    })
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
          // `<script src="./x.test.ts">` - an external script lane
          // neither scriptBlocksOf nor the attr scanner can see; a
          // Vue SFC never legitimately uses one.
          if (/<script[^>]*\bsrc\s*=/i.test(text)) {
            offenders.push(`${rel}: <script src> unscanned external script`)
          }
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
          opaqueHandles: new Set(),
          pillCarriers: new Set(),
        }
        // A pill-system-ish root: `ps`, `pillSystem`, a renamed
        // binding of one (`const s2 = ps`), etc.
        const pillish = (e: ts.Expression): boolean => {
          const r = rootOf(e, binds)
          return r !== undefined && PILLISH_NAME_RE.test(r)
        }
        // A carrier bound to a pill-ish value under an opaque name:
        // `{...ps}`, `{s: ps}`, `[ps]`, `new Box(ps)` - member/element
        // reads forward the carried slots (conditional/await receivers
        // unwrap the same way).
        const carrierPillish = (e: ts.Expression): boolean => {
          const u = unwrapExpr(e)
          if (ts.isIdentifier(u)) return binds.pillCarriers.has(u.text)
          if (ts.isAwaitExpression(u)) return carrierPillish(u.expression)
          if (ts.isConditionalExpression(u)) {
            return carrierPillish(u.whenTrue) || carrierPillish(u.whenFalse)
          }
          if (
            ts.isBinaryExpression(u) &&
            (u.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
              u.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
              u.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
          ) {
            return carrierPillish(u.left) || carrierPillish(u.right)
          }
          if (
            ts.isPropertyAccessExpression(u) ||
            ts.isElementAccessExpression(u)
          ) {
            return carrierPillish(u.expression)
          }
          if (ts.isNewExpression(u)) {
            return (
              u.arguments !== undefined &&
              u.arguments.some((a) => pillish(unwrapExpr(a)) || carrierPillish(a))
            )
          }
          if (ts.isCallExpression(u)) {
            // Clone/wrap-shaped callees only - `m.get(pill.id)` reads
            // an unrelated slot and must not carry.
            const cc = unwrapExpr(u.expression)
            const cn = memberNameOf(cc, binds) ??
              (ts.isIdentifier(cc) ? cc.text : undefined)
            return (
              cn !== undefined &&
              /clone|wrap|copy|snapshot|structur|proxy|boxed?/i.test(cn) &&
              u.arguments.some(
                (a) => pillish(unwrapExpr(a)) || carrierPillish(a),
              )
            )
          }
          return false
        }
        // The dispatch receiver itself: a pill-ish root OR a carrier,
        // unwrapping conditional/await/coalesce wrappers.
        const receiverPillish = (e: ts.Expression): boolean => {
          const u = unwrapExpr(e)
          if (pillish(u) || carrierPillish(u)) return true
          if (ts.isAwaitExpression(u)) return receiverPillish(u.expression)
          if (ts.isConditionalExpression(u)) {
            return receiverPillish(u.whenTrue) || receiverPillish(u.whenFalse)
          }
          if (
            ts.isBinaryExpression(u) &&
            (u.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
              u.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
              u.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
          ) {
            return receiverPillish(u.left) || receiverPillish(u.right)
          }
          return false
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
          // `const {eval: e} = globalThis` / `{Function: F}` -
          // destructured global names bind local opaque handles.
          if (
            ts.isVariableDeclaration(n) &&
            n.initializer !== undefined &&
            ts.isObjectBindingPattern(n.name)
          ) {
            const src = unwrapExpr(n.initializer)
            const srcRoot =
              ts.isIdentifier(src) &&
              GLOBAL_ROOTS.has(binds.rootAliases.get(src.text) ?? src.text)
                ? true
                : (ts.isPropertyAccessExpression(src) ||
                      ts.isElementAccessExpression(src)) &&
                    GLOBAL_ROOTS.has(rootOf(src, binds) ?? '')
            if (srcRoot || pillish(src)) {
              for (const el of n.name.elements) {
                const key =
                  el.propertyName !== undefined
                    ? ts.isIdentifier(el.propertyName) ||
                        ts.isStringLiteral(el.propertyName) ||
                        ts.isNumericLiteral(el.propertyName)
                      ? el.propertyName.text
                      : ts.isComputedPropertyName(el.propertyName)
                        ? literalize(el.propertyName.expression, binds)
                        : undefined
                    : ts.isIdentifier(el.name)
                      ? el.name.text
                      : undefined
                if (!ts.isIdentifier(el.name)) continue
                if (srcRoot) {
                  if (key !== undefined && GLOBAL_NAMES.has(key)) {
                    binds.rootAliases.set(el.name.text, key)
                  } else if (key === undefined) {
                    // `{[K]: e} = globalThis` with an unresolvable K -
                    // the bound identifier can carry any global name.
                    binds.opaqueHandles.add(el.name.text)
                  }
                } else {
                  // Destructure on a pill-ish root: `{useProfessionPill:
                  // u} = ps` is a spelled pinned alias; a computed or
                  // unresolvable key is an opaque handle.
                  if (key === PINNED) {
                    binds.memberAliases.set(el.name.text, PINNED)
                  } else if (key === undefined) {
                    binds.opaqueHandles.add(el.name.text)
                  }
                }
              }
            }
          }
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
              if (p !== undefined && GLOBAL_NAMES.has(p)) {
                binds.rootAliases.set(n.name.text, p)
              }
              // `const s2 = ps` - a renamed pill-ish root keeps
              // resolving through rootAliases.
              if (pillish(init)) {
                binds.rootAliases.set(n.name.text, rootOf(init, binds) ?? init.text)
              }
              // `const g = mm` - an opaque handle re-binds without
              // losing its unresolved-slot status.
              if (binds.opaqueHandles.has(init.text)) {
                binds.opaqueHandles.add(n.name.text)
              }
            } else if (
              (ts.isPropertyAccessExpression(init) ||
                ts.isElementAccessExpression(init)) &&
              rootOf(init, binds) !== undefined &&
              GLOBAL_ROOTS.has(rootOf(init, binds)!)
            ) {
              // `const R = globalThis.Reflect` / `const W = window.Worker`
              const r = memberNameOf(init, binds)
              if (r !== undefined && GLOBAL_NAMES.has(r)) {
                binds.rootAliases.set(n.name.text, r)
              }
            }
            // `const rd = Object.getOwnPropertyDescriptor` /
            // `const g = globalThis.Reflect.get` - a bare reflective or
            // enumeration member captured as a handle: invoking the
            // bound name runs that member read over its args.
            if (
              (ts.isPropertyAccessExpression(init) ||
                ts.isElementAccessExpression(init)) &&
              !binds.rootAliases.has(n.name.text)
            ) {
              const r = memberNameOf(init, binds)
              const recvPath = accessPath(init.expression, binds)
              const iRoot = rootOf(init, binds)
              const onReflective =
                iRoot !== undefined &&
                (REFLECTIVE_READ_ROOTS.has(iRoot) ||
                  (GLOBAL_ROOTS.has(iRoot) &&
                    recvPath !== undefined &&
                    /\.(Object|Reflect)$/.test(recvPath)))
              if (
                r !== undefined &&
                onReflective &&
                (REFLECTIVE_MEMBERS.has(r) || ENUMERATE_MEMBERS.has(r))
              ) {
                binds.rootAliases.set(n.name.text, r)
              }
            }
            // Opaque handles OFF a pill-ish root - values whose
            // member slot cannot be resolved: `const mm = ps[k]`,
            // `const g = Reflect.get(ps, k)`,
            // `const d = Object.getOwnPropertyDescriptor(ps,k).value`.
            if (
              ts.isElementAccessExpression(init) &&
              pillish(init.expression) &&
              memberOfExpr(init) !== PINNED
            ) {
              const keyLit = literalize(init.argumentExpression, binds)
              if (keyLit === undefined || keyLit === PINNED) {
                if (keyLit === PINNED) {
                  binds.memberAliases.set(n.name.text, PINNED)
                } else {
                  binds.opaqueHandles.add(n.name.text)
                }
              }
            }
            if (ts.isCallExpression(init)) {
              const cCallee = unwrapExpr(init.expression)
              const cMember = memberNameOf(cCallee, binds)
              const cRoot =
                ts.isPropertyAccessExpression(cCallee) ||
                ts.isElementAccessExpression(cCallee)
                  ? rootOf(cCallee.expression, binds)
                  : undefined
              const arg0 = init.arguments[0]
              if (
                cRoot !== undefined &&
                REFLECTIVE_READ_ROOTS.has(cRoot) &&
                cMember !== undefined &&
                REFLECTIVE_MEMBERS.has(cMember) &&
                arg0 !== undefined &&
                pillish(unwrapExpr(arg0)) &&
                memberOfExpr(init) !== PINNED
              ) {
                binds.opaqueHandles.add(n.name.text)
              }
              // `const g = mm.bind(t)` - .bind/.call/.apply on an
              // opaque handle, or on an unresolved element slot of a
              // pill-ish root (`ps[k].bind(ps)`), yields a handle to
              // the same slot.
              if (
                cMember !== undefined &&
                INDIRECT_NAMES.has(cMember) &&
                (ts.isPropertyAccessExpression(cCallee) ||
                  ts.isElementAccessExpression(cCallee))
              ) {
                const recvE = unwrapExpr(cCallee.expression)
                const recvOpaque =
                  (ts.isIdentifier(recvE) &&
                    binds.opaqueHandles.has(recvE.text)) ||
                  (ts.isElementAccessExpression(recvE) &&
                    memberNameOf(recvE, binds) === undefined &&
                    pillish(recvE.expression))
                if (recvOpaque) binds.opaqueHandles.add(n.name.text)
              }
              // `const cp = structuredClone(ps)` / `wrap(ps)` - a
              // call fed the pill system returns a pill-ish carrier
              // (a clone forwards its member slots verbatim). Only
              // clone/wrap-shaped callees carry: `m.get(pill.id)` /
              // `map.find(pill)` read an unrelated slot.
              {
                const cn =
                  cMember ??
                  (ts.isIdentifier(cCallee) ? cCallee.text : undefined)
                if (
                  cn !== undefined &&
                  /clone|wrap|copy|snapshot|structur|proxy|boxed?/i.test(cn) &&
                  init.arguments.some((a) => pillish(unwrapExpr(a)))
                ) {
                  binds.rootAliases.set(n.name.text, 'ps')
                }
              }
            }
            // `const px = new Proxy(ps, {})` - the proxy forwards
            // member reads to the pill-ish target.
            if (
              ts.isNewExpression(init) &&
              init.arguments !== undefined &&
              init.arguments.some((a) => pillish(unwrapExpr(a)))
            ) {
              const nc = unwrapExpr(init.expression)
              const ctor = ts.isIdentifier(nc)
                ? (binds.rootAliases.get(nc.text) ?? nc.text)
                : undefined
              if (ctor === 'Proxy') {
                binds.rootAliases.set(n.name.text, 'ps')
              }
            }
            // `const c = {...ps}` / `const c = {s: ps}` / `const a = [ps]`
            // / `new Box(ps)` - one-step carriers whose member/element
            // reads forward the pill-ish slots verbatim.
            if (
              (ts.isObjectLiteralExpression(init) &&
                init.properties.some(
                  (p) =>
                    (ts.isSpreadAssignment(p) ||
                      ts.isPropertyAssignment(p)) &&
                    pillish(
                      unwrapExpr(
                        ts.isSpreadAssignment(p)
                          ? p.expression
                          : (p as ts.PropertyAssignment).initializer,
                      ),
                    ),
                )) ||
              (ts.isArrayLiteralExpression(init) &&
                init.elements.some((el) =>
                  pillish(
                    unwrapExpr(
                      ts.isSpreadElement(el) ? el.expression : (el as ts.Expression),
                    ),
                  ),
                )) ||
              (ts.isNewExpression(init) &&
                init.arguments !== undefined &&
                init.arguments.some((a) => pillish(unwrapExpr(a))))
            ) {
              binds.pillCarriers.add(n.name.text)
            }
            // `const c = Function.prototype.call` - the bound name is
            // a dispatch primitive: c(fn, thisArg, ...) invokes fn
            // through the call slot without a callee spelling.
            if (
              (ts.isPropertyAccessExpression(init) ||
                ts.isElementAccessExpression(init)) &&
              /^(?:globalThis\.|window\.)?Function\.prototype\.(call|apply|bind)$/.test(
                accessPath(init, binds) ?? '',
              )
            ) {
              binds.rootAliases.set(
                n.name.text,
                `Function.prototype.${memberNameOf(init, binds) ?? 'call'}`,
              )
            }
            // `x.getOwnPropertyDescriptor(ps, k).value` - member
            // access on an opaque descriptor read.
            if (
              (ts.isPropertyAccessExpression(init) ||
                ts.isElementAccessExpression(init)) &&
              ts.isCallExpression(unwrapExpr(init.expression))
            ) {
              const inner = unwrapExpr(init.expression) as ts.CallExpression
              const iCallee = unwrapExpr(inner.expression)
              const iMember = memberNameOf(iCallee, binds)
              const iRoot =
                ts.isPropertyAccessExpression(iCallee) ||
                ts.isElementAccessExpression(iCallee)
                  ? rootOf(iCallee.expression, binds)
                  : undefined
              const iArg0 = inner.arguments[0]
              if (
                iRoot !== undefined &&
                REFLECTIVE_READ_ROOTS.has(iRoot) &&
                iMember !== undefined &&
                REFLECTIVE_MEMBERS.has(iMember) &&
                iArg0 !== undefined &&
                pillish(unwrapExpr(iArg0))
              ) {
                binds.opaqueHandles.add(n.name.text)
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
          // `const [m] = [ps]` - array-pattern destructure out of an
          // array literal carrying the pill-ish root.
          if (
            ts.isVariableDeclaration(n) &&
            ts.isArrayBindingPattern(n.name) &&
            n.initializer !== undefined &&
            ts.isArrayLiteralExpression(unwrapExpr(n.initializer))
          ) {
            const arrInit = unwrapExpr(n.initializer) as ts.ArrayLiteralExpression
            n.name.elements.forEach((el, i) => {
              if (!ts.isBindingElement(el) || !ts.isIdentifier(el.name)) return
              const src = arrInit.elements[i]
              if (
                src !== undefined &&
                pillish(
                  unwrapExpr(
                    ts.isSpreadElement(src)
                      ? src.expression
                      : (src as ts.Expression),
                  ),
                )
              ) {
                binds.pillCarriers.add(el.name.text)
              }
            })
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
          // `get f() { return ps.useProfessionPill }` / a class method
          // returning the pinned handle - `this.f` carries it.
          if (
            (ts.isGetAccessorDeclaration(n) ||
              ts.isMethodDeclaration(n)) &&
            n.body !== undefined
          ) {
            let returnsPinned = false
            walkAll(n.body, (x) => {
              if (returnsPinned) return true
              if (
                ts.isReturnStatement(x) &&
                x.expression !== undefined &&
                memberOfExpr(x.expression) === PINNED
              ) {
                returnsPinned = true
                return true
              }
              return
            })
            if (returnsPinned && n.name !== undefined) {
              const nm =
                ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)
                  ? n.name.text
                  : ts.isComputedPropertyName(n.name)
                    ? literalize(n.name.expression, binds)
                    : undefined
              if (nm !== undefined) {
                binds.memberPaths.set(`this.${nm}`, PINNED)
              }
            }
          }
        }
        for (const sf of sfs) walkAll(sf, collect)
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
          // Every call expression - the callee/member checks are
          // ARG-FREE (a zero-arg `ps[k]()` or `x.eval()` still invokes
          // the resolved member); only the specifier/arg analyses sit
          // behind the arg gate.
          if (ts.isCallExpression(n)) {
            const callee = unwrapExpr(n.expression)
            const isRequire = ts.isIdentifier(callee) && callee.text === 'require'
            const isDynamic = callee.kind === ts.SyntaxKind.ImportKeyword
            const specLit =
              n.arguments[0] !== undefined
                ? literalize(n.arguments[0], binds)
                : undefined
            if (n.arguments[0] !== undefined) {
              if (
                (isRequire || isDynamic) &&
                specLit !== undefined &&
                isTestSpecifier(specLit)
              ) {
                note(
                  `${isRequire ? 'require' : 'dynamic import'} of a test file: ${n.arguments[0].getText()}`,
                )
              }
              // `require(k)` - an unresolvable specifier is unscanned
              // code (same class as the opaque dynamic import below).
              if (isRequire && specLit === undefined) {
                note(`opaque require specifier: ${n.getText()}`)
              }
              // `import()` through a data:/blob: URL or an unspelled
              // specifier loads code this guard cannot see.
              if (
                isDynamic &&
                (specLit === undefined ||
                  specLit.startsWith('data:') ||
                  specLit.startsWith('blob:'))
              ) {
                note(`opaque dynamic import: ${n.getText()}`)
              }
              // `import.meta.glob(spec)` - same unscanned-module lane;
              // a split-concat specifier still leaves a `.test`
              // fragment inside the arg subtree.
              const isGlob =
                ts.isPropertyAccessExpression(callee) &&
                callee.name.text === 'glob' &&
                callee.expression.kind === ts.SyntaxKind.MetaProperty
              if (isGlob) {
                let globHit = specLit !== undefined && isTestSpecifier(specLit)
                if (!globHit) {
                  walkAll(n.arguments[0], (x) => {
                    if (globHit) return true
                    if (
                      (ts.isStringLiteral(x) ||
                        ts.isNoSubstitutionTemplateLiteral(x)) &&
                      x.text.includes('.test')
                    ) {
                      globHit = true
                      return true
                    }
                    return
                  })
                }
                if (globHit) {
                  note(`import.meta.glob of a test file: ${n.getText()}`)
                }
              }
              if (
                ts.isIdentifier(callee) &&
                (callee.text === 'setTimeout' || callee.text === 'setInterval') &&
                specLit !== undefined
              ) {
                note(`string-eval scheduler: ${n.getText()}`)
              }
            }
            // `x.eval(...)` / `x.constructor(...)` - dynamic code via
            // ANY member root, including a bare `x.eval()`.
            const callMember = memberNameOf(callee, binds)
            if (callMember === 'eval' || callMember === 'constructor') {
              note(`opaque code member: ${n.getText()}`)
            }
            // `x.call(...)`/`x.apply(...)`/`x.bind(...)` where the
            // RECEIVER resolves to the pinned handle - the invocation
            // spells no pinned token on its own.
            if (
              callMember !== undefined &&
              INDIRECT_NAMES.has(callMember) &&
              (ts.isPropertyAccessExpression(callee) ||
                ts.isElementAccessExpression(callee)) &&
              touchesPinnedName(callee.expression, binds)
            ) {
              note(`indirect pinned call: ${n.getText()}`)
            }
            // `mm.call(t)` / `mm.apply` / `mm.bind` where mm is an
            // opaque handle - same indirect invocation lane as the
            // pinned receiver, but the slot is unresolved. An INLINE
            // `ps[k]` receiver is the same lane (`ps[k].call(ps)`),
            // and `c(...)` bound to Function.prototype.call is the
            // dispatch primitive itself.
            if (
              callMember !== undefined &&
              INDIRECT_NAMES.has(callMember) &&
              (ts.isPropertyAccessExpression(callee) ||
                ts.isElementAccessExpression(callee))
            ) {
              const recvId = unwrapExpr(callee.expression)
              if (
                (ts.isIdentifier(recvId) &&
                  binds.opaqueHandles.has(recvId.text)) ||
                (ts.isElementAccessExpression(recvId) &&
                  memberNameOf(recvId, binds) === undefined &&
                  receiverPillish(recvId.expression))
              ) {
                note(`indirect opaque handle call: ${n.getText()}`)
              }
            }
            if (
              ts.isIdentifier(callee) &&
              (binds.rootAliases.get(callee.text) ?? '').startsWith(
                'Function.prototype.',
              ) &&
              n.arguments.some(
                (a) =>
                  receiverPillish(a) ||
                  (ts.isIdentifier(unwrapExpr(a)) &&
                    binds.opaqueHandles.has(
                      (unwrapExpr(a) as ts.Identifier).text,
                    )),
              )
            ) {
              note(`Function.prototype dispatch: ${n.getText()}`)
            }
            // `eval.call(t, 'code')` / `eval.apply` / `eval.bind` -
            // indirect invocation of an opaque-code receiver.
            if (
              callMember !== undefined &&
              INDIRECT_NAMES.has(callMember) &&
              (ts.isPropertyAccessExpression(callee) ||
                ts.isElementAccessExpression(callee))
            ) {
              const recv = unwrapExpr(callee.expression)
              const recvName = ts.isIdentifier(recv)
                ? (binds.rootAliases.get(recv.text) ?? recv.text)
                : undefined
              if (recvName === 'eval' || recvName === 'Function') {
                note(`opaque code indirect: ${n.getText()}`)
              }
            }
            // `Reflect.apply(fn,t,args)` / `Reflect.construct` invoke
            // an opaque callee outright.
            if (
              (ts.isPropertyAccessExpression(callee) ||
                ts.isElementAccessExpression(callee)) &&
              (callMember === 'apply' || callMember === 'construct') &&
              rootOf(
                (
                  callee as
                    | ts.PropertyAccessExpression
                    | ts.ElementAccessExpression
                ).expression,
                binds,
              ) === 'Reflect'
            ) {
              note(`Reflect.${callMember} opaque invocation: ${n.getText()}`)
            }
            // `ps[k]()` with an UNRESOLVED key on a pill-ish root -
            // opaque member dispatch can reach the pinned method.
            // Enumeration over a pill-ish root (`Object.keys(ps)`,
            // `Reflect.get(ps, k)`, `Object.getOwnPropertyNames(ps)`,
            // `Object.getOwnPropertyDescriptor(ps, k)` - the
            // descriptor `.value` invokes the member) is the assembly
            // step for that dispatch.
            if (
              ts.isElementAccessExpression(callee) &&
              memberNameOf(callee, binds) === undefined &&
              (receiverPillish(callee.expression) ||
                // `structuredClone(ps)[k]()` / `wrap(ps)[k]()` -
                // a call fed the pill system returns a carrier whose
                // member slots mirror the pill-ish arg.
                (ts.isCallExpression(unwrapExpr(callee.expression)) &&
                  (
                    unwrapExpr(callee.expression) as ts.CallExpression
                  ).arguments.some((a) => pillish(unwrapExpr(a)))) ||
                // `this.ps[k]` / `holder.pill[k]` - a member-position
                // carrier whose own name spells the channel.
                (ts.isPropertyAccessExpression(unwrapExpr(callee.expression)) &&
                  PILLISH_NAME_RE.test(
                    (unwrapExpr(callee.expression) as ts.PropertyAccessExpression)
                      .name.text,
                  )))
            ) {
              note(`opaque member dispatch: ${n.getText()}`)
            }
            // An opaque handle invoked as callee: `const mm = ps[k];
            // mm()` - pass 1 proved the binding carries an unresolved
            // member slot of a pill-ish root.
            if (
              ts.isIdentifier(callee) &&
              binds.opaqueHandles.has(callee.text)
            ) {
              note(`opaque handle invocation: ${n.getText()}`)
            }
            // `const k = Object.keys; k(ps)` - an identifier callee
            // bound to a global member resolves through rootAliases.
            const resolvedCallMember =
              callMember ??
              (ts.isIdentifier(callee)
                ? binds.rootAliases.get(callee.text)
                : undefined)
            if (
              resolvedCallMember !== undefined &&
              ENUMERATE_MEMBERS.has(resolvedCallMember) &&
              resolvedCallMember !== 'get' &&
              n.arguments.some(
                (a) => pillish(a) || touchesPinnedName(a, binds),
              )
            ) {
              note(`enumeration over pill system: ${n.getText()}`)
            }
            // `Reflect.get(ps, k)` / `globalThis.Reflect.get(ps,k)` /
            // `ps.get(k)` - a member READ over the pill-ish root is
            // the enumeration step feeding opaque dispatch
            // (`Reflect.get(ps,k).call(ps,...)` needs no binding).
            // Gated on a Reflect/Object/global/pill-ish root so a
            // plain `map.get(ps)` key lookup does not flag.
            const callRoot =
              ts.isPropertyAccessExpression(callee) ||
              ts.isElementAccessExpression(callee)
                ? rootOf(callee.expression, binds)
                : undefined
            const pillReceiver =
              (ts.isPropertyAccessExpression(callee) ||
                ts.isElementAccessExpression(callee)) &&
              receiverPillish(callee.expression)
            if (
              resolvedCallMember === 'get' &&
              // `ps.get(k)` - the opaque key returns an unresolved
              // member reference: opaque dispatch needs no call here.
              ((pillReceiver &&
                n.arguments.some((a) => literalize(a, binds) === undefined)) ||
                ((callRoot === undefined ||
                  REFLECTIVE_READ_ROOTS.has(callRoot) ||
                  GLOBAL_ROOTS.has(callRoot) ||
                  pillReceiver) &&
                  n.arguments.some(
                    (a) => pillish(a) || touchesPinnedName(a, binds),
                  )))
            ) {
              note(`enumeration over pill system: ${n.getText()}`)
            }
            // `Object.defineProperty(ps, k, {value})` /
            // `Reflect.set(ps, k, fn)` / `ps[k] = fn` - rebinding a
            // member slot of the pill-ish root replaces the pinned
            // method without spelling its name.
            if (
              resolvedCallMember !== undefined &&
              (resolvedCallMember === 'defineProperty' ||
                resolvedCallMember === 'defineProperties' ||
                resolvedCallMember === 'set') &&
              (callRoot === undefined ||
                REFLECTIVE_READ_ROOTS.has(callRoot) ||
                GLOBAL_ROOTS.has(callRoot) ||
                pillReceiver) &&
              n.arguments[0] !== undefined &&
              receiverPillish(n.arguments[0])
            ) {
              note(`slot rebind on pill system: ${n.getText()}`)
            }
            // DOM code-injection sinks - arg-free (`x.eval()` counts).
            const DOM_WRITE_CALLS = new Set([
              'insertAdjacentHTML',
              'write',
              'writeln',
              'execCommand',
            ])
            if (DOM_WRITE_CALLS.has(callMember ?? '')) {
              note(`DOM code-injection sink: ${n.getText()}`)
            }
          }
          // A spelled `*.test*` specifier literal ANYWHERE in
          // production: import.meta.glob, `new Worker(new URL(
          // './x.test', ...))`, aliased require - all smuggle an
          // unscanned module past the corpus. Specifiers always carry
          // a path separator; fixture ids like `root.test.1` do not.
          if (
            (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
            (n.text.includes('/') || n.text.includes('*') ||
              n.text.includes('{') || n.text.includes('?')) &&
            isTestSpecifier(n.text)
          ) {
            note(`test-module specifier: ${n.getText()}`)
          }
          // Opaque code can spell anything.
          if (ts.isCallExpression(n)) {
            const callee = unwrapExpr(n.expression)
            if (
              ts.isIdentifier(callee) &&
              (binds.rootAliases.get(callee.text) ?? callee.text) === 'eval'
            ) {
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
            ts.isIdentifier(n.expression)
          ) {
            const ctor =
              binds.rootAliases.get(n.expression.text) ?? n.expression.text
            if (ctor === 'Function') {
              note(`new Function() opaque code: ${n.getText()}`)
            }
            if (ctor === 'Worker' || ctor === 'SharedWorker') {
              note(`new ${ctor}() unscanned code: ${n.getText()}`)
            }
            // `new mm()` where mm is an opaque handle - constructing
            // an unresolved member slot of the pill system.
            if (binds.opaqueHandles.has(n.expression.text)) {
              note(`opaque handle construction: ${n.getText()}`)
            }
          }
          // `x.innerHTML = markup` - DOM code-injection write lane.
          // `ps[k] = fn` / `ps.x = fn` - a member-slot write on a
          // pill-ish receiver rebinds the pinned method opaquely.
          if (
            ts.isBinaryExpression(n) &&
            (n.operatorToken.kind === ts.SyntaxKind.EqualsToken ||
              n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionEqualsToken ||
              n.operatorToken.kind === ts.SyntaxKind.BarBarEqualsToken ||
              n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandEqualsToken)
          ) {
            const l = unwrapExpr(n.left)
            const leaf = ts.isPropertyAccessExpression(l)
              ? l.name.text
              : ts.isElementAccessExpression(l)
                ? literalize(l.argumentExpression, binds)
                : undefined
            if (
              leaf === 'innerHTML' ||
              leaf === 'outerHTML' ||
              leaf === 'srcdoc'
            ) {
              note(`DOM code-injection write: ${n.getText()}`)
            }
            if (
              (ts.isPropertyAccessExpression(l) ||
                ts.isElementAccessExpression(l)) &&
              memberNameOf(l, binds) !== PINNED &&
              receiverPillish(l.expression)
            ) {
              note(`slot write on pill system: ${n.getText()}`)
            }
          }
          if (touchesPinnedName(n, binds)) {
            note(n.getText())
          }
        }
        for (const sf of sfs) walkAll(sf, visit)
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
