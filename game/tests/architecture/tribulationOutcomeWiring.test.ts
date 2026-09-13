/**
 * F1 (2026-09-13 whole-codebase audit) wiring guard — the tribulation
 * outcome check in App.vue's tick() must pass the `presentation` object so
 * the behind-curtain `request({ target: 'home' })` branch can run.
 *
 * Root cause of the defect: App.vue called
 * `checkTribulationOutcomeAction(player, gameManager)` without the third
 * argument, so a completed tribulation applied its outcome but never
 * issued the coordinator route request — the UI soft-locked on the
 * 'tribulation' route (home chrome hidden, empty overlay, Phaser scene
 * never deactivated) until reload.
 *
 * Behavioral coverage lives in src/presentation/tribulationRouting.test.ts
 * (the production-signature case drives the full coordinator dance). This
 * STATIC guard pins the call-site shape itself: a regex over the
 * comment-stripped App.vue source asserting the call passes a third
 * argument — the cheap guard that would have caught the regression at
 * authoring time.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const APP_FILE = join(GAME_ROOT, 'src/App.vue')

/** Strip line + block comments so commented-out calls can't trip the scan. */
function uncommented(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/\/\/[^\n]*/g, '')
}

describe('F1 — tribulation outcome check is wired through the presentation coordinator', () => {
  const appSource = uncommented(readTs(APP_FILE))

  it('App.vue calls checkTribulationOutcomeAction with the presentation argument', () => {
    const calls = [...appSource.matchAll(/checkTribulationOutcomeAction\(([^)]*)\)/g)]

    expect(
      calls.length,
      'App.vue must call checkTribulationOutcomeAction from its tick loop',
    ).toBeGreaterThanOrEqual(1)

    for (const call of calls) {
      const args = call[1]!
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0)

      expect(
        args.length,
        `checkTribulationOutcomeAction(${call[1]}) drops the presentation argument — ` +
          "without it the outcome never issues request({ target: 'home' }) and the " +
          'route soft-locks on tribulation',
      ).toBeGreaterThanOrEqual(3)
      expect(
        args[2],
        'the third argument must be the presentation object created in App.vue setup',
      ).toBe('presentation')
    }
  })

  it('the 2-argument call (the exact F1 defect shape) is absent', () => {
    expect(
      /checkTribulationOutcomeAction\(\s*player\s*,\s*gameManager\s*\)/.test(appSource),
      'checkTribulationOutcomeAction(player, gameManager) is the F1 defect — it must not reappear',
    ).toBe(false)
  })
})
