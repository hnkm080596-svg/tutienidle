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
 * sessions set up state directly; they are not production authority).
 *
 * SCAN MODEL: the guard walks the real TypeScript AST (typescript is
 * already a dev dep via vue-tsc), so whitespace, comments, parens,
 * template/unicode string forms and multi-line layouts cannot hide a
 * write. Honest residual bound (documented, not hidden): computed
 * keys carried through non-literal expressions (`p[k]` with a
 * computed k), transitive aliases (`const b = a`), parameter or
 * loop-bound aliases, and writes authored inside the allowlisted
 * files themselves (the allowlist IS the trust boundary). Those are
 * human-review lanes, not detectable-by-lexicon lanes.
 */
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'
import { srcCorpus, SCAN_TIMEOUT } from './helpers/scanTs'
import { scriptBlocksOf } from './helpers/commentStrip'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')

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

interface Offender {
  file: string
  text: string
}

function collectOffenders(): { violations: Offender[]; unclassified: Offender[] } {
  const violations: Offender[] = []
  const unclassified: Offender[] = []

  for (const file of srcCorpus(SRC_DIR)) {
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

    // .vue template lane: two-way binding into the pool.
    if (rel.endsWith('.vue')) {
      const vm = /v-model\s*=\s*"[^"]*\bbaseStats\b[^"]*"|v-model\s*=\s*'[^']*\bbaseStats\b[^']*'/g
      let m: RegExpExecArray | null
      while ((m = vm.exec(text)) !== null) flag(m[0])
    }

    for (const block of scriptText(rel, text)) {
      const sf = ts.createSourceFile(
        block.jsx ? 'probe.tsx' : 'probe.ts',
        block.body,
        ts.ScriptTarget.ESNext,
        true,
        block.jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      )

      // Pass 1: collect pool aliases and const string keys.
      const aliases = new Set<string>()
      const constKeys = new Set<string>()
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
        ts.forEachChild(n, collect)
      }

      // `x.baseStats`, `x['baseStats']`, `(x.baseStats)`, `x.baseStats!`
      // - the expression rooted exactly at the pool, nothing deeper.
      const isPoolRootAccess = (n: ts.Node): boolean => {
        let cur = n
        while (ts.isParenthesizedExpression(cur) || ts.isNonNullExpression(cur)) {
          cur = cur.expression
        }
        return isBaseStatsAccess(cur)
      }

      ts.forEachChild(sf, collect)

      const pool = (n: ts.Node): boolean => containsPoolAccess(n, aliases, constKeys)

      // Pass 2: flag write sites whose subtree touches the pool.
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
          const calleeName = ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : ts.isIdentifier(callee)
              ? callee.text
              : ''
          const calleeRoot = ts.isPropertyAccessExpression(callee)
            ? callee.expression.getText(sf)
            : ''
          // Object.assign / Reflect.set|defineProperty|deleteProperty /
          // Object.defineProperty|defineProperties with pool in any arg
          if (
            (calleeName === 'assign' && calleeRoot === 'Object') ||
            (calleeName === 'set' && calleeRoot === 'Reflect') ||
            (calleeName === 'defineProperty' &&
              (calleeRoot === 'Object' || calleeRoot === 'Reflect')) ||
            (calleeName === 'defineProperties' && calleeRoot === 'Object') ||
            (calleeName === 'deleteProperty' && calleeRoot === 'Reflect')
          ) {
            if (
              n.arguments.some(
                (a) =>
                  pool(a) ||
                  hasBaseStatsProp(a) ||
                  ((ts.isStringLiteral(a) ||
                    ts.isNoSubstitutionTemplateLiteral(a)) &&
                    a.text === 'baseStats'),
              )
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
          // store.$patch({baseStats...}) literal OR $patch(var) indirect
          if (calleeName === '$patch') {
            const arg = n.arguments[0]
            if (arg !== undefined && !ts.isObjectLiteralExpression(arg)) {
              flag(n.getText(sf))
            } else if (arg !== undefined && hasBaseStatsProp(arg)) {
              flag(n.getText(sf))
            }
          }
        }
        // x.$state = { ...baseStats: forged... } - forged state replace
        if (
          ts.isBinaryExpression(n) &&
          n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(n.left) &&
          n.left.name.text === '$state' &&
          hasBaseStatsProp(n.right)
        ) {
          flag(n.getText(sf))
        }
        ts.forEachChild(n, inspect)
      }

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

      ts.forEachChild(sf, inspect)
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
