// Guard for V7 of the frontend static/dynamic boundary spec
// (docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md).
//
// Grid projection is a PRESENTATION asset, not a Phaser one (spec §2.2): the
// canvas draws with it and the DOM must hit-test with it, so it cannot live
// under src/game/ without the static layer reaching into the dynamic one.
//
// Placement note: the spec puts guards in game/tests/architecture/, alongside
// r14's. That directory — and the vitest `include` that picks it up — arrive
// with the r14-architecture-enforcement branch. Until that merges, this guard
// lives beside the code it protects so that it actually runs. Move it, and
// adopt r14's helpers/scanTs.ts in place of the local walk below, once r14 is
// on master.
//
// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readdirSync, readFileSync, statSync } from 'node:fs'
// @ts-expect-error see above
import { join, relative } from 'node:path'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// From src/presentation/geometry/ up two levels is src/ itself.
const srcRoot = fileURLToPath(new URL('../../', import.meta.url))

const GAME_DIR = join(srcRoot, 'game')
const GEOMETRY_DIR = join(srcRoot, 'presentation', 'geometry')

/** Every .ts/.vue file under `dir`, absolute. */
function listSourceFiles(dir: string): string[] {
  const out: string[] = []

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full))
      continue
    }

    if (entry.endsWith('.ts') || entry.endsWith('.vue')) {
      out.push(full)
    }
  }

  return out
}

/** Reported paths stay relative to src/ so a failure message is readable. */
function fromSrc(file: string): string {
  return relative(srcRoot, file).split('\\').join('/')
}

const allFiles = listSourceFiles(srcRoot)
const gameFiles = allFiles.filter((file: string) => file.startsWith(GAME_DIR))

function read(file: string): string {
  return readFileSync(file, 'utf8')
}

describe('projection lives in presentation/geometry', () => {
  it('no module under src/game/ defines a grid projection', () => {
    // A definition, not a use: a class implementing the interface, the factory,
    // or the interface itself. Renaming the class alone is still caught by the
    // factory clause, and vice versa.
    const definesProjection =
      /(?:class\s+\w*GridProjection\b|export\s+function\s+createBattleGridProjection\b|export\s+interface\s+BattleGridProjection\b)/

    const offenders = gameFiles.filter((file: string) => definesProjection.test(read(file)))

    expect(offenders.map(fromSrc)).toEqual([])
  })

  it('the projection modules are exactly where the spec puts them', () => {
    const homes = allFiles.filter(
      (file: string) =>
        /(?:BattleGridProjection|BattlefieldRenderMode)\.ts$/.test(file) &&
        !file.endsWith('.test.ts'),
    )

    expect(homes.map(fromSrc).sort()).toEqual([
      'presentation/geometry/BattleGridProjection.ts',
      'presentation/geometry/BattlefieldRenderMode.ts',
    ])
  })

  it('nothing still imports the projection from its old home', () => {
    const stale =
      /from\s+'(?:@\/game\/support|\.{1,2}(?:\/[\w.-]+)*)\/(?:BattleGridProjection|BattlefieldRenderMode)'/

    const offenders = allFiles
      .filter((file: string) => !file.startsWith(GEOMETRY_DIR))
      .filter((file: string) => stale.test(read(file)))

    expect(offenders.map(fromSrc)).toEqual([])
  })
})
