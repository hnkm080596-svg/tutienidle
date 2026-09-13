// @vitest-environment node
import { describe, expect, it } from 'vitest'
// @ts-expect-error project omits Node ambient types by design (pattern: App.wiring.test.ts)
import { readdirSync, readFileSync, statSync } from 'node:fs'
// @ts-expect-error see above
import { join, dirname } from 'node:path'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const GAME_ROOT = dirname(dirname(__dirname)) // points to game/
const SRC_ROOT = dirname(__dirname) // points to game/src/

const PRIMARY_LIFECYCLE_METHODS = new Set([
  'start',
  'stop',
  'launch',
  'sleep',
  'wake',
  'switch',
  'run',
  'restart',
])

const ALLOWLISTED_FILES = new Set([
  'src/presentation/PhaserSceneAdapter.ts',
  'src/game/scenes/TranPhapCombatPreviewScene.ts',
  'src/game/scenes/AssetLoaderScene.ts',
])

interface Violation {
  file: string
  line: number
  callText: string
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'dist' && entry !== '.git') {
        files.push(...collectSourceFiles(fullPath))
      }
    } else if (
      (fullPath.endsWith('.ts') || fullPath.endsWith('.vue')) &&
      !fullPath.includes('.test.') &&
      !fullPath.includes('.spec.')
    ) {
      files.push(fullPath)
    }
  }
  return files
}

function checkSourceForLifecycleCalls(sourceText: string, filePath: string): Violation[] {
  const violations: Violation[] = []
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.vue') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  )

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression
      if (ts.isPropertyAccessExpression(expr)) {
        const methodName = expr.name.text
        if (PRIMARY_LIFECYCLE_METHODS.has(methodName)) {
          // Check if caller is scene-like: this.scene.start, game.scene.stop, scene.start
          const target = expr.expression
          const targetText = target.getText(sourceFile)
          const isSceneCall =
            targetText === 'this.scene' ||
            targetText.endsWith('.scene') ||
            targetText === 'scene' ||
            targetText === 'this'

          if (isSceneCall) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            violations.push({
              file: filePath,
              line: line + 1,
              callText: node.getText(sourceFile),
            })
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

describe('Presentation Ownership AST Guard (Task 13)', () => {
  it('fixture test: detects direct scene.start outside allowlist', () => {
    const badCode = `
      export class RogueComponent {
        trigger() {
          this.scene.start('CombatScene')
        }
      }
    `
    const violations = checkSourceForLifecycleCalls(badCode, 'src/components/Rogue.ts')
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]!.callText).toContain("this.scene.start('CombatScene')")
  })

  it('fixture test: detects game.scene.stop outside allowlist', () => {
    const badCode = `
      function forceStop(game: any) {
        game.scene.stop('MainScene')
      }
    `
    const violations = checkSourceForLifecycleCalls(badCode, 'src/utils/bad.ts')
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]!.callText).toContain("game.scene.stop('MainScene')")
  })

  it('fixture test: allowlisted files pass without violation', () => {
    const goodCode = `
      this.game.scene.start(sceneKey, { transitionId })
    `
    const violations = checkSourceForLifecycleCalls(
      goodCode,
      'src/presentation/PhaserSceneAdapter.ts',
    )
    expect(ALLOWLISTED_FILES.has('src/presentation/PhaserSceneAdapter.ts')).toBe(true)
  })

  it(
    'scans all production source files and confirms zero unauthorized primary scene lifecycle calls',
    () => {
      const allFiles = collectSourceFiles(SRC_ROOT)
      const productionViolations: Violation[] = []

      for (const fullPath of allFiles) {
        const relativePath = fullPath
          .replace(GAME_ROOT, '')
          .replace(/^[\\/]/, '')
          .replace(/\\/g, '/')

        if (ALLOWLISTED_FILES.has(relativePath)) {
          continue
        }

        const content = readFileSync(fullPath, 'utf-8')
        const violations = checkSourceForLifecycleCalls(content, relativePath)
        productionViolations.push(...violations)
      }

      expect(
        productionViolations,
        `Found unauthorized primary scene lifecycle calls in production files: ${JSON.stringify(productionViolations, null, 2)}`,
      ).toEqual([])
    },
    30_000,
  )
})
