/**
 * M-F-CEILING (C2C-9) caller census - tribulation admission has exactly
 * ONE funnel: every production flow that starts a run must reach
 * TribulationDirector.start, because that is where the release-policy
 * transition gate lives. An alternate init/advance entry point would
 * silently bypass release policy and let a closed transition run.
 *
 * Pinned here as executable census, not prose:
 * - `new TribulationDirector(` may only appear in GameManager.ts (the
 *   director instance the whole game funnels through).
 * - `tribulationDirector.start(` / `director.start(` may only appear in
 *   GameManager.ts (inside startTribulation).
 * - TribulationOutcomeService.startTribulationPrepared must delegate to
 *   gameManager.startTribulation - it is a PREP wrapper, never a second
 *   admission.
 * Test files are excluded: rigging a director in a test is fine.
 */
import { describe, expect, it } from 'vitest'
import { join, relative, sep } from 'node:path'
import { listProductionTs, listVue, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const SRC = join(GAME_ROOT, 'src')
const GAME_MANAGER_FILE = 'src/core/game/GameManager.ts'
const OUTCOME_SERVICE_FILE = 'src/core/tribulation/TribulationOutcomeService.ts'

function uncommented(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/\/\/[^\n]*/g, '')
}

function rel(file: string): string {
  return relative(GAME_ROOT, file).split(sep).join('/')
}

describe('M-F-CEILING - tribulation admission funnel census', { timeout: SCAN_TIMEOUT }, () => {
  const productionFiles = [...listProductionTs(SRC), ...listVue(SRC)]

  it('TribulationDirector is constructed only inside GameManager.ts', () => {
    const offenders = productionFiles.filter(
      (file) => rel(file) !== GAME_MANAGER_FILE && /new\s+TribulationDirector\s*\(/.test(uncommented(readTs(file))),
    )

    expect(
      offenders.map(rel),
      'alternate TribulationDirector construction would bypass the release-policy admission gate',
    ).toEqual([])
  })

  it('director.start is invoked only inside GameManager.startTribulation', () => {
    const offenders = productionFiles.filter(
      (file) =>
        rel(file) !== GAME_MANAGER_FILE &&
        /\b(?:tribulationDirector|director)\.start\s*\(/.test(uncommented(readTs(file))),
    )

    expect(
      offenders.map(rel),
      'an alternate director.start() call site bypasses the release-policy transition check',
    ).toEqual([])
  })

  it('GameManager.startTribulation remains the single admission body calling director.start', () => {
    const source = uncommented(readTs(join(GAME_ROOT, GAME_MANAGER_FILE)))

    expect(source.match(/\btribulationDirector\.start\s*\(/g)?.length ?? 0).toBe(1)
  })

  it('startTribulationPrepared delegates to gameManager.startTribulation (prep, never a second admission)', () => {
    const source = uncommented(readTs(join(GAME_ROOT, OUTCOME_SERVICE_FILE)))

    expect(
      /gameManager\.startTribulation\s*\(/.test(source),
      'TribulationOutcomeService must stay a delegation wrapper so admission keeps hitting the policy gate',
    ).toBe(true)
  })
})
