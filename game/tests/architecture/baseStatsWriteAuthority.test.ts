/**
 * baseStats write-authority guard (ruling 2026-09-29).
 *
 * `player.baseStats` is the "real points" pool the hidden-lineage
 * predicate reads (HiddenLineage.isHiddenBreakthroughEligible). The
 * ruling that made permanent_stat pills write baseStats directly came
 * with exactly one enumeration: only TWO income channels may write it.
 *
 *   1. Level-up allocation - GameManagerProgressionOps.allocateAttributePoint
 *   2. Pills - PillSystem.useProfessionPill (permanent_stat + random_main_stat)
 *
 * Both share one bound: getEffectiveMainStatCap. Anything else that
 * needs to move a stat (equipment, buffs, nodes, body refinement)
 * belongs to the modifier/assembly channels and must NOT touch
 * baseStats - that is what keeps the predicate honest.
 *
 * Restore/replace paths (save load, entity mint) assign the whole
 * object or re-derive it through StatBlock/assembly, never mutate
 * baseStats fields in place - those are data movement, not income.
 *
 * Explicitly OUT of scope: test/simulation files (fixtures and driven
 * sessions set up state directly; they are not production authority)
 * and dev-only scripts (they run at build time, never on live state).
 *
 * SCAN MODEL: the guard walks the real TypeScript AST (typescript is
 * already a dev dep via vue-tsc), so whitespace, comments, parens,
 * template/unicode string forms and multi-line layouts cannot hide a
 * write. Coverage: assignment + compound ops, ++/--, delete, for-of/
 * for-in and destructuring targets, Object.assign/defineProperty/
 * defineProperties, Reflect.get/set/defineProperty/deleteProperty/
 * apply/getOwnPropertyDescriptor, .call/.apply on structural names
 * (dot, bracket and const-key callee spellings, parenthesized callees,
 * bare identifiers bound via destructuring or member capture), callee-
 * root aliases (`const O = Object`, `globalThis.Reflect`), Pinia
 * `$patch` (literal, spread, indirect and .call/.apply forms - any
 * opaque receiver flagged), `$state` forged-state replacement and
 * assign-injection (dot, bracket and const-key spellings), pool aliases
 * (rooted access, destructured incl. parameter destructuring and
 * binding-element initializers, parameter default bindings, bracket
 * and const-string-key forms, transitive `const b = a` copies, casts
 * and ternary/`??`/`||` initializers), alias-rooted bare-identifier
 * arguments (`Object.assign(bs, ...)`), nested-indirect callees
 * (`X.call.call(fn, ...)`), `new Proxy(pool)`, toRef/toRefs/
 * storeToRefs write-throughs, reflective reads (Reflect.get,
 * getOwnPropertyDescriptor), root aliases through globalThis/window/
 * self chains, `with` statements, spelled-token payload literals
 * (`{baseStats: ...}`/`{$state: ...}` carried by variable),
 * enumeration-then-narrow member writes inside guarded blocks,
 * test-file import barriers (`import './x.test'` in production),
 * computed/const-key object props (`{[K]: v}` where K='baseStats'),
 * and .vue template lanes (event handlers incl. dynamic `@[expr]`/
 * `#[expr]` argument names, bindings, interpolations, v-model incl.
 * `:arg` and modifier forms). R8 additions: member-position pool
 * aliases (`box.bs = pool` then `box.bs.qi = 9` - accessPath tracking),
 * pool-as-call-arg funnel (`bump(player.baseStats)` with an opaque
 * callee - read-shaped callees enumerated via READ_*), write-ish
 * member calls on ANY root (`P.set(t,k,v)`, lodash-style
 * merge/patch/setIn) when a spelled key or poolish arg is present,
 * for-of/for-in/switch pools spelling a token, eval/`new Function`,
 * 5+-char spelled fragments into string-search members
 * (`k.startsWith('baseS')`), `*.test*` specifier literals in ANY
 * position (import.meta.glob, Worker URLs), `String()`/template
 * literalize, and HTML-comment/nested-mustache-aware template scan.
 * R9 additions: container carriers (`const arr=[pool]` -> `arr[0].x`,
 * `{wrap:{bs:pool}}` nested propAliases, `new Map([[k,pool]])`),
 * pool-carrier/closure call args (`opaque([pool])`,
 * `opaque(() => pool.qi)`, `[pool].forEach(cb)` receiver), IIFE/
 * unresolvable callees (`(0,fn)(pool)`), assignment-pattern
 * destructuring (`({baseStats:x}=player)` gated on poolish RHS),
 * later-write const keys (`K='baseStats'` after decl), class field/
 * param-prop pool binds (`this.pool`), global-name destructuring
 * (`const {eval:e}=globalThis`), member-position dynamic code
 * (`x.eval(c)`, `x.constructor(c)`), string-eval schedulers
 * (setTimeout/setInterval spelled arg), opaque/test-spec `import()`
 * (literalize + data:/blob: channels), new Worker/SharedWorker,
 * `??=`/`&&=`/`||=` on the $state slot, `delete store.$state`,
 * `*.test*` specifier shapes with `*`/`{`/`?` chars (glob patterns,
 * query suffixes), `Object.assign({...}, pool)` fresh-clone
 * exemption, `/player/i` root naming (replaces the `Store$` suffix
 * that over-matched settingsStore) and the pool-arg funnel extended
 * to invoked-member resolution for `.call/.apply/.bind`
 * (`opaque.call(t,pool)` flagged, `Math.min.call(t,v)` exempt via
 * read-shape on the invoked member).
 *
 * Honest residual bound (documented, not hidden): computed keys that
 * never spell the name (`p[k]` with a computed k, Reflect.set with a
 * variable key), opaque payload data flow where no `baseStats`/`$state`
 * token appears and no poolish root is visible (`Object.assign(cfg,
 * payloadVar)` on a local), runtime name enumeration
 * (`Object.keys`/`Reflect.ownKeys` then `ps[name]` without a spelled
 * comparison or fragment), imported bindings, deep transitive aliasing
 * beyond the ordered-declaration lanes above, fragments shorter than
 * 5 chars, generator-carried pools (`poolGen()` calls that yield the
 * pool across a boundary the declaration lanes cannot see), and writes
 * authored inside the allowlisted files
 * themselves - the allowlist IS the trust boundary. The `*.test.*`
 * exemption requires a
 * vitest/describe/it/test marker in the file text - a smuggler could
 * fake the marker inside a comment, which is why the real stop is the
 * import barrier: a file no production module imports writes nothing.
 * Corpus boundary: only `src/` + `electron/` production files are
 * scanned; files at the `game/` root, `tools/`, `scripts/` or
 * `public/` are dev/build tooling that never ships as runtime code -
 * a spelled write there is human-review territory.
 * Those are human-review lanes.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'
import {
  srcCorpus,
  SCAN_TIMEOUT,
  looksLikeTestFile,
  isTestSpecifier,
  templateExpressions,
  stripVueInert,
} from './helpers/scanTs'
import { scriptBlocksOf } from './helpers/commentStrip'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')
const ELECTRON_DIR = join(GAME_ROOT, 'electron')

interface AllowedFile {
  path: string
  contract: string
}

const ALLOWED: AllowedFile[] = [
  {
    path: 'src/core/game/GameManagerProgressionOps.ts',
    contract:
      'Level-up allocation authority: allocateAttributePoint spends attributePoints into baseStats, bounded by getEffectiveMainStatCap.',
  },
  {
    path: 'src/core/pill/PillSystem.ts',
    contract:
      'Pill stat channel authority: useProfessionPill writes permanent_stat/random_main_stat grants into baseStats, bounded by the same cap (canUseProfessionPill).',
  },
  {
    path: 'src/stores/player.ts',
    contract:
      'Restore-time migration fold: retired pill-permanent:* modifiers fold their earned flat into baseStats once during load (bounded by getEffectiveMainStatCap); the modifier is dropped so the fold is idempotent, not a new grant channel.',
  },
]

/** Script text of a source file (vue SFCs contribute script blocks only). */
function scriptText(path: string, text: string): { body: string; jsx: boolean }[] {
  if (path.endsWith('.vue')) {
    return scriptBlocksOf(text).map((b) => ({ body: b.body, jsx: b.jsx }))
  }
  return [{ body: text, jsx: path.endsWith('.tsx') || path.endsWith('.jsx') }]
}

/** Transparent wrappers around an expression: parens, nonnull, as,
 * satisfies, angle-bracket casts - they never change which object the
 * expression yields. */
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
      // `(0, x)` yields x - a comma-sequence alias lane.
      cur = cur.right
    } else {
      return cur
    }
  }
}

