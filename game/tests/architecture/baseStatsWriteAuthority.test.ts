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
 * `:arg` and modifier forms).
 *
 * Honest residual bound (documented, not hidden): computed keys that
 * never spell the name (`p[k]` with a computed k, Reflect.set with a
 * variable key), opaque payload data flow where no `baseStats`/`$state`
 * token appears (`Object.assign(p, payloadVar)` on a plain object),
 * runtime name enumeration (`Object.keys`/`Reflect.ownKeys` then
 * `ps[name]` without a spelled comparison), eval / imported bindings,
 * deep transitive aliasing beyond the ordered-declaration lanes above,
 * and writes authored inside the allowlisted files themselves - the
 * allowlist IS the trust boundary. The `*.test.*` exemption requires a
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
import { srcCorpus, SCAN_TIMEOUT, looksLikeTestFile, isTestSpecifier } from './helpers/scanTs'
import { scriptBlocksOf } from './helpers/commentStrip'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')
const ELECTRON_DIR = join(GAME_ROOT, 'electron')

const TEST_EXT_RE = /\.test\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/

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

/** Static knowledge a file's declarations yield: which identifiers are
 * bound to what. */
interface Bindings {
  aliases: Set<string>
  payloadAliases: Set<string>
  constKeys: Map<string, string>
  rootAliases: Map<string, string>
  memberAliases: Map<string, { member: string; root: string }>
}

/** Evaluate a spelled string position: literal, const-key binding, or
 * a concat of spelled pieces (`'$'+'patch'`). Returns undefined when
 * any part is not statically spelled. */
