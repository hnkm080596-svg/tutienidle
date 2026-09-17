/**
 * E2 source guard (Mission D/E/F audit, 2026-09-19) - tribulation query
 * surfaces are observational. The defect class: `getState()` used to
 * write `this.active.hp = snapshotHp` before detaching, so a READ API
 * mutated domain state - the same query-writes pattern the A3 sweeps
 * removed elsewhere.
 *
 * Behavioral coverage lives in TribulationDirector.test.ts (snapshot
 * detachment). This static guard pins the method bodies themselves:
 * getState / getPresentationSnapshot must not assign into this.active,
 * and the shared snapshotActiveState() builder must exist so both
 * surfaces detach through ONE path.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs } from './helpers/scanTs'

const DIRECTOR = join(process.cwd(), 'src', 'core', 'tribulation', 'TribulationDirector.ts')

function uncommented(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Brace-matched method body from `name(` to the closing `}`. */
function methodBody(source: string, name: string): string {
  const start = source.indexOf(`${name}(`)
  expect(start, `TribulationDirector.${name} must exist`).toBeGreaterThanOrEqual(0)
  // The opening brace is the last `{` on the declaration line - generic
  // return-type literals (`{ x: T } | null`) contain braces mid-line.
  const lineEnd = source.indexOf('\n', start)
  let open = source.lastIndexOf('{', lineEnd)
  expect(open, `${name} has no opening brace on its declaration line`).toBeGreaterThan(start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(start, i)
    }
  }
  throw new Error(`unbalanced braces scanning ${name} body`)
}

describe('E2 - tribulation queries stay observational', () => {
  const source = uncommented(readTs(DIRECTOR))

  it('getState body contains no write into this.active', () => {
    const body = methodBody(source, 'getState')
    expect(body).not.toMatch(/this\.active[.\w]*\s*[+\-*/]?=/)
  })

  it('getPresentationSnapshot body contains no write into this.active', () => {
    const body = methodBody(source, 'getPresentationSnapshot')
    expect(body).not.toMatch(/this\.active[.\w]*\s*[+\-*/]?=/)
  })

  it('both queries detach through the shared snapshotActiveState builder', () => {
    expect(source).toMatch(/private snapshotActiveState\(\)/)
    expect(methodBody(source, 'getState')).toMatch(/snapshotActiveState\(\)/)
    expect(methodBody(source, 'getPresentationSnapshot')).toMatch(/snapshotActiveState\(\)/)
  })
})