const GLOBAL_ROOTS = new Set([
  'globalThis',
  'window',
  'self',
  'parent',
  'frames',
  'top',
])
const REFLECTIVE_READ_NAMES = new Set(['get', 'getOwnPropertyDescriptor', 'has'])
const REF_FACTORIES = new Set(['toRef', 'toRefs', 'storeToRefs'])
const INDIRECT_NAMES = new Set(['bind', 'call', 'apply'])
/** Global names a destructure (`const {eval: e} = globalThis`) can
 * capture into a local handle. */
const GLOBAL_NAMES = new Set([
  'eval', 'Function', 'Object', 'Reflect', 'Proxy', 'Worker',
  'SharedWorker', 'Promise', 'globalThis', 'window', 'setTimeout',
  'setInterval', 'document', 'import', 'require', 'process',
])
/** A root that names the live pool owner. `player` anywhere in the
 * root identifier (playerData, playerStore, myPlayer, savePlayer)
 * counts; a `Store$` suffix alone does NOT (settingsStore/uiStore
 * over-match - verified FP). */
const POOLISH_ROOT_RE =
  /player|^ps$|^store$|^usePlayerStore$|^playerStore$|^playerState$/i

/** Static knowledge a file's declarations yield: which identifiers are
 * bound to what. */
interface Bindings {
  aliases: Set<string>
  payloadAliases: Set<string>
  constKeys: Map<string, string>
  rootAliases: Map<string, string>
  memberAliases: Map<string, { member: string; root: string }>
  /** Dotted access paths bound to the pool: `box.bs`, `this.pool`,
   * `box.nested.deep` (literalized element keys joined as segments). */
  propAliases: Set<string>
  /** Identifier bound to a container literal whose elements include
   * the pool: `const arr = [pool]` -> element access `arr[0]` yields
   * the pool. */
  poolContainers: Set<string>
}

/** Evaluate a spelled string position: literal, const-key binding, or
 * a concat of spelled pieces (`'$'+'patch'`). Returns undefined when
 * any part is not statically spelled. */
const LITERALIZE_DEPTH_CAP = 400

function literalize(e: ts.Expression | undefined, b: Bindings, depth = 0): string | undefined {
  if (e === undefined || depth > LITERALIZE_DEPTH_CAP) return undefined
  const un = unwrapExpr(e)
  if (ts.isStringLiteral(un) || ts.isNoSubstitutionTemplateLiteral(un)) {
    return un.text
  }
  if (ts.isIdentifier(un)) {
    return b.constKeys.get(un.text)
  }
  // `'a'+'a'+'a'+...` - left-associative chains iterate on the left
  // spine so deep concats cannot blow the call stack.
  if (
    ts.isBinaryExpression(un) &&
    un.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const parts: string[] = []
    let cur: ts.Expression = un
    for (;;) {
      const u = unwrapExpr(cur)
      if (
        ts.isBinaryExpression(u) &&
        u.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        const r = literalize(u.right, b, depth + 1)
        if (r === undefined) return undefined
        parts.unshift(r)
        cur = u.left
        continue
      }
      const head = literalize(u, b, depth + 1)
      if (head === undefined) return undefined
      parts.unshift(head)
      break
    }
    return parts.join('')
  }
  // `base${'S'}tats` - a template whose every embedded expression spells.
  if (ts.isTemplateExpression(un)) {
    let joined = un.head.text
    for (const span of un.templateSpans) {
      const mid = literalize(span.expression, b, depth + 1)
      if (mid === undefined) return undefined
      joined += mid + span.literal.text
    }
    return joined
  }
  // String('x') incl. rooted forms (globalThis.String, window.String).
  // Symbol keys are NOT resolved: `p[Symbol.for('baseStats')]` writes a
  // symbol-keyed prop, never the string pool - resolving it would flag
  // a same-named but disjoint key domain (a real false positive).
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
        resolveRoot(callee.expression, b) === '')
    if (isStringCtor) {
      return literalize(un.arguments[0], b, depth + 1)
    }
  }
  return undefined
}

/** Resolve a member-access root through one-level aliases and global
 * roots (`window`, `self`, `globalThis.globalThis`, `const O=Object`). */
function resolveRoot(expr: ts.Expression, b: Bindings): string {
  let cur: ts.Expression = expr
  const names: string[] = []
  while (ts.isPropertyAccessExpression(cur)) {
    names.unshift(cur.name.text)
    cur = cur.expression
  }
  if (ts.isIdentifier(cur)) {
    const aliased = b.rootAliases.get(cur.text)
    names.unshift(aliased ?? cur.text)
  }
  while (names[0] !== undefined && GLOBAL_ROOTS.has(names[0])) names.shift()
  return names.join('.')
}

interface CalleeInfo {
  member: string
  root: string
}

/** Resolve a call callee across spellings: `x.y()`, `x['y']()`,
 * `x['$'+'y']()`, `x[K]()`, `(x.y)()`, bare `f()` where f was bound to
 * a member via capture or destructuring. */
function resolveCallee(expr: ts.Expression, b: Bindings): CalleeInfo | undefined {
  const callee = unwrapExpr(expr)
  if (ts.isPropertyAccessExpression(callee)) {
    return { member: callee.name.text, root: resolveRoot(callee.expression, b) }
  }
  if (ts.isElementAccessExpression(callee)) {
    const name = literalize(callee.argumentExpression, b)
    if (name !== undefined) {
      return { member: name, root: resolveRoot(callee.expression, b) }
    }
    return undefined
  }
  if (ts.isIdentifier(callee)) {
    const bound = b.memberAliases.get(callee.text)
    if (bound !== undefined) {
      return { member: bound.member, root: bound.root === '__expr__' ? '' : bound.root }
    }
    return { member: callee.text, root: '' }
  }
  return undefined
}

/** Is `node` a property/element access naming baseStats, a reflective
 * read returning the pool (`Reflect.get`, `Object.getOwnPropertyDescriptor`),
 * or a ref factory bound to the pool name (`toRef(x,'baseStats')`)?
 * Callee roots resolve through aliases; keys literalize concats and
 * const bindings. */
function isBaseStatsAccess(node: ts.Node, b: Bindings): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === 'baseStats'
  }
  if (ts.isElementAccessExpression(node)) {
    return literalize(node.argumentExpression, b) === 'baseStats'
  }
  if (ts.isCallExpression(node)) {
    const info = resolveCallee(node.expression, b)
    if (info === undefined) return false
    if (
      (info.member === 'get' && info.root === 'Reflect') ||
      (info.member === 'getOwnPropertyDescriptor' && info.root === 'Object')
    ) {
      return node.arguments.some((a) => literalize(a, b) === 'baseStats')
    }
    // toRef(obj, 'baseStats') - the returned ref writes through to the pool.
    if (REF_FACTORIES.has(info.member)) {
      return node.arguments.some((a) => literalize(a, b) === 'baseStats')
    }
    if (info.member === 'get' && info.root === '') {
      // Destructured/unknown-root `get` - flag when the pool name is spelled.
      return node.arguments.some((a) => literalize(a, b) === 'baseStats')
    }
  }
  return false
}

/** Dotted path of a member/element access: `a.b.c`, `this.pool`,
 * `a['k']`/`a[K]` literalized to `a.k`, `a[i]` unresolved. */
function accessPath(e: ts.Expression, b: Bindings): string | undefined {
  const parts: string[] = []
  let cur: ts.Expression = e
  for (;;) {
    const u = unwrapExpr(cur)
    if (ts.isPropertyAccessExpression(u)) {
      parts.unshift(u.name.text)
      cur = u.expression
      continue
    }
    if (ts.isElementAccessExpression(u)) {
      const k = literalize(u.argumentExpression, b)
      if (k === undefined) return undefined
      parts.unshift(k)
      cur = u.expression
      continue
    }
    if (ts.isIdentifier(u)) {
      parts.unshift(u.text)
      return parts.join('.')
    }
    if (u.kind === ts.SyntaxKind.ThisKeyword) {
      parts.unshift('this')
      return parts.join('.')
    }
    return undefined
  }
}

/** Does the subtree contain a baseStats access, a bare pool alias, a
 * path-alias member access, or an alias-rooted member access? */
