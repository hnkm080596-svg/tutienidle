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
 * defineProperties, Reflect.set/defineProperty/deleteProperty/apply,
 * .call/.apply on the structural names, callee-root aliases
 * (`const O = Object`, `globalThis.Reflect`), Pinia `$patch` (literal,
 * spread and indirect forms), `$state` forged-state replacement
 * (literal or opaque), pool aliases (rooted access, destructured,
 * bracket and const-string-key forms), and .vue template lanes
 * (event handlers, bindings, interpolations, v-model).
 *
 * Honest residual bound (documented, not hidden): computed keys that
 * never spell the name (`p[k]` with a computed k, Reflect.set with a
 * variable key), opaque payload data flow where no `baseStats` token
 * appears (`Object.assign(p, payloadVar)` on a plain object), runtime
 * name enumeration (`Object.keys`/`Reflect.ownKeys` then `ps[name]`),
 * eval/imported bindings, transitive and parameter aliases, and writes
 * authored inside the allowlisted files themselves - the allowlist IS
 * the trust boundary. Those are human-review lanes.
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

/** Is `node` a property/element access naming baseStats? */
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
  return false
}

/** Does the subtree contain a baseStats access or an alias-rooted member access? */
function containsPoolAccess(node: ts.Node, aliases: ReadonlySet<string>, constKeys: ReadonlySet<string>): boolean {
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
      constKeys.has(n.argumentExpression.text)
    ) {
      found = true
      return
    }
    if (
      (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) &&
      ts.isIdentifier(n.expression) &&
      aliases.has(n.expression.text)
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
    const constKeys = new Set<string>()
    // `const O = Object` / `const R = Reflect` / `const G = globalThis`
    // - one-level aliases onto the reflective roots.
    const rootAliases = new Map<string, string>()
    // `const fn = store.$patch` / `const f = obj.assign` - an identifier
    // bound to a structural member, used via .call/.apply.
    const memberAliases = new Set<string>()

    const isPoolRootAccess = (n: ts.Node): boolean => {
      let cur = n
      while (ts.isParenthesizedExpression(cur) || ts.isNonNullExpression(cur)) {
        cur = cur.expression
      }
      return isBaseStatsAccess(cur)
    }

    const collect = (n: ts.Node): void => {
      // const { baseStats } = x / const { baseStats: b } = x
      if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name)) {
        for (const el of n.name.elements) {
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
      // const K = 'baseStats'
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.initializer !== undefined &&
        (ts.isStringLiteral(n.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(n.initializer)) &&
        n.initializer.text === 'baseStats'
      ) {
        constKeys.add(n.name.text)
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
        if (
          ts.isPropertyAccessExpression(init) &&
          (init.name.text === '$patch' ||
            STRUCTURAL_WRITE_NAMES.has(init.name.text))
        ) {
          memberAliases.add(n.name.text)
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

      const hasBaseStatsProp = (n: ts.Node): boolean => {
        let hit = false
        const walk = (x: ts.Node): void => {
          if (hit) return
          if (
            (ts.isPropertyAssignment(x) || ts.isShorthandPropertyAssignment(x)) &&
            ts.isIdentifier(x.name) &&
            x.name.text === 'baseStats'
          ) {
            hit = true
            return
          }
          ts.forEachChild(x, walk)
        }
        walk(n)
        return hit
      }

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
          ts.forEachChild(x, walk)
        }
        walk(n)
        return hit
      }

      const hasBaseStatsToken = (n: ts.Node): boolean => {
        let hit = false
        const walk = (x: ts.Node): void => {
          if (hit) return
          if (
            (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) &&
            x.text === 'baseStats'
          ) {
            hit = true
            return
          }
          if (
            ts.isElementAccessExpression(x) &&
            x.argumentExpression !== undefined &&
            ts.isIdentifier(x.argumentExpression) &&
            constKeys.has(x.argumentExpression.text)
          ) {
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
          const callee = n.expression
          if (ts.isPropertyAccessExpression(callee)) {
            const calleeName = callee.name.text
            const calleeRoot = resolveRoot(callee.expression)
            const isStructuralCall =
              STRUCTURAL_WRITE_NAMES.has(calleeName) &&
              (calleeRoot === 'Object' || calleeRoot === 'Reflect')
            // Object.assign / Reflect.set|defineProperty|deleteProperty /
            // Object.defineProperty|defineProperties with pool or a
            // baseStats token in any arg (aliases resolved via rootAliases).
            if (isStructuralCall) {
              if (
                n.arguments.some((a) => pool(a) || hasBaseStatsProp(a) || hasBaseStatsToken(a) || hasSpread(a))
              ) {
                flag(n.getText(sf))
              }
            }
            // Object.assign(<store-ish target>, payload) - indirect write
            if (calleeName === 'assign' && calleeRoot === 'Object') {
              const first = n.arguments[0]
              if (
                first !== undefined &&
                ts.isPropertyAccessExpression(first) &&
                (first.name.text === '$state' ||
                  (ts.isIdentifier(first.expression) &&
                    /Store$/.test(first.expression.text)))
              ) {
                flag(n.getText(sf))
              }
            }
            // store.$patch(literal|spread|indirect) - literal must be a
            // plain object with no spread and no baseStats prop; every
            // other form is unprovable and flagged.
            if (calleeName === '$patch') {
              const arg = n.arguments[0]
              if (arg !== undefined) {
                if (
                  !ts.isObjectLiteralExpression(arg) ||
                  hasBaseStatsProp(arg) ||
                  hasSpread(arg)
                ) {
                  flag(n.getText(sf))
                }
              }
            }
            // fn.call/fn.apply where fn touches a structural write name
            // or $patch - `store.$patch.call(s, {baseStats})`,
            // `Object.assign.call(Object, p, {...})`.
            if (
              (calleeName === 'call' || calleeName === 'apply') &&
              (touchesStructuralName(callee.expression) ||
                (ts.isIdentifier(callee.expression) &&
                  memberAliases.has(callee.expression.text))) &&
              n.arguments.some((a) => pool(a) || hasBaseStatsProp(a) || hasBaseStatsToken(a))
            ) {
              flag(n.getText(sf))
            }
            // Reflect.apply(fn, thisArg, argsArray) with fn touching a
            // structural name or $patch.
            if (
              calleeName === 'apply' &&
              calleeRoot === 'Reflect' &&
              n.arguments[0] !== undefined &&
              touchesStructuralName(n.arguments[0])
            ) {
              flag(n.getText(sf))
            }
            // Reflect.get / Object.getOwnPropertyDescriptor with the
            // literal name in-sight is handled by the funnel guard; here
            // only pool-touching args matter.
          }
        }
        // x.$state = <literal-with-baseStats | spread | opaque> -
        // forged state replacement.
        if (
          ts.isBinaryExpression(n) &&
          n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(n.left) &&
          n.left.name.text === '$state' &&
          (!ts.isObjectLiteralExpression(n.right) ||
            hasBaseStatsProp(n.right) ||
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
      const vmRe = /v-model(?:\.[\w.-]+)?\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
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
