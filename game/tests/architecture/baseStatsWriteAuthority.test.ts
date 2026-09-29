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
 * binding-element initializers, bracket and const-string-key forms),
 * computed/const-key object props (`{[K]: v}` where K='baseStats'),
 * and .vue template lanes (event handlers incl. dynamic `@[key]`/
 * `#[slot]` names, bindings, interpolations, v-model incl. `:arg`
 * and modifier forms).
 *
 * Honest residual bound (documented, not hidden): computed keys that
 * never spell the name (`p[k]` with a computed k, Reflect.set with a
 * variable key), split string concatenation (`'base'+'Stats'` - no
 * single literal spells the name; substring heuristics are not used
 * because 'base'/'stat'/'stats' collide with ordinary prop names),
 * opaque payload data flow where no `baseStats`/`$state` token appears
 * (`Object.assign(p, payloadVar)` on a plain object), runtime name
 * enumeration (`Object.keys`/`Reflect.ownKeys` then `ps[name]`), eval /
 * imported bindings, transitive multi-hop aliases, and writes authored
 * inside the allowlisted files themselves - the allowlist IS the trust
 * boundary. Those are human-review lanes.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'
import { srcCorpus, SCAN_TIMEOUT } from './helpers/scanTs'
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

/** Is `node` a property/element access naming baseStats, or a
 * reflective read that returns the pool (`Reflect.get(x,'baseStats')`,
 * `Object.getOwnPropertyDescriptor(x,'baseStats')`)? */
function isBaseStatsAccess(node: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === 'baseStats'
  }
  if (ts.isElementAccessExpression(node)) {
    const arg = node.argumentExpression
    return (
      arg !== undefined &&
      (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) &&
      arg.text === 'baseStats'
    )
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression
    if (ts.isPropertyAccessExpression(callee)) {
      const root = ts.isIdentifier(callee.expression)
        ? callee.expression.text
        : callee.expression.getText()
      if (
        (root === 'Reflect' && callee.name.text === 'get') ||
        (root === 'Object' && callee.name.text === 'getOwnPropertyDescriptor')
      ) {
        return node.arguments.some(
          (a) =>
            (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) &&
            a.text === 'baseStats',
        )
      }
    }
  }
  return false
}

/** Transparent wrappers around an expression: parens, nonnull, as,
 * satisfies - they never change what object the expression yields. */
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
    } else {
      return cur
    }
  }
}