function containsPoolAccess(node: ts.Node, b: Bindings): boolean {
  let found = false
  const visit = (n: ts.Node): void => {
    if (found) return
    if (isBaseStatsAccess(n, b)) {
      found = true
      return
    }
    if (
      ts.isIdentifier(n) &&
      b.aliases.has(n.text) &&
      !isDeclarationName(n)
    ) {
      found = true
      return
    }
    if (
      ts.isPropertyAccessExpression(n) ||
      ts.isElementAccessExpression(n)
    ) {
      const p = accessPath(n, b)
      if (p !== undefined && b.propAliases.has(p)) {
        found = true
        return
      }
      const root = unwrapExpr(n.expression)
      if (ts.isIdentifier(root) && b.aliases.has(root.text)) {
        found = true
        return
      }
      // container-carried pool: `arr[0]` where `arr = [pool]`.
      if (
        ts.isElementAccessExpression(n) &&
        ts.isIdentifier(root) &&
        b.poolContainers.has(root.text)
      ) {
        found = true
        return
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/** Identifier used as the declared name of a binding is never a use. */
function isDeclarationName(n: ts.Node): boolean {
  const p = n.parent
  return (
    p !== undefined &&
    ((ts.isVariableDeclaration(p) && p.name === n) ||
      (ts.isParameter(p) && p.name === n) ||
      (ts.isBindingElement(p) && (p.name === n || p.propertyName === n)) ||
      (ts.isPropertyAssignment(p) && p.name === n) ||
      (ts.isPropertySignature(p) && p.name === n) ||
      (ts.isMethodSignature(p) && p.name === n) ||
      (ts.isInterfaceDeclaration(p) && p.name === n) ||
      (ts.isTypeAliasDeclaration(p) && p.name === n) ||
      (ts.isEnumMember(p) && p.name === n) ||
      (ts.isFunctionDeclaration(p) && p.name === n) ||
      (ts.isClassDeclaration(p) && p.name === n) ||
      (ts.isImportSpecifier(p) && (p.name === n || p.propertyName === n)) ||
      (ts.isImportClause(p) && p.name === n) ||
      (ts.isNamespaceImport(p) && p.name === n) ||
      (ts.isPropertyAccessExpression(p) && p.name === n))
  )
}

const COMPOUND_ASSIGN = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
])

/** Names of the reflective write APIs the scan pins. */
const STRUCTURAL_WRITE_NAMES = new Set([
  'assign',
  'set',
  'defineProperty',
  'defineProperties',
  'deleteProperty',
])

interface Offender {
  file: string
  text: string
}

function collectOffenders(): { violations: Offender[]; unclassified: Offender[] } {
  const violations: Offender[] = []
  const unclassified: Offender[] = []

  const corpus = [...srcCorpus(SRC_DIR)]
  if (existsSync(ELECTRON_DIR)) corpus.push(...srcCorpus(ELECTRON_DIR))

  for (const file of corpus) {
    if (looksLikeTestFile(file.path, file.text)) continue
    const rel = relative(GAME_ROOT, file.path).replaceAll('\\', '/')
    const allowed = ALLOWED.find((a) => a.path === rel)
    const text = readFileSync(file.path, 'utf8')

    const flaggedTexts = new Set<string>()
    const flag = (snippet: string): void => {
      const norm = snippet.slice(0, 160).replace(/\s+/g, ' ').trim()
      if (flaggedTexts.has(norm)) return
      flaggedTexts.add(norm)
      const offender = { file: rel, text: norm }
      if (allowed) {
        violations.push(offender)
      } else {
        unclassified.push(offender)
      }
    }

    // ---- pass 1: collect bindings (aliases, const keys, roots) ----
    const binds: Bindings = {
      aliases: new Set<string>(),
      payloadAliases: new Set<string>(),
      constKeys: new Map<string, string>(),
      rootAliases: new Map<string, string>(),
      memberAliases: new Map<string, { member: string; root: string }>(),
      propAliases: new Set<string>(),
      poolContainers: new Set<string>(),
    }

    // Literal property with a given name: `{ name: x }`, `{ 'name': x }`,
    // `{ [K]: x }` / `{ ['ba'+'seStats']: x }` where K is a const binding.
    const hasPropNamed = (n: ts.Node, name: string): boolean => {
      let hit = false
      const walk = (x: ts.Node): void => {
        if (hit) return
        if (ts.isPropertyAssignment(x) || ts.isShorthandPropertyAssignment(x)) {
          const nm = x.name
          if (
            (ts.isIdentifier(nm) || ts.isStringLiteral(nm) || ts.isNoSubstitutionTemplateLiteral(nm)) &&
            nm.text === name
          ) {
            hit = true
            return
          }
          if (ts.isComputedPropertyName(nm)) {
            const lit = literalize(nm.expression, binds)
            if (lit === name) {
              hit = true
              return
            }
          }
        }
        ts.forEachChild(x, walk)
      }
      walk(n)
      return hit
    }
    const hasBaseStatsProp = (n: ts.Node): boolean => hasPropNamed(n, 'baseStats')
    const hasStateProp = (n: ts.Node): boolean => hasPropNamed(n, '$state')

    const hasSpread = (n: ts.Node): boolean => {
      let hit = false
      const walk = (x: ts.Node): void => {
        if (hit) return
        if (ts.isSpreadAssignment(x) || ts.isSpreadElement(x)) {
          hit = true
          return
        }
        ts.forEachChild(x, walk)
      }
      walk(n)
      return hit
    }

    const hasPayloadAlias = (n: ts.Node): boolean => {
      let hit = false
      const walk = (x: ts.Node): void => {
        if (hit) return
        if (ts.isIdentifier(x) && binds.payloadAliases.has(x.text)) {
          hit = true
          return
        }
        ts.forEachChild(x, walk)
      }
      walk(n)
      return hit
    }

    // Does the initializer yield the pool itself (not a copy)?
    // Covers wraps (parens/casts/as/satisfies), conditionals `c ? pool
    // : other`, coalesce `pool ?? {}`, transitive aliases (`b = a`
    // where a is an alias) and `new Proxy(pool|alias, ...)`.
    const isPoolRootAccess = (e0: ts.Expression): boolean => {
      const e = unwrapExpr(e0)
      if (isBaseStatsAccess(e, binds)) return true
      if (ts.isIdentifier(e)) return binds.aliases.has(e.text)
      if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) {
        const p = accessPath(e, binds)
        if (p !== undefined && binds.propAliases.has(p)) return true
        // alias-rooted member: `s.qi` where `s` is a pool alias.
        const root = unwrapExpr(e.expression)
        if (ts.isIdentifier(root) && binds.aliases.has(root.text)) return true
        // container-carried pool: `arr[0]` where `arr = [pool]`.
        if (
          ts.isElementAccessExpression(e) &&
          ts.isIdentifier(root) &&
          binds.poolContainers.has(root.text)
        ) {
          return true
        }
      }
      if (ts.isConditionalExpression(e)) {
        return isPoolRootAccess(e.whenTrue) || isPoolRootAccess(e.whenFalse)
      }
      if (
        ts.isBinaryExpression(e) &&
        (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
          e.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        return isPoolRootAccess(e.left) || isPoolRootAccess(e.right)
      }
      if (ts.isNewExpression(e)) {
        const ci = resolveCallee(e.expression, binds)
        const ctor =
          ci !== undefined ? (binds.rootAliases.get(ci.member) ?? ci.member) : undefined
        if (ci !== undefined && ci.root === '' && ctor === 'Proxy') {
          const a0 = e.arguments?.[0]
          return a0 !== undefined && isPoolRootAccess(a0)
        }
      }
      return false
    }

    // `x.$state`, `x['$state']`, `x[S]`, `x['$'+'state']`.
    const isStateSlot = (x: ts.Node): boolean => {
      if (ts.isPropertyAccessExpression(x)) return x.name.text === '$state'
      if (ts.isElementAccessExpression(x)) {
        return literalize(x.argumentExpression, binds) === '$state'
      }
      return false
    }

    // A `player`/`store`-ish root: the live pool owner, not a look-alike
    // local. Used to scope spelled-payload-prop flagging so
    // `assign(cfg.mods, {baseStats: x})` on a non-pool object is not a
    // false positive while `merge(player, {baseStats: x})` still lands.
    const isPoolishArg = (e: ts.Expression): boolean => {
      const u = unwrapExpr(e)
      if (isPoolRootAccess(u)) return true
      if (isStateSlot(u)) return true
      if (ts.isIdentifier(u)) return POOLISH_ROOT_RE.test(u.text)
      if (ts.isCallExpression(u)) {
        const c = unwrapExpr(u.expression)
        return ts.isIdentifier(c) && POOLISH_ROOT_RE.test(c.text)
      }
      return false
    }

    const collect = (n: ts.Node): void => {
      // Import barrier: a production file importing a *.test.* file
      // smuggles unscanned code into the corpus boundary.
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
          flag(`imports a test file: ${spec.getText()}`)
        }
      }
      if (
        ts.isImportEqualsDeclaration(n) &&
        ts.isExternalModuleReference(n.moduleReference) &&
        ts.isStringLiteral(n.moduleReference.expression) &&
        isTestSpecifier(n.moduleReference.expression.text)
      ) {
        flag(`import= of a test file: ${n.moduleReference.getText()}`)
      }
      if (
        ts.isCallExpression(n) &&
        n.arguments[0] !== undefined &&
        ts.isStringLiteral(n.arguments[0])
      ) {
        const callee = unwrapExpr(n.expression)
        const isRequire = ts.isIdentifier(callee) && callee.text === 'require'
        const isDynamic = callee.kind === ts.SyntaxKind.ImportKeyword
        if ((isRequire || isDynamic) && isTestSpecifier(n.arguments[0].text)) {
          flag(
            `${isRequire ? 'require' : 'dynamic import'} of a test file: ${n.arguments[0].getText()}`,
          )
        }
      }
      // const { baseStats } = x / const { baseStats: b } = x /
      // const { x = p.baseStats } = {} - destructured pool aliases.
      // Function params `f({ baseStats })` are write channels too.
      const bindPattern =
        (ts.isVariableDeclaration(n) || ts.isParameter(n)) &&
        ts.isObjectBindingPattern(n.name)
          ? n.name
          : undefined
      // The rhs of a destructure decides whether the bound name is the
      // pool or a same-named field on an unrelated object: gate every
      // name-spelled alias on a poolish rhs so `{baseStats} = snapshot`
      // binds nothing (writing snapshot.baseStats is a shape, not a
      // lane) while `{baseStats} = player` still binds.
      const declRhs =
        ts.isVariableDeclaration(n) && n.initializer !== undefined
          ? unwrapExpr(n.initializer)
          : undefined
      const rhsIsPoolish =
        declRhs !== undefined &&
        (isPoolRootAccess(declRhs) ||
          (ts.isIdentifier(declRhs) && POOLISH_ROOT_RE.test(declRhs.text)) ||
          (ts.isCallExpression(declRhs) &&
            ts.isIdentifier(unwrapExpr(declRhs.expression)) &&
            POOLISH_ROOT_RE.test(
              (unwrapExpr(declRhs.expression) as ts.Identifier).text,
            )))
      if (bindPattern !== undefined) {
        for (const el of bindPattern.elements) {
          const prop = el.propertyName
          // `{'baseStats': x}` / `{[K]: x}` - the spelled key resolves
          // through literalize, not just identifier propNames.
          const propNameText =
            prop === undefined
              ? undefined
              : ts.isIdentifier(prop) || ts.isStringLiteral(prop) ||
                  ts.isNumericLiteral(prop)
                ? prop.text
                : ts.isComputedPropertyName(prop)
                  ? literalize(prop.expression, binds)
                  : undefined
          // `{0: x} = [pool]` - a numeric binding key indexes the
          // array-literal rhs element.
          const numericIndex =
            propNameText !== undefined && /^\d+$/.test(propNameText)
              ? parseInt(propNameText, 10)
              : undefined
          const arrElem =
            numericIndex !== undefined &&
            declRhs !== undefined &&
            ts.isArrayLiteralExpression(declRhs)
              ? declRhs.elements[numericIndex]
              : undefined
          if (
            propNameText === 'baseStats' &&
            ts.isIdentifier(el.name) &&
            (rhsIsPoolish || ts.isParameter(n))
          ) {
            binds.aliases.add(el.name.text)
          } else if (
            arrElem !== undefined &&
            isPoolRootAccess(arrElem) &&
            ts.isIdentifier(el.name)
          ) {
            binds.aliases.add(el.name.text)
          } else if (
            prop === undefined &&
            ts.isIdentifier(el.name) &&
            el.name.text === 'baseStats' &&
            (rhsIsPoolish || ts.isParameter(n))
          ) {
            binds.aliases.add('baseStats')
          } else if (
            el.initializer !== undefined &&
            isPoolRootAccess(el.initializer) &&
            ts.isIdentifier(el.name)
          ) {
            binds.aliases.add(el.name.text)
          }
          // const { $patch } = store - the $patch member bound from
          // ANY source is a write lane (the member itself is opaque).
          const boundName =
            propNameText ?? (ts.isIdentifier(el.name) ? el.name.text : '')
          if (boundName === '$patch' && ts.isIdentifier(el.name)) {
            binds.memberAliases.set(el.name.text, { member: '$patch', root: '' })
          }
          // const { assign } = Object / const { get } = Reflect -
          // destructured structural/reflective names.
          const declInit =
            ts.isVariableDeclaration(n) && n.initializer !== undefined
              ? unwrapExpr(n.initializer)
              : undefined
          if (declInit !== undefined && ts.isIdentifier(el.name)) {
            const srcRoot = resolveRoot(declInit, binds)
            const memberName = boundName
            if (
              (srcRoot === 'Object' || srcRoot === 'Reflect') &&
              (STRUCTURAL_WRITE_NAMES.has(memberName) ||
                REFLECTIVE_READ_NAMES.has(memberName))
            ) {
              binds.memberAliases.set(el.name.text, { member: memberName, root: srcRoot })
            }
            // `const { eval: e } = globalThis` / `{ Function: F }` -
            // destructured global names become opaque-code handles.
            // `const {eval: e} = globalThis` - resolveRoot of a pure
            // global root yields '' (all names shifted out).
            if (
              (srcRoot === '' || GLOBAL_ROOTS.has(srcRoot)) &&
              GLOBAL_NAMES.has(boundName)
            ) {
              binds.rootAliases.set(el.name.text, boundName)
            }
          }
        }
      }
      // `({ baseStats: x } = player)` - assignment-pattern destructure
      // (no declaration). Same binding rules as the declaration form.
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isObjectLiteralExpression(unwrapExpr(n.left))
      ) {
        const lhs = unwrapExpr(n.left) as ts.ObjectLiteralExpression
        const rhs = unwrapExpr(n.right)
        const poolish =
          isPoolRootAccess(rhs) ||
          (ts.isIdentifier(rhs) && POOLISH_ROOT_RE.test(rhs.text)) ||
          (ts.isCallExpression(rhs) &&
            ts.isIdentifier(unwrapExpr(rhs.expression)) &&
            POOLISH_ROOT_RE.test(
              (unwrapExpr(rhs.expression) as ts.Identifier).text,
            ))
        if (poolish) {
          for (const p of lhs.properties) {
            if (ts.isPropertyAssignment(p)) {
              const key =
                ts.isIdentifier(p.name) ||
                ts.isStringLiteral(p.name) ||
                ts.isNumericLiteral(p.name)
                  ? p.name.text
                  : ts.isComputedPropertyName(p.name)
                    ? literalize(p.name.expression, binds)
                    : undefined
              const target = unwrapExpr(p.initializer)
              if (key === 'baseStats' && ts.isIdentifier(target)) {
                binds.aliases.add(target.text)
              }
            } else if (ts.isShorthandPropertyAssignment(p)) {
              if (p.name.text === 'baseStats') binds.aliases.add('baseStats')
            }
          }
        }
      }
      // `K = 'baseStats'` - a later literal write into a previously
      // declared identifier (constKeys follow assignment order, not
      // declaration kind).
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(n.left)
      ) {
        const lit = literalize(n.right, binds)
        if (lit === 'baseStats' || lit === '$state' || lit === '$patch') {
          binds.constKeys.set(n.left.text, lit)
        }
      }
      // `const arr = [player.baseStats]` - container carriers: the pool
      // lives inside a bound array/object literal; element access on
      // the binding yields it.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined
      ) {
        const init = unwrapExpr(n.initializer)
        if (
          ts.isArrayLiteralExpression(init) &&
          init.elements.some((el) => isPoolRootAccess(el))
        ) {
          binds.poolContainers.add(n.name.text)
        }
      }
      // class { pool = player.baseStats } - field-declared pool
      // carrier. `this.pool` joins propAliases so in-class writes
      // resolve; the store site itself is flagged in pass 2.
      if (ts.isPropertyDeclaration(n) && n.initializer !== undefined) {
        if (isPoolRootAccess(n.initializer)) {
          const nm =
            ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)
              ? n.name.text
              : ts.isComputedPropertyName(n.name)
                ? literalize(n.name.expression, binds)
                : undefined
          if (nm !== undefined) binds.propAliases.add(`this.${nm}`)
        }
      }
      // `constructor(private pool = player.baseStats)` - param-prop
      // default: the identifier binds the pool AND this.pool mirrors it.
      if (
        ts.isParameter(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        isPoolRootAccess(n.initializer) &&
        n.modifiers !== undefined
      ) {
        binds.propAliases.add(`this.${n.name.text}`)
      }
      // const s = x.baseStats / const s = x['baseStats'] / proxies /
      // ternaries / transitive aliases - the initializer must BE the
      // pool reference, not a call or literal merely mentioning it.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        isPoolRootAccess(n.initializer)
      ) {
        binds.aliases.add(n.name.text)
      }
      // const [bs] = [player.baseStats] - positional array binding of a
      // literal array whose element is the pool.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isArrayBindingPattern(n.name) &&
        n.initializer !== undefined &&
        ts.isArrayLiteralExpression(unwrapExpr(n.initializer))
      ) {
        const initElems = (unwrapExpr(n.initializer) as ts.ArrayLiteralExpression).elements
        n.name.elements.forEach((el, i) => {
          if (
            ts.isBindingElement(el) &&
            ts.isIdentifier(el.name) &&
            i < initElems.length
          ) {
            const src = initElems[i]
            if (src !== undefined && isPoolRootAccess(src)) {
              binds.aliases.add(el.name.text)
            }
          }
        })
      }
      // const box = { bs: player.baseStats } / obj.prop = pool /
      // this.pool = pool - member-position pool aliases.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        ts.isObjectLiteralExpression(unwrapExpr(n.initializer))
      ) {
        const obj = unwrapExpr(n.initializer) as ts.ObjectLiteralExpression
        // Nested literals recurse: `{wrap: {bs: pool}}` records
        // 'box.wrap.bs', not just 'box.wrap'.
        const walkProps = (o: ts.ObjectLiteralExpression, prefix: string): void => {
          for (const p of o.properties) {
            if (!ts.isPropertyAssignment(p)) continue
            const key =
              ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)
                ? p.name.text
                : ts.isComputedPropertyName(p.name)
                  ? literalize(p.name.expression, binds)
                  : undefined
            if (key === undefined) continue
            const path = `${prefix}.${key}`
            const init = unwrapExpr(p.initializer)
            if (isPoolRootAccess(init)) {
              binds.propAliases.add(path)
            }
            if (ts.isObjectLiteralExpression(init)) walkProps(init, path)
          }
        }
        walkProps(obj, n.name.text)
      }
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        isPoolRootAccess(n.right)
      ) {
        if (ts.isIdentifier(n.left)) {
          binds.aliases.add(n.left.text)
        } else if (
          ts.isPropertyAccessExpression(unwrapExpr(n.left)) ||
          ts.isElementAccessExpression(unwrapExpr(n.left))
        ) {
          const p = accessPath(n.left, binds)
          if (p !== undefined) binds.propAliases.add(p)
        }
      }
      // function f(x = player.baseStats) - parameter default binding.
      if (
        ts.isParameter(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        isPoolRootAccess(n.initializer)
      ) {
        binds.aliases.add(n.name.text)
      }
      // const forged = { baseStats: {...} } / { $state: {...} } /
      // spread of an earlier payload alias - a literal that spells the
      // pool name, carried to a write site through a variable.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined
      ) {
        const init0 = unwrapExpr(n.initializer)
        const isPayloadLiteral =
          ts.isObjectLiteralExpression(init0) &&
          (hasBaseStatsProp(init0) || hasStateProp(init0) || hasPayloadAlias(init0))
        const isPayloadAlias =
          ts.isIdentifier(init0) && binds.payloadAliases.has(init0.text)
        if (isPayloadLiteral || isPayloadAlias) {
          binds.payloadAliases.add(n.name.text)
        }
      }
      // const K = 'baseStats' / const S = '$state' / const P = '$patch'
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined
      ) {
        const lit = literalize(n.initializer, binds)
        if (lit === 'baseStats' || lit === '$state' || lit === '$patch') {
          binds.constKeys.set(n.name.text, lit)
        }
      }
      // const O = Object / const R = Reflect / const W = window /
      // const O = globalThis.Object - reflective-root aliases.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined
      ) {
        const init = unwrapExpr(n.initializer)
        if (
          ts.isIdentifier(init) &&
          (['Object', 'Reflect', 'Proxy', 'Function'].includes(init.text) ||
            GLOBAL_ROOTS.has(init.text))
        ) {
          binds.rootAliases.set(n.name.text, init.text)
        } else {
          const rootName = resolveRoot(init, binds)
          if (
            ts.isPropertyAccessExpression(init) &&
            ['Object', 'Reflect', 'Proxy', 'Function'].includes(rootName)
          ) {
            binds.rootAliases.set(n.name.text, init.name.text)
          }
        }
        // const fn = <something>.$patch / <something>.<structural-name>,
        // incl. bracket form, reflective reads
        // (`Reflect.get(s,'m')`, `Object.getOwnPropertyDescriptor(s,'m')`,
        // its `.value`), and .bind/.call/.apply captures:
        // `const pp = (store.$patch)`, `const q = s.$patch.bind(s)`,
        // `const bp = Function.prototype.bind.call(s.$patch, s)`.
        let memberName: string | undefined
        let target: ts.Expression = init
        if (ts.isCallExpression(target)) {
          const info = resolveCallee(target.expression, binds)
          if (
            info !== undefined &&
            REFLECTIVE_READ_NAMES.has(info.member) &&
            (info.root === 'Object' || info.root === 'Reflect')
          ) {
            const keyArg = target.arguments[1]
            const lit = keyArg !== undefined ? literalize(keyArg, binds) : undefined
            if (lit !== undefined) {
              binds.memberAliases.set(n.name.text, { member: lit, root: '__expr__' })
            }
            ts.forEachChild(n, collect)
            return
          }
          // Chained indirection: peel `.bind/.call/.apply` wrappers to
          // reach the invoked member. `fn.bind(t)` / `fn.call(a)` yields
          // the receiver fn; `bind.call(fn, t)` / `X.call.call(fn, ...)`
          // yields arg0.
          const indirectMemberOf = (x: ts.Expression): string | undefined => {
            const u = unwrapExpr(x)
            if (ts.isPropertyAccessExpression(u)) return u.name.text
            if (ts.isElementAccessExpression(u)) {
              return literalize(u.argumentExpression, binds)
            }
            return undefined
          }
          let cur: ts.Expression = target
          for (;;) {
            if (!ts.isCallExpression(cur)) break
            const callee = unwrapExpr(cur.expression)
            const calleeIsAccess =
              ts.isPropertyAccessExpression(callee) ||
              ts.isElementAccessExpression(callee)
            if (!calleeIsAccess) break
            const m = indirectMemberOf(callee)
            if (m === undefined || !INDIRECT_NAMES.has(m)) break
            const recvExpr = (callee as ts.PropertyAccessExpression | ts.ElementAccessExpression)
              .expression
            const recvIsIndirect =
              INDIRECT_NAMES.has(indirectMemberOf(recvExpr) ?? '')
            if ((m === 'call' || m === 'apply') && recvIsIndirect) {
              const arg0 = cur.arguments[0]
              if (arg0 === undefined) break
              cur = arg0
            } else {
              cur = recvExpr
            }
          }
          target = cur
        }
        if (ts.isPropertyAccessExpression(target)) {
          memberName = target.name.text
        } else if (ts.isElementAccessExpression(target)) {
          memberName = literalize(target.argumentExpression, binds)
        }
        if (
          memberName !== undefined &&
          (memberName === '$patch' ||
            STRUCTURAL_WRITE_NAMES.has(memberName) ||
            REFLECTIVE_READ_NAMES.has(memberName))
        ) {
          binds.memberAliases.set(n.name.text, { member: memberName, root: '__expr__' })
        }
      }
      ts.forEachChild(n, collect)
    }

    // ---- pass 2: write-site scan shared by every parsed body ----
    const scanBody = (body: string): void => {
      const sf = ts.createSourceFile(
        'probe.ts',
        `function __scan(){ ${body} }`,
        ts.ScriptTarget.ESNext,
        true,
        ts.ScriptKind.TS,
      )

      const pool = (n: ts.Node): boolean => containsPoolAccess(n, binds)

      // Anywhere a spelled token for `name` appears: literal, const-key
      // identifier, or a concat of spelled pieces.
      const hasTokenNamed = (n: ts.Node, name: string): boolean => {
        let hit = false
        const walk = (x: ts.Node): void => {
          if (hit) return
          if (
            (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) &&
            x.text === name
          ) {
            hit = true
            return
          }
          if (ts.isIdentifier(x) && binds.constKeys.get(x.text) === name) {
            hit = true
            return
          }
          if (
            ts.isBinaryExpression(x) &&
            x.operatorToken.kind === ts.SyntaxKind.PlusToken &&
            literalize(x, binds) === name
          ) {
            hit = true
            return
          }
          ts.forEachChild(x, walk)
        }
        walk(n)
        return hit
      }
      const hasBaseStatsToken = (n: ts.Node): boolean => hasTokenNamed(n, 'baseStats')
      const hasStateToken = (n: ts.Node): boolean => hasTokenNamed(n, '$state')


      // Does the subtree name a pinned structural/$patch member in any
      // spelling (dot, literal bracket, concat, const-key)?
      const touchesName = (n: ts.Node, names: ReadonlySet<string>): boolean => {
        let hit = false
        const walk = (x: ts.Node): void => {
          if (hit) return
          if (ts.isPropertyAccessExpression(x) && names.has(x.name.text)) {
            hit = true
            return
          }
          if (ts.isElementAccessExpression(x)) {
            const lit = literalize(x.argumentExpression, binds)
            if (lit !== undefined && names.has(lit)) {
              hit = true
              return
            }
          }
          if (ts.isIdentifier(x) && binds.memberAliases.has(x.text)) {
            const bound = binds.memberAliases.get(x.text)
            if (bound !== undefined && names.has(bound.member)) {
              hit = true
              return
            }
          }
          ts.forEachChild(x, walk)
        }
        walk(n)
        return hit
      }
      const STRUCTURAL_OR_PATCH = new Set([...STRUCTURAL_WRITE_NAMES, '$patch'])
      const touchesStructuralName = (n: ts.Node): boolean =>
        touchesName(n, STRUCTURAL_OR_PATCH)
      const PATCH_ONLY = new Set(['$patch'])
      const touchesPatch = (n: ts.Node): boolean => touchesName(n, PATCH_ONLY)

      // Any of the pool-name tokens spelled in the subtree (guard
      // conditions, loop pools, case clauses).
      const PINNED_TOKENS = ['baseStats', '$state', '$patch']
      const hasAnyToken = (n: ts.Node): boolean =>
        PINNED_TOKENS.some((t) => hasTokenNamed(n, t))


      // Read-shaped callees: spelled member names or bare identifiers that
      // only consume the pool. Everything else receiving the pool object
      // itself is an unverifiable write funnel.
      const READ_MEMBERS = new Set([
        'entries', 'keys', 'values', 'stringify', 'parse',
        'isFrozen', 'getOwnPropertyNames', 'includes', 'indexOf',
        'some', 'every', 'map', 'filter', 'reduce', 'find', 'forEach',
        'concat', 'slice', 'flat', 'flatMap', 'join',
        'min', 'max', 'abs', 'floor', 'ceil', 'round', 'trunc', 'sign',
        'pow', 'sqrt', 'log', 'random', 'hypot', 'clamp',
        'has', 'get', 'delete', 'size', 'at', 'fromEntries',
      ])
      const READ_IDENTIFIERS = new Set([
        'isObject', 'isPlainObject', 'isRecord', 'structuredClone',
        'cloneDeep', 'deepClone', 'clone', 'asBaseStats', 'calculateStats',
        'calculateEffectiveStats', 'recomputeEffectiveStats',
        'runPipeline', 'computeStats', 'getStats', 'formatStat', 'snapshot',
        'isFinite', 'Number', 'Boolean', 'Array',
      ])

      // String/search members whose spelled argument is a key fragment
      // (prefix enumeration: `k.startsWith('baseS')`).
      const FRAGMENT_CALLS = new Set([
        'startsWith', 'endsWith', 'includes', 'indexOf', 'lastIndexOf',
        'slice', 'substring', 'substr', 'charAt', 'charCodeAt', 'padStart',
        'padEnd', 'repeat', 'match', 'search', 'split', 'replace',
      ])
      const fragmentOfPinned = (lit: string | undefined): boolean =>
        lit !== undefined &&
        lit.length >= 5 &&
        PINNED_TOKENS.some((t) => t.includes(lit) && lit !== t)

      // The pool object itself inside a container: `[pool]`,
      // `{ref: pool}`, `...[pool]` - a container arg smuggles the pool
      // to an opaque callee through a shape that isPoolRootAccess on
      // the arg alone cannot see.
      const hasPoolCarrier = (e: ts.Node): boolean => {
        let hit = false
        const walk = (x: ts.Node): void => {
          if (hit) return
          if (ts.isSpreadElement(x) && isPoolRootAccess(x.expression)) {
            hit = true
            return
          }
          if (ts.isArrayLiteralExpression(x)) {
            if (x.elements.some((el) => isPoolRootAccess(el))) {
              hit = true
              return
            }
          }
          if (ts.isObjectLiteralExpression(x)) {
            for (const p of x.properties) {
              if (
                (ts.isPropertyAssignment(p) && isPoolRootAccess(p.initializer)) ||
                (ts.isSpreadAssignment(p) && isPoolRootAccess(p.expression))
              ) {
                hit = true
                return
              }
            }
          }
          ts.forEachChild(x, walk)
        }
        walk(e)
        return hit
      }
      // A function-expression arg whose body touches the pool: the
      // callee decides when/how the closure runs - unverifiable.
      const hasPoolClosure = (e: ts.Node): boolean => {
        let hit = false
        const walk = (x: ts.Node): void => {
          if (hit) return
          if (ts.isArrowFunction(x) || ts.isFunctionExpression(x)) {
            if (containsPoolAccess(x, binds)) {
              hit = true
              return
            }
          }
          ts.forEachChild(x, walk)
        }
        walk(e)
        return hit
      }

      const memberNameOfLocal = (
        e: ts.Expression,
      ): { member: string; root: string } | undefined => {
        const u = unwrapExpr(e)
        if (ts.isPropertyAccessExpression(u)) {
          return { member: u.name.text, root: resolveRoot(u.expression, binds) }
        }
        if (ts.isElementAccessExpression(u) && u.argumentExpression !== undefined) {
          const lit = literalize(u.argumentExpression, binds)
          return lit === undefined
            ? undefined
            : { member: lit, root: resolveRoot(u.expression, binds) }
        }
        return undefined
      }
      const invokedInfo = (n: ts.CallExpression): { member: string; root: string } | undefined => {
        const callee = unwrapExpr(n.expression)
        if (
          !ts.isPropertyAccessExpression(callee) &&
          !ts.isElementAccessExpression(callee)
        ) {
          return undefined
        }
        const member = memberNameOfLocal(callee)?.member
        if (member === undefined || !INDIRECT_NAMES.has(member)) return undefined
        const recv = callee.expression
        const recvMember = memberNameOfLocal(recv)?.member
        if (
          (member === 'call' || member === 'apply') &&
          recvMember !== undefined &&
          INDIRECT_NAMES.has(recvMember)
        ) {
          const arg0 = n.arguments[0]
          if (arg0 === undefined) return undefined
          return memberNameOfLocal(arg0) ?? (ts.isIdentifier(unwrapExpr(arg0))
            ? { member: (unwrapExpr(arg0) as ts.Identifier).text, root: '' }
            : undefined)
        }
        return memberNameOfLocal(recv) ?? (ts.isIdentifier(unwrapExpr(recv))
          ? { member: (unwrapExpr(recv) as ts.Identifier).text, root: '' }
          : undefined)
      }

      const inspect = (n: ts.Node, guarded: boolean): void => {
        // Inside a block whose test spells 'baseStats' (enumeration +
        // key-narrowing pattern: `if (k === 'baseStats') v.x = 9`),
        // every member write is suspect even when the root is opaque.
        let inner = guarded
        let testExpr: ts.Expression | undefined
        if (ts.isIfStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) {
          testExpr = n.expression
        } else if (ts.isConditionalExpression(n)) {
          testExpr = n.condition
        } else if (ts.isForOfStatement(n) || ts.isForInStatement(n)) {
          // `for (const k of ['baseStats']) x[k].y = 9` - the loop pool
          // spells the key domain.
          testExpr = n.expression
        } else if (ts.isCaseClause(n)) {
          testExpr = n.expression
        }
        if (testExpr !== undefined && hasAnyToken(testExpr)) {
          inner = true
        }
        // A spelled `*.test*` specifier literal ANYWHERE in production
        // text: import.meta.glob, `new Worker(new URL('./x.test', ...))`,
        // an aliased `r('./x.test')` - all smuggle an unscanned module.
        // Specifiers always carry a path separator; fixture ids like
        // `root.test.1` do not.
        if (
          (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
          (n.text.includes('/') || n.text.includes('*') ||
            n.text.includes('{') || n.text.includes('?')) &&
          isTestSpecifier(n.text)
        ) {
          flag(`test-module specifier: ${n.getText(sf)}`)
        }
        const isMemberWrite =
          (ts.isBinaryExpression(n) && COMPOUND_ASSIGN.has(n.operatorToken.kind)) ||
          ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
            (n.operator === ts.SyntaxKind.PlusPlusToken ||
              n.operator === ts.SyntaxKind.MinusMinusToken)) ||
          ts.isDeleteExpression(n)
        if (inner && isMemberWrite) {
          let target: ts.Expression | undefined
          if (ts.isBinaryExpression(n)) {
            target = n.left
          } else if (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) {
            target = n.operand
          } else if (ts.isDeleteExpression(n)) {
            target = n.expression
          }
          if (
            target !== undefined &&
            (ts.isPropertyAccessExpression(unwrapExpr(target)) ||
              ts.isElementAccessExpression(unwrapExpr(target)))
          ) {
            flag(n.getText(sf))
          }
        }
        // assignment / compound assignment target (incl. ??=/&&=/||=
        // on the $state slot)
        if (
          ts.isBinaryExpression(n) &&
          COMPOUND_ASSIGN.has(n.operatorToken.kind) &&
          (pool(n.left) || isStateSlot(n.left))
        ) {
          flag(n.getText(sf))
        }
        // ++/-- operand
        if (
          (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
          (n.operator === ts.SyntaxKind.PlusPlusToken ||
            n.operator === ts.SyntaxKind.MinusMinusToken) &&
          pool(n.operand)
        ) {
          flag(n.getText(sf))
        }
        // delete expr (pool member OR the $state slot itself)
        if (
          ts.isDeleteExpression(n) &&
          (pool(n.expression) || isStateSlot(n.expression))
        ) {
          flag(n.getText(sf))
        }
        // `with (x) { ... }` - bare identifiers inside resolve through
        // x's members, which no static binding lane can prove. The
        // corpus is strict-mode anyway; any `with` is suspect.
        if (ts.isWithStatement(n)) {
          flag(`with(...) opaque member scope`)
        }
        // `new Function('code')` / `new F(...)` with F bound to Function,
        // `new Worker('data:...')` - runtime code generation loads
        // unscanned code; a Worker/Map carrying the pool is an
        // unverifiable channel.
        if (ts.isNewExpression(n)) {
          const ci = resolveCallee(n.expression, binds)
          const ctor =
            ci !== undefined ? (binds.rootAliases.get(ci.member) ?? ci.member) : undefined
          if (ci !== undefined && ci.root === '' && ctor === 'Function') {
            flag(`new Function() opaque code: ${n.getText(sf)}`)
          }
          if (
            ci !== undefined &&
            (ctor === 'Worker' || ctor === 'SharedWorker')
          ) {
            flag(`new ${ctor}() unscanned code: ${n.getText(sf)}`)
          }
          if (
            n.arguments !== undefined &&
            n.arguments.some(
              (a) => isPoolRootAccess(a) || hasPoolCarrier(a) || hasPoolClosure(a),
            )
          ) {
            flag(`new(...) carries pool: ${n.getText(sf)}`)
          }
        }
        // class { pool = player.baseStats } - field store-site (the
        // member-position alias is collected in pass 1; the write
        // itself is the lane).
        if (
          ts.isPropertyDeclaration(n) &&
          n.initializer !== undefined &&
          isPoolRootAccess(n.initializer)
        ) {
          flag(n.getText(sf))
        }
        // for-of / for-in TARGET writes: `for (pool.x of arr)`. The
        // iterable being a pool read (`Object.entries(pool)`) is NOT
        // a lane - only a write-position target flags.
        if (
          (ts.isForOfStatement(n) || ts.isForInStatement(n)) &&
          !ts.isVariableDeclarationList(n.initializer) &&
          pool(n.initializer)
        ) {
          flag(n.getText(sf))
        }
        if (ts.isCallExpression(n)) {
          const info = resolveCallee(n.expression, binds)
          if (info !== undefined) {
            const calleeName = info.member
            const calleeRoot = info.root
            const calleeViaPatch = calleeName === '$patch'
            // eval / Function('...') - opaque code can write anything;
            // `const F = Function` resolves through rootAliases.
            const resolvedCallee = binds.rootAliases.get(calleeName) ?? calleeName
            if (
              resolvedCallee === 'eval' ||
              resolvedCallee === 'Function'
            ) {
              flag(`opaque code: ${n.getText(sf)}`)
            }
            // `x.eval(...)`, `x.constructor(...)`, `ctor.constructor
            // ('code')(...)` - dynamic code through ANY member root.
            if (calleeName === 'eval' || calleeName === 'constructor') {
              flag(`opaque code member: ${n.getText(sf)}`)
            }
            // setTimeout('code')/setInterval('code') - a spelled string
            // arg is evaluated as code.
            if (
              (calleeName === 'setTimeout' || calleeName === 'setInterval') &&
              n.arguments[0] !== undefined &&
              literalize(n.arguments[0], binds) !== undefined
            ) {
              flag(`string-eval scheduler: ${n.getText(sf)}`)
            }
            // Write-shaped members on ANY root: userland `P.set(t, k, v)`,
            // lodash-style merge/patch/setIn - a spelled key or a pool
            // arg makes the lane unverifiable.
            const WRITEISH_MEMBERS = new Set([
              'set', 'assign', 'assignIn', 'defaults', 'extend', 'merge',
              'patch', 'update', 'setProperty', 'setIn', 'put', 'assoc',
              'defineProperty', 'defineProperties', 'deleteProperty',
            ])
            const spelledPayload = (a: ts.Expression): boolean =>
              hasBaseStatsProp(a) || hasStateProp(a) || hasPayloadAlias(a)
            const suspiciousArg = (a: ts.Expression): boolean =>
              pool(a) ||
              isPoolishArg(a) ||
              hasBaseStatsToken(a) ||
              hasStateToken(a)
            // Spelled `key` args ('baseStats'/'$state'/'$patch' tokens)
            // flag unconditionally; spelled PAYLOAD props and opaque
            // spreads require a poolish arg nearby (an object literal
            // naming baseStats on its own is just a shape, e.g. a
            // serializer's `{...cfg, baseStats: x}` merge into a local).
            if (
              WRITEISH_MEMBERS.has(calleeName) &&
              n.arguments.some(
                (a) =>
                  suspiciousArg(a) ||
                  ((spelledPayload(a) || hasSpread(a)) &&
                    n.arguments.some((b) => isPoolishArg(b))),
              )
            ) {
              flag(n.getText(sf))
            }
            const isStructuralCall =
              STRUCTURAL_WRITE_NAMES.has(calleeName) &&
              (calleeRoot === 'Object' ||
                calleeRoot === 'Reflect' ||
                calleeRoot === '')
            // Object.assign / Reflect.set|defineProperty|deleteProperty /
            // Object.defineProperty|defineProperties with pool, a
            // baseStats/$state token, or a poolish arg + spelled payload
            // prop / spread. A bare `{baseStats: x}` literal targeting a
            // non-pool object (e.g. `assign(cfg.mods, {baseStats: x})`)
            // is a shape, not a write lane - only spelled tokens and the
            // pool itself flag unconditionally.
            if (isStructuralCall) {
              if (
                n.arguments.some(
                  (a) =>
                    pool(a) ||
                    hasBaseStatsToken(a) ||
                    hasStateToken(a) ||
                    ((spelledPayload(a) || hasSpread(a)) &&
                      n.arguments.some((b) => isPoolishArg(b))),
                )
              ) {
                flag(n.getText(sf))
              }
            }
            // The pool object handed to an opaque callee is an
            // unverifiable write funnel: `bump(player.baseStats)` can
            // write `pool.qi` inside `bump` with no spelled token here.
            // Also flagged: a pool-carrier arg (`[pool]`, `{ref: pool}`),
            // a closure touching the pool, a pool-carrying receiver
            // (`[pool].forEach(cb)`), and indirect calls (`fn.call(t,
            // pool)`). Read-shaped callees (Object.entries, isObject,
            // clone, calculateStats, Math.*, console.*, ...) are the
            // enumerated exceptions; for .call/.apply/.bind the invoked
            // member is resolved and read-checked the same way.
            {
              const READ_ROOTS = new Set(['Object', 'JSON', 'Math', 'Reflect', 'console', 'Promise'])
              const invoked = invokedInfo(n)
              const effectiveMember = invoked?.member ?? calleeName
              const effectiveRoot = invoked?.root ?? calleeRoot
              // A member whose name IS the read operation is
              // read-shaped on any root (`MAIN_STAT_KEYS.filter`,
              // `arr.map`, `m.has`) - the member name pins semantics.
              const readShaped =
                READ_MEMBERS.has(effectiveMember) ||
                ((READ_ROOTS.has(effectiveRoot) || READ_ROOTS.has(calleeRoot)) &&
                  READ_MEMBERS.has(effectiveMember))
              const readIdentifier =
                effectiveRoot === '' && READ_IDENTIFIERS.has(effectiveMember)
              // `Object.assign({...fresh}, pool)` clones the pool onto
              // a NEW literal target - a read, not a write lane.
              const freshClone =
                effectiveMember === 'assign' &&
                n.arguments[0] !== undefined &&
                ts.isObjectLiteralExpression(unwrapExpr(n.arguments[0]))
              const carried =
                n.arguments.some(
                  (a) =>
                    isPoolRootAccess(a) ||
                    hasPoolCarrier(a) ||
                    hasPoolClosure(a),
                ) || hasPoolCarrier(n.expression)
              if (
                !readShaped &&
                !readIdentifier &&
                !freshClone &&
                carried
              ) {
                flag(`pool passed to opaque callee: ${n.getText(sf)}`)
              }
            }
            // Prefix/substring enumeration helpers: `k.startsWith('baseS')`,
            // `name.includes('$st')` - a spelled fragment feeding key
            // enumeration is suspect (>= 5 chars, shorter fragments are
            // too generic to distinguish).
            if (
              FRAGMENT_CALLS.has(calleeName) &&
              n.arguments.some((a) => fragmentOfPinned(literalize(a, binds)))
            ) {
              flag(`key-fragment arg: ${n.getText(sf)}`)
            }
            // Object.assign(<store-ish target>, payload) - indirect write
            if (calleeName === 'assign' && (calleeRoot === 'Object' || calleeRoot === '')) {
              const first = n.arguments[0]
              if (first !== undefined) {
                const unwrapped = unwrapExpr(first)
                if (
                  isStateSlot(unwrapped) ||
                  (ts.isPropertyAccessExpression(unwrapped) &&
                    ts.isIdentifier(unwrapped.expression) &&
                    /Store$/.test(unwrapped.expression.text))
                ) {
                  flag(n.getText(sf))
                }
              }
            }
            // store.$patch(literal|spread|indirect) in any spelling -
            // literal must be a plain object with no spread and no
            // baseStats prop; every other form is unprovable.
            if (calleeViaPatch) {
              const arg = n.arguments[0]
              if (arg !== undefined) {
                if (
                  !ts.isObjectLiteralExpression(arg) ||
                  hasBaseStatsProp(arg) ||
                  hasStateProp(arg) ||
                  hasPayloadAlias(arg) ||
                  hasSpread(arg)
                ) {
                  flag(n.getText(sf))
                }
              }
            }
            // fn.call/fn.apply where fn touches a structural write name
            // or $patch. A $patch receiver is as opaque as $patch
            // itself - flag every such form.
            if (calleeName === 'call' || calleeName === 'apply') {
              const callee0 = unwrapExpr(n.expression)
              const receiver =
                ts.isPropertyAccessExpression(callee0) ||
                ts.isElementAccessExpression(callee0)
                  ? callee0.expression
                  : callee0
              if (touchesPatch(receiver)) {
                flag(n.getText(sf))
              } else if (
                touchesStructuralName(receiver) &&
                n.arguments.some(
                  (a) =>
                    pool(a) ||
                    hasBaseStatsProp(a) ||
                    hasBaseStatsToken(a) ||
                    hasStateProp(a) ||
                    hasStateToken(a) ||
                    hasPayloadAlias(a),
                )
              ) {
                flag(n.getText(sf))
              }
              // Nested indirection: `X.call.call(fn, thisArg, ...)` /
              // `X.call.apply(fn, ...)` / `X.bind.call(...)` - the
              // receiver is itself an indirect-call member, so
              // arguments[0] is the invoked function and the rest are
              // (thisArg, real args). A pool argument reaching an
              // opaque function is an unprovable write lane.
              const recv0 = unwrapExpr(receiver)
              const recvMember =
                ts.isPropertyAccessExpression(recv0)
                  ? recv0.name.text
                  : ts.isElementAccessExpression(recv0)
                    ? literalize(recv0.argumentExpression, binds)
                    : undefined
              if (recvMember !== undefined && INDIRECT_NAMES.has(recvMember)) {
                const fnArg = n.arguments[0]
                const rest = n.arguments.slice(1)
                if (
                  (fnArg !== undefined &&
                    (touchesPatch(fnArg) || touchesStructuralName(fnArg)) &&
                    rest.some(
                      (a) =>
                        pool(a) ||
                        hasBaseStatsProp(a) ||
                        hasBaseStatsToken(a) ||
                        hasStateProp(a) ||
                        hasStateToken(a) ||
                        hasPayloadAlias(a),
                    )) ||
                  rest.some((a) => pool(a))
                ) {
                  flag(n.getText(sf))
                }
              }
            }
            // Reflect.apply(fn, thisArg, argsArray) with fn touching a
            // structural name, a $patch member or a member alias.
            if (
              calleeName === 'apply' &&
              calleeRoot === 'Reflect' &&
              n.arguments[0] !== undefined &&
              (touchesStructuralName(n.arguments[0]) ||
                touchesPatch(n.arguments[0]) ||
                (ts.isIdentifier(n.arguments[0]) &&
                  binds.memberAliases.has(n.arguments[0].text)))
            ) {
              flag(n.getText(sf))
            }
          } else {
            // Unresolvable callee: `(0, fn)(pool)`, `(getFn())(pool)`,
            // `x[K](pool)` with opaque K - an IIFE-invoked opaque fn
            // receiving the pool is an unverifiable channel.
            if (n.expression.kind === ts.SyntaxKind.ImportKeyword) {
              const spec = n.arguments[0]
              const lit = spec !== undefined ? literalize(spec, binds) : undefined
              if (
                lit === undefined ||
                lit.startsWith('data:') ||
                lit.startsWith('blob:') ||
                isTestSpecifier(lit)
              ) {
                flag(`opaque import(): ${n.getText(sf)}`)
              }
            } else if (
              n.arguments.some(
                (a) =>
                  isPoolRootAccess(a) ||
                  hasPoolCarrier(a) ||
                  hasPoolClosure(a),
              )
            ) {
              flag(`pool passed to unresolvable callee: ${n.getText(sf)}`)
            }
          }
        }
        // x.$state = <literal-with-baseStats | spread | opaque> in any
        // spelling - `x.$state=`, `x['$state']=`, `x[S]=`, `x['$'+'state']=`.
        if (
          ts.isBinaryExpression(n) &&
          n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          isStateSlot(n.left) &&
          (!ts.isObjectLiteralExpression(n.right) ||
            hasBaseStatsProp(n.right) ||
            hasStateProp(n.right) ||
            hasPayloadAlias(n.right) ||
            hasSpread(n.right))
        ) {
          flag(n.getText(sf))
        }
        n.forEachChild((c) => inspect(c, inner))
      }

      ts.forEachChild(sf, (c) => inspect(c, false))
    }

    // Script blocks: pass 1 aliases + pass 2 scan.
    const blocks = scriptText(rel, text)
    for (const block of blocks) {
      const sf = ts.createSourceFile(
        block.jsx ? 'probe.tsx' : 'probe.ts',
        block.body,
        ts.ScriptTarget.ESNext,
        true,
        block.jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      )
      ts.forEachChild(sf, collect)
    }
    for (const block of blocks) scanBody(block.body)

    // .vue template lane: directive attributes, interpolations and
    // v-model share the script's collected aliases.
    if (rel.endsWith('.vue')) {
      for (const expr of templateExpressions(text)) {
        scanBody(expr)
      }
      // v-model with a non-literal/unquoted member target is a write
      // lane even when the expression does not name the pool
      // (`v-model="rec[key]"`, `v-model=pool.defense`).
      const vmRe = /v-model(?::[\w.-]+)?(?:\.[\w.-]+)?\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      const tplText = stripVueInert(text)
      let m: RegExpExecArray | null
      while ((m = vmRe.exec(tplText)) !== null) {
        const v = m[1] ?? m[2] ?? m[3]
        if (v === undefined) continue
        const sf = ts.createSourceFile('p.ts', `x = ${v};`, ts.ScriptTarget.ESNext, true)
        let flagged = false
        const visit = (n: ts.Node): void => {
          if (flagged) return
          if (containsPoolAccess(n, binds)) {
            flagged = true
            return
          }
          if (
            ts.isElementAccessExpression(n) &&
            n.argumentExpression !== undefined &&
            !ts.isStringLiteral(n.argumentExpression) &&
            !ts.isNoSubstitutionTemplateLiteral(n.argumentExpression)
          ) {
            flagged = true
            return
          }
          ts.forEachChild(n, visit)
        }
        ts.forEachChild(sf, visit)
        if (flagged) flag(`v-model="${v}"`)
      }
    }
  }

  return { violations, unclassified }
}

