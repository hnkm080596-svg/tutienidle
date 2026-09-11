/**
 * R14.1b guard (A6) — dependency direction for `src/core/**`.
 *
 * AGENTS.md A6: `foundation -> domain primitives -> mechanisms -> domain
 * systems -> orchestration -> presentation`; core gameplay stays
 * independent of Vue/Phaser and must never depend upward.
 *
 * R14 charter: a guard protects a real regression class. Real violation
 * found at guard-authoring time (2026-09-11):
 * `src/core/equipment/EquipmentNaming.ts` imported from
 * `@/composables/slots/normalizeSlotRank` (presentation layer). The pure
 * helpers live in `src/core/profession/slotRank.ts` after this guard's
 * fix; this test pins the boundary so the next upward import fails here,
 * not in review.
 */
import { describe, expect, it } from 'vitest'
import { join, relative, sep } from 'node:path'
import { listAllTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const CORE_DIR = join(GAME_ROOT, 'src', 'core')

/** Layer directories under src/ that core must never import upward into. */
const FORBIDDEN_LAYER_DIRS = [
  'presentation',
  'stores',
  'components',
  'composables',
  'layouts',
  'views',
] as const

/** Framework entry points core must not import (headless requirement). */
const FORBIDDEN_MODULES = ['vue', 'pinia', 'phaser'] as const

interface Violation {
  file: string
  specifier: string
  rule: string
}

/**
 * Extract import/re-export specifiers from source text: static
 * (`import ... from 'x'`, `export ... from 'x'`), side-effect
 * (`import 'x'`), type-only (`import type ... from 'x'`), and dynamic
 * (`import('x')`). Type-only imports are included deliberately: A6 forbids
 * even type-only upward coupling (a domain contract does not move under
 * presentation just because only types are needed).
 */
function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  const re = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) specifiers.push(m[1]!)
  const dyn = /import\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = dyn.exec(source)) !== null) specifiers.push(m[1]!)
  return specifiers
}

function resolveSpecifierToSrcPath(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith('@/')) return join('src', specifier.slice(2))
  // Relative imports resolve against the IMPORTING FILE's directory
  // (not the core root): `../presentation/X` from core/game/ is
  // core/presentation/X — still inside core, hence legal.
  if (specifier.startsWith('.')) {
    const abs = join(fromFile, '..', specifier)
    const rel = relative(GAME_ROOT, abs)
    return rel.startsWith('..') ? null : rel.replaceAll('/', sep)
  }
  return null
}

function checkFile(path: string): Violation[] {
  const violations: Violation[] = []
  const source = readTs(path)
  for (const spec of extractImportSpecifiers(source)) {
    // 1. Framework modules (exact module id; @vue/* submodules are
    // handled by the layer check only if they resolve into src/, which
    // they never do — npm packages stay outside src/).
    if ((FORBIDDEN_MODULES as readonly string[]).includes(spec)) {
      violations.push({ file: path, specifier: spec, rule: 'A6-framework' })
      continue
    }
    // 2. Upward layer imports via alias or relative escape.
    const target = resolveSpecifierToSrcPath(spec, path)
    if (!target) continue
    const normalized = target.replaceAll(sep, '/')
    const layerHit = FORBIDDEN_LAYER_DIRS.find(
      (layer) => normalized.startsWith(`src/${layer}/`),
    )
    if (layerHit) {
      violations.push({ file: path, specifier: spec, rule: `A6-layer:${layerHit}` })
    }
  }
  return violations
}

describe('R14.1b — A6: core never imports presentation/framework upward', () => {
  // A6 targets PRODUCTION core: the headless, framework-free invariant.
  // Core *.test.ts files may mount the real composition root (Pinia stores,
  // vue) to characterize behavior through production wiring (A12) — e.g.
  // TribulationOutcomeService.test.ts needs the real player store because
  // writing absent optional keys on store.$state does not reflect (probe
  // evidence 2026-09-11). Exempt tests explicitly, production stays strict.
  const files = listAllTs(CORE_DIR).filter((f) => !f.endsWith('.test.ts'))

  it('runs over a real corpus (guard must not silently pass on empty input)', { timeout: SCAN_TIMEOUT }, () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('every core PRODUCTION import points downward or sideways', { timeout: SCAN_TIMEOUT }, () => {
    const violations: Violation[] = []
    for (const file of files) {
      violations.push(...checkFile(file))
    }
    expect(
      violations,
      violations.map((v) => `${relative(GAME_ROOT, v.file)} -> ${v.specifier} [${v.rule}]`).join('\n'),
    ).toEqual([])
  })
})