/** Does the subtree contain a baseStats access or an alias-rooted member access? */
function containsPoolAccess(node: ts.Node, aliases: ReadonlySet<string>, constKeys: ReadonlyMap<string, string>): boolean {
  let found = false
  const visit = (n: ts.Node): void => {
    if (found) return
    if (isBaseStatsAccess(n)) {
      found = true
      return
    }
    if (
      ts.isElementAccessExpression(n) &&
      n.argumentExpression !== undefined &&
      ts.isIdentifier(n.argumentExpression) &&
      constKeys.get(n.argumentExpression.text) === 'baseStats'
    ) {
      found = true
      return
    }
    if (
      (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) &&
      ts.isIdentifier(unwrapExpr(n.expression)) &&
      aliases.has(unwrapExpr(n.expression).getText())
    ) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
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

function collectOffenders(): { violations: Offender[]; unclassified: Offender[] } {
  const violations: Offender[] = []
  const unclassified: Offender[] = []

  const corpus = [...srcCorpus(SRC_DIR)]
  if (existsSync(ELECTRON_DIR)) corpus.push(...srcCorpus(ELECTRON_DIR))

  for (const file of corpus) {
    if (TEST_EXT_RE.test(file.path)) continue
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

    // ---- pass 1: collect aliases + const keys + global aliases ----
    const aliases = new Set<string>()
    // `const K = 'baseStats' | '$state'` - identifier -> literal value.
    const constKeys = new Map<string, string>()
    // `const O = Object` / `const R = Reflect` / `const G = globalThis`
    // - one-level aliases onto the reflective roots.
    const rootAliases = new Map<string, string>()
    // `const fn = store.$patch` / `const f = obj.assign` /
    // `const {assign} = Object` - an identifier bound to a structural
    // member, used via bare call or .call/.apply. `root` is the source
    // root when known (destructured off Object/Reflect), else '__expr__'.
    const memberAliases = new Map<string, { member: string; root: string }>()

    const isPoolRootAccess = (n: ts.Node): boolean => {
      let cur = n
      while (ts.isParenthesizedExpression(cur) || ts.isNonNullExpression(cur)) {
        cur = cur.expression
      }
      return isBaseStatsAccess(cur)
    }

    const collect = (n: ts.Node): void => {
      // const { baseStats } = x / const { baseStats: b } = x /
      // const { x = p.baseStats } = {} - destructured pool aliases.
      // Also function params: `f({ baseStats })` is a write channel.
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
            aliases.add(el.name.text)
          } else if (prop === undefined && ts.isIdentifier(el.name) && el.name.text === 'baseStats') {
            aliases.add('baseStats')
          } else if (
            el.initializer !== undefined &&
            isPoolRootAccess(el.initializer) &&
            ts.isIdentifier(el.name)
          ) {
            aliases.add(el.name.text)
          }
          // const { assign } = Object / const { set } = Reflect -
          // destructured structural write names.
          const declInit =
            ts.isVariableDeclaration(n) && n.initializer !== undefined
              ? unwrapExpr(n.initializer)
              : undefined
          if (
            declInit !== undefined &&
            ts.isIdentifier(el.name) &&
            ((ts.isIdentifier(declInit) &&
              (declInit.text === 'Object' ||
                declInit.text === 'Reflect' ||
                rootAliases.get(declInit.text) === 'Object' ||
                rootAliases.get(declInit.text) === 'Reflect')) ||
              (ts.isPropertyAccessExpression(declInit) &&
                ts.isIdentifier(declInit.expression) &&
                (declInit.expression.text === 'globalThis' ||
                  rootAliases.get(declInit.expression.text) === 'globalThis') &&
                ['Object', 'Reflect'].includes(declInit.name.text)))
          ) {
            const memberName =
              el.propertyName !== undefined && ts.isIdentifier(el.propertyName)
                ? el.propertyName.text
                : el.name.text
            if (STRUCTURAL_WRITE_NAMES.has(memberName) || memberName === '$patch') {
              const srcRoot = ts.isIdentifier(declInit)
                ? (rootAliases.get(declInit.text) ?? declInit.text)
                : declInit.name.text
              memberAliases.set(el.name.text, { member: memberName, root: srcRoot })
            }
          }
        }
      }
      // const s = x.baseStats / const s = x['baseStats'] - the
      // initializer must BE the pool reference (a call or literal
      // merely mentioning it - `f(x.baseStats)`, `{...x.baseStats}` -
      // produces a different object and is not an alias).
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        isPoolRootAccess(n.initializer)
      ) {
        aliases.add(n.name.text)
      }
      // s = x.baseStats (outer-scope assign)
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(n.left) &&
        isPoolRootAccess(n.right)
      ) {
        aliases.add(n.left.text)
      }
      // const K = 'baseStats' / const S = '$state'
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        (ts.isStringLiteral(n.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(n.initializer)) &&
        (n.initializer.text === 'baseStats' || n.initializer.text === '$state')
      ) {
        constKeys.set(n.name.text, n.initializer.text)
      }
      // const O = Object / const R = Reflect / const G = globalThis /
      // const O = globalThis.Object - reflective-root aliases.
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined
      ) {
        const init = n.initializer
        if (ts.isIdentifier(init) && ['Object', 'Reflect', 'globalThis'].includes(init.text)) {
          rootAliases.set(n.name.text, init.text)
        } else if (
          ts.isPropertyAccessExpression(init) &&
          ts.isIdentifier(init.expression) &&
          (init.expression.text === 'globalThis' ||
            rootAliases.get(init.expression.text) === 'globalThis') &&
          ['Object', 'Reflect'].includes(init.name.text)
        ) {
          rootAliases.set(n.name.text, init.name.text)
        }
        // const fn = <something>.$patch / <something>.<structural-name>
        // (bracket form `x['$patch']` resolves the same way)
        let memberName: string | undefined
        if (ts.isPropertyAccessExpression(init)) {
          memberName = init.name.text
        } else if (
          ts.isElementAccessExpression(init) &&
          init.argumentExpression !== undefined &&
          (ts.isStringLiteral(init.argumentExpression) ||
            ts.isNoSubstitutionTemplateLiteral(init.argumentExpression))
        ) {
          memberName = init.argumentExpression.text
        }
        if (
          memberName !== undefined &&
          (memberName === '$patch' || STRUCTURAL_WRITE_NAMES.has(memberName))
        ) {
          memberAliases.set(n.name.text, { member: memberName, root: '__expr__' })
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

      const pool = (n: ts.Node): boolean => containsPoolAccess(n, aliases, constKeys)

      // Literal property with a given name: `{ name: x }`, `{ 'name': x }`,
      // `{ [K]: x }` where K is a const bound to `name`.
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
              const e = nm.expression
              if (
                ((ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) &&
                  e.text === name) ||
                (ts.isIdentifier(e) && constKeys.get(e.text) === name)
              ) {
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

      // Resolve a member-access root through one-level aliases:
      // `O.defineProperty` where `const O = Object`, `globalThis.Reflect`,
      // `globalThis.globalThis.Object`.
      const resolveRoot = (expr: ts.Expression): string => {
        let cur: ts.Expression = expr
        const names: string[] = []
        while (ts.isPropertyAccessExpression(cur)) {
          names.unshift(cur.name.text)
          cur = cur.expression
        }
        if (ts.isIdentifier(cur)) {
          const aliased = rootAliases.get(cur.text)
          names.unshift(aliased ?? cur.text)
        }
        if (names[0] === 'globalThis') names.shift()
        if (names[0] === 'globalThis') names.shift()
        return names.join('.')
      }

      // Does a subtree reference a pinned structural write name or
      // `$patch` as a member (`s.$patch`, `obj.defineProperty`)?
      const touchesStructuralName = (n: ts.Node): boolean => {
        let hit = false
        const walk = (x: ts.Node): void => {
          if (hit) return
          if (
            ts.isPropertyAccessExpression(x) &&
            (STRUCTURAL_WRITE_NAMES.has(x.name.text) || x.name.text === '$patch')
          ) {
            hit = true
            return
          }
          if (
            ts.isElementAccessExpression(x) &&
            x.argumentExpression !== undefined &&
            (ts.isStringLiteral(x.argumentExpression) ||
              ts.isNoSubstitutionTemplateLiteral(x.argumentExpression)) &&
            (STRUCTURAL_WRITE_NAMES.has(x.argumentExpression.text) ||
              x.argumentExpression.text === '$patch')
          ) {
            hit = true
            return
          }
          ts.forEachChild(x, walk)
        }
        walk(n)
        return hit
      }

      // Anywhere a literal token or a const-key bound to it appears:
      // 'baseStats' / '$state' / `x[K]` / bare `K` in an arg.
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
          if (ts.isIdentifier(x) && constKeys.get(x.text) === name) {
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

      // `x.$state`, `x['$state']`, `x[S]` (S const) - the state slot on a store.
      const isStateSlot = (x: ts.Node): boolean => {
        if (ts.isPropertyAccessExpression(x)) return x.name.text === '$state'
        if (ts.isElementAccessExpression(x)) {
          const a = x.argumentExpression
          if (a === undefined) return false
          if (
            (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) &&
            a.text === '$state'
          ) {
            return true
          }
          return ts.isIdentifier(a) && constKeys.get(a.text) === '$state'
        }
        return false
      }

      // Does the subtree name $patch as a member or bind a $patch alias?
      const touchesPatch = (n: ts.Node): boolean => {
        let hit = false
        const walk = (x: ts.Node): void => {
          if (hit) return
          if (ts.isPropertyAccessExpression(x) && x.name.text === '$patch') {
            hit = true
            return
          }
          if (
            ts.isElementAccessExpression(x) &&
            x.argumentExpression !== undefined &&
            (ts.isStringLiteral(x.argumentExpression) ||
              ts.isNoSubstitutionTemplateLiteral(x.argumentExpression)) &&
            x.argumentExpression.text === '$patch'
          ) {
            hit = true
            return
          }
          if (ts.isIdentifier(x) && memberAliases.get(x.text)?.member === '$patch') {
            hit = true
            return
          }
          ts.forEachChild(x, walk)
        }
        walk(n)
        return hit
      }

      const inspect = (n: ts.Node): void => {
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
        // for-of / for-in target
        if (
          (ts.isForOfStatement(n) || ts.isForInStatement(n)) &&
          pool(n.initializer)
        ) {
          flag(n.initializer.getText(sf))
        }
        if (ts.isCallExpression(n)) {
          const callee = unwrapExpr(n.expression)
          // Resolve the callee to a member name + root across spelled
          // spellings: `x.y(...)`, `x['y'](...)`, `(x.y)(...)`,
          // `x[K](...)` (const key), bare `f(...)` (member alias).
          let calleeName = ''
          let calleeRoot = ''
          let calleeViaPatch = false
          if (ts.isPropertyAccessExpression(callee)) {
            calleeName = callee.name.text
            calleeRoot = resolveRoot(callee.expression)
            calleeViaPatch = calleeName === '$patch'
          } else if (ts.isElementAccessExpression(callee)) {
            const a = callee.argumentExpression
            if (
              a !== undefined &&
              (ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a))
            ) {
              calleeName = a.text
              calleeRoot = resolveRoot(callee.expression)
              calleeViaPatch = calleeName === '$patch'
            } else if (a !== undefined && ts.isIdentifier(a) && constKeys.has(a.text)) {
              calleeName = constKeys.get(a.text) ?? ''
              calleeRoot = resolveRoot(callee.expression)
              calleeViaPatch = calleeName === '$patch'
            }
          } else if (ts.isIdentifier(callee)) {
            const bound = memberAliases.get(callee.text)
            if (bound !== undefined) {
              calleeName = bound.member
              calleeRoot = bound.root === '__expr__' ? '' : bound.root
              calleeViaPatch = bound.member === '$patch'
            }
          }
          if (calleeName !== '') {
            const isStructuralCall =
              STRUCTURAL_WRITE_NAMES.has(calleeName) &&
              (calleeRoot === 'Object' ||
                calleeRoot === 'Reflect' ||
                calleeRoot === '')
            // Object.assign / Reflect.set|defineProperty|deleteProperty /
            // Object.defineProperty|defineProperties with pool, a
            // baseStats/$state token or prop, or an unprovable spread in
            // any arg.
            if (isStructuralCall) {
              if (
                n.arguments.some(
                  (a) =>
                    pool(a) ||
                    hasBaseStatsProp(a) ||
                    hasBaseStatsToken(a) ||
                    hasStateProp(a) ||
                    hasStateToken(a) ||
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
                  hasSpread(arg)
                ) {
                  flag(n.getText(sf))
                }
              }
            }
            // fn.call/fn.apply where fn touches a structural write name
            // or $patch - `store.$patch.call(s, {baseStats})`,
            // `Object.assign.call(Object, p, {...})`. A $patch receiver
            // is as opaque as $patch itself, so its args get the
            // $patch rule rather than the spelled-token rule.
            if (calleeName === 'call' || calleeName === 'apply') {
              const receiver =
                ts.isPropertyAccessExpression(callee) ||
                ts.isElementAccessExpression(callee)
                  ? callee.expression
                  : callee
              const receiverIsPatch = touchesPatch(receiver)
              const receiverIsStructural =
                receiverIsPatch ||
                touchesStructuralName(receiver) ||
                (ts.isIdentifier(receiver) && memberAliases.has(receiver.text))
              // A $patch call/apply receiver is as opaque as $patch
              // itself (arg[0] is thisArg, the payload position is
              // unprovable) - flag every such form.
              if (receiverIsPatch) {
                flag(n.getText(sf))
              } else if (
                receiverIsStructural &&
                n.arguments.some(
                  (a) =>
                    pool(a) ||
                    hasBaseStatsProp(a) ||
                    hasBaseStatsToken(a) ||
                    hasStateProp(a) ||
                    hasStateToken(a),
                )
              ) {
                flag(n.getText(sf))
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
                  memberAliases.has(n.arguments[0].text)))
            ) {
              flag(n.getText(sf))
            }
          }
        }
        // x.$state = <literal-with-baseStats | spread | opaque> in any
        // spelling - `x.$state=`, `x['$state']=`, `x[S]=` (S const).
        if (
          ts.isBinaryExpression(n) &&
          n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          isStateSlot(n.left) &&
          (!ts.isObjectLiteralExpression(n.right) ||
            hasBaseStatsProp(n.right) ||
            hasStateProp(n.right) ||
            hasSpread(n.right))
        ) {
          flag(n.getText(sf))
        }
        ts.forEachChild(n, inspect)
      }

      ts.forEachChild(sf, inspect)
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
          if (containsPoolAccess(n, aliases, constKeys)) {
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
      expect(
        violations.length,
        'An allowlisted authority file lost its baseStats write - the ' +
          'channel moved; update the contract, do not leave a stale entry.',
      ).toBeGreaterThan(0)
    },
  )
})