describe('baseStats write authority - only level-up + pills', () => {
  it(
    'no production file outside the two enumerated channels writes baseStats',
    { timeout: SCAN_TIMEOUT },
    () => {
      const { unclassified } = collectOffenders()
      expect(
        unclassified,
        'New baseStats writer outside level-up/pills. The hidden predicate ' +
          'reads baseStats only - a third channel either silently funds it ' +
          '(economy lie) or bypasses getEffectiveMainStatCap. Route through ' +
          'an enumerated channel or extend the allowlist with its contract.',
      ).toEqual([])
    },
  )

  it(
    'allowlisted files stay the only writers (allowlist drift check)',
    { timeout: SCAN_TIMEOUT },
    () => {
      const { violations } = collectOffenders()
      // Per-file pin, not a global count: each enumerated channel must
      // still exist AND still exercise its write - a deleted or gutted
      // authority file is drift even when the others remain.
      for (const allowed of ALLOWED) {
        const hits = violations.filter((v) => v.file === allowed.path)
        expect(
          existsSync(join(GAME_ROOT, allowed.path)) && hits.length > 0,
          `Allowlisted authority file ${allowed.path} lost its baseStats ` +
            'write or vanished - the channel moved; update the contract, ' +
            'do not leave a stale entry.',
        ).toBe(true)
      }
    },
  )
})