function literalize(e: ts.Expression | undefined, b: Bindings): string | undefined {
  if (e === undefined) return undefined
  const un = unwrapExpr(e)
  if (ts.isStringLiteral(un) || ts.isNoSubstitutionTemplateLiteral(un)) {
    return un.text
  }
  if (ts.isIdentifier(un)) {
    return b.constKeys.get(un.text)
  }
  if (
    ts.isBinaryExpression(un) &&
    un.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const l = literalize(un.left, b)
    const r = literalize(un.right, b)
    if (l !== undefined && r !== undefined) return l + r
  }
  // `base${'S'}tats` - a template whose every embedded expression spells.
  if (ts.isTemplateExpression(un)) {
    let joined = un.head.text
    for (const span of un.templateSpans) {
      const mid = literalize(span.expression, b)
      if (mid === undefined) return undefined
      joined += mid + span.literal.text
    }
    return joined
  }
  // String('x') / Symbol.for('x') - spelled-through builtins.
  if (ts.isCallExpression(un) && un.arguments.length === 1) {
    const callee = unwrapExpr(un.expression)
    const isStringCtor = ts.isIdentifier(callee) && callee.text === 'String'
    const isSymbolFor =
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === 'for' &&
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === 'Symbol'
    if (isStringCtor || isSymbolFor) {
      return literalize(un.arguments[0], b)
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

/** Does the subtree contain a baseStats access, a bare pool alias, or
 * an alias-rooted member access? */
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
      (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) &&
      ts.isIdentifier(unwrapExpr(n.expression)) &&
      b.aliases.has(unwrapExpr(n.expression).getText())
    ) {
      found = true
      return
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

/**
 * Expression-bearing text regions inside a .vue template: attribute
 * values on directive-ish names (`v-`, `@`, `:`, `#`) and mustache
 * interpolations. Values are parsed as statement bodies so
 * `@click="x=1"` and `{{ foo() }}` share the same write-site scan.
 */
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

    const flag = (snippet: string): void => {
      const offender = { file: rel, text: snippet.slice(0, 160).replace(/\s+/g, ' ').trim() }
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
        if (ci !== undefined && ci.member === 'Proxy' && ci.root === '') {
          const a0 = e.arguments?.[0]
          return a0 !== undefined && isPoolRootAccess(a0)
        }
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
      if (bindPattern !== undefined) {
        for (const el of bindPattern.elements) {
          const prop = el.propertyName
          if (
            prop !== undefined &&
            ts.isIdentifier(prop) &&
            prop.text === 'baseStats' &&
            ts.isIdentifier(el.name)
          ) {
            binds.aliases.add(el.name.text)
          } else if (prop === undefined && ts.isIdentifier(el.name) && el.name.text === 'baseStats') {
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
            el.propertyName !== undefined && ts.isIdentifier(el.propertyName)
              ? el.propertyName.text
              : ts.isIdentifier(el.name)
                ? el.name.text
                : ''
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
          }
        }
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
      // s = x.baseStats (outer-scope assign)
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(n.left) &&
        isPoolRootAccess(n.right)
      ) {
        binds.aliases.add(n.left.text)
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
          (['Object', 'Reflect'].includes(init.text) || GLOBAL_ROOTS.has(init.text))
        ) {
          binds.rootAliases.set(n.name.text, init.text)
        } else {
          const rootName = resolveRoot(init, binds)
          if (
            ts.isPropertyAccessExpression(init) &&
            (rootName === 'Object' || rootName === 'Reflect')
          ) {
            binds.rootAliases.set(n.name.text, init.name.text)
          }
        }
        // const fn = <something>.$patch / <something>.<structural-name>,
        // incl. bracket form and .bind/.call/.apply captures:
        // `const pp = (store.$patch)`, `const q = s.$patch.bind(s)`.
        let memberName: string | undefined
        let target: ts.Expression = init
        if (ts.isCallExpression(target)) {
          const c = unwrapExpr(target.expression)
          if (
            ts.isPropertyAccessExpression(c) &&
            INDIRECT_NAMES.has(c.name.text)
          ) {
            target = unwrapExpr(c.expression)
          }
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

      // `x.$state`, `x['$state']`, `x[S]`, `x['$'+'state']`.
      const isStateSlot = (x: ts.Node): boolean => {
        if (ts.isPropertyAccessExpression(x)) return x.name.text === '$state'
        if (ts.isElementAccessExpression(x)) {
          return literalize(x.argumentExpression, binds) === '$state'
        }
        return false
      }

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
        }
        if (testExpr !== undefined && hasBaseStatsToken(testExpr)) {
          inner = true
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
        // assignment / compound assignment target
        if (
          ts.isBinaryExpression(n) &&
          COMPOUND_ASSIGN.has(n.operatorToken.kind) &&
          pool(n.left)
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
        // delete expr
        if (ts.isDeleteExpression(n) && pool(n.expression)) {
          flag(n.getText(sf))
        }
        // `with (x) { ... }` - bare identifiers inside resolve through
        // x's members, which no static binding lane can prove. The
        // corpus is strict-mode anyway; any `with` is suspect.
        if (ts.isWithStatement(n)) {
          flag(`with(...) opaque member scope`)
        }
        // for-of / for-in target
        if (
          (ts.isForOfStatement(n) || ts.isForInStatement(n)) &&
          pool(n.initializer)
        ) {
          flag(n.initializer.getText(sf))
        }
        if (ts.isCallExpression(n)) {
          const info = resolveCallee(n.expression, binds)
          if (info !== undefined) {
            const calleeName = info.member
            const calleeRoot = info.root
            const calleeViaPatch = calleeName === '$patch'
            const isStructuralCall =
              STRUCTURAL_WRITE_NAMES.has(calleeName) &&
              (calleeRoot === 'Object' ||
                calleeRoot === 'Reflect' ||
                calleeRoot === '')
            // Object.assign / Reflect.set|defineProperty|deleteProperty /
            // Object.defineProperty|defineProperties with pool, a
            // baseStats/$state token or prop, a payload-alias, or an
            // unprovable spread in any arg.
            if (isStructuralCall) {
              if (
                n.arguments.some(
                  (a) =>
                    pool(a) ||
                    hasBaseStatsProp(a) ||
                    hasBaseStatsToken(a) ||
                    hasStateProp(a) ||
                    hasStateToken(a) ||
                    hasPayloadAlias(a) ||
                    hasSpread(a),
                )
              ) {
                flag(n.getText(sf))
              }
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
      let m: RegExpExecArray | null
      while ((m = vmRe.exec(text)) !== null) {
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
