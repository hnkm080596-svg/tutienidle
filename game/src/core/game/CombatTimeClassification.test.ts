import { describe, expect, it } from 'vitest'
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readFileSync } from 'node:fs'

/**
 * Every time-dependent combat field belongs to exactly one authority. This
 * test is the enforcement: it fails when a new seconds-valued or delta-driven
 * path appears in the combat engine without a classification.
 */
describe('combat time classification', () => {
  it('no combat engine file consumes deltaSeconds', () => {
    // Real, unrelated code/prose uses the English word "delta" as a domain
    // term that has nothing to do with world time (e.g. "gauge-delta effect"
    // in TurnBattleSystem.ts's comments, describing a one-shot gauge push).
    // A bare `/\bdelta\b/` would flag those and turn this into a test that
    // polices comment wording rather than the actual classification. Comment
    // lines are excluded (matching the filter test 5 below already uses) so
    // the assertion is about code: an actual `deltaSeconds` identifier, or a
    // `dt`/`delta` parameter or variable a combat-engine function consumes.
    const files = [
      'src/core/battle/turn/TurnBattleSystem.ts',
      'src/core/battle/turn/TurnSkillAction.ts',
      'src/core/battle/turn/ActionGauge.ts',
    ]

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const offenders = source
        .split('\n')
        .filter((line: string) => {
          const trimmed = line.trimStart()
          if (trimmed.startsWith('*') || trimmed.startsWith('//')) {
            return false
          }
          return /deltaSeconds|\bdt\b|\bdelta\b/i.test(line)
        })

      expect(offenders, `${file} must not consume world deltaSeconds`).toEqual([])
    }
  })

  it('the world tick no longer drives the turn battle', () => {
    // The brief's original version located the method body by searching for
    // the next `private stepTurnBattle` declaration after
    // `updateBattleFixedStep` textually. In the shipped file, `stepTurnBattle`
    // is declared BEFORE `updateBattleFixedStep` (Task 6 split combat-driving
    // into its own method, driven by CombatClock, well ahead of the leftover
    // world-tick method), so that search landed past end-of-file and the test
    // passed only because nothing after `updateBattleFixedStep` happens to
    // mention the tick* methods elsewhere in the file - an accident of
    // ordering, not a scoped check of the method's own body. A rename or a
    // reorder would silently stop this test from checking anything real.
    // Extracting the actual method body by brace-depth makes the check scoped
    // and robust to reordering.
    const source = readFileSync('src/core/game/GameManagerTurnBattleOps.ts', 'utf8')
    // Match the real declaration, not a prose mention of the method name in a
    // comment elsewhere in the file (there is one, at the time of writing,
    // describing where this method's combat-driving work used to live).
    const signatureIndex = source.search(/\n {2}updateBattleFixedStep\(/)
    expect(signatureIndex, 'updateBattleFixedStep must exist').toBeGreaterThanOrEqual(0)

    const bodyStart = source.indexOf('{', signatureIndex)
    expect(bodyStart, 'updateBattleFixedStep must have a body').toBeGreaterThanOrEqual(0)

    let depth = 0
    let bodyEnd = bodyStart
    for (let i = bodyStart; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1
      if (source[i] === '}') {
        depth -= 1
        if (depth === 0) {
          bodyEnd = i
          break
        }
      }
    }

    const methodBody = source.slice(bodyStart, bodyEnd + 1)
    expect(methodBody).not.toMatch(/tickPacing|tickIntro|tickCountdown/)
  })

  it('no freeze is implemented by pausing the Phaser scene', () => {
    const files = [
      'src/game/scenes/CombatScene.ts',
      'src/components/game/PhaserCanvas.vue',
      'src/composables/useCombatPause.ts',
      'src/core/game/GameManagerTurnBattleOps.ts',
    ]

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${file} must not pause the scene to express a freeze`)
        .not.toMatch(/scene\.pause\(|anims\.pauseAll\(|anims\.paused\s*=/)
    }
  })

  it('the turn-in-flight predicate is the token state, not a mirrored flag', () => {
    // The brief cited CombatAnimationRuntime.ts, but isTurnInFlight() is
    // declared on GameManagerTurnBattleOps (and re-exposed by GameManager) -
    // verified by grep, 0 hits for that name in CombatAnimationRuntime.ts.
    // Citing the wrong file makes the string search find nothing and the
    // regex match an empty string, which fails for the wrong reason (missing
    // symbol) rather than the right one (a mirrored flag instead of
    // token.getState()).
    const source = readFileSync('src/core/game/GameManagerTurnBattleOps.ts', 'utf8')
    const fnStart = source.indexOf('isTurnInFlight(): boolean {')
    expect(fnStart, 'isTurnInFlight must exist on GameManagerTurnBattleOps').toBeGreaterThanOrEqual(0)
    const fnEnd = source.indexOf('\n  }', fnStart)

    expect(source.slice(fnStart, fnEnd)).toMatch(/turnToken\.getState\(\)/)
  })

  it('the countdown display is the only combat surface expressing seconds', () => {
    const files = [
      'src/core/battle/turn/TurnBattleSystem.ts',
      'src/core/battle/turn/TurnSkillAction.ts',
      'src/core/battle/turn/ActionGauge.ts',
      'src/core/battle/turn/TurnBuffSystem.ts',
    ]

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const offenders = source
        .split('\n')
        .filter((line: string) => {
          const trimmed = line.trimStart()
          if (trimmed.startsWith('*') || trimmed.startsWith('//')) {
            return false
          }
          // Case-insensitive substring match (not \b-bounded): the violation
          // this guards against is exactly a camelCase field name like
          // `remainingCooldownSeconds` or `perfectClearSeconds` sneaking into
          // the turn domain, and a word-boundary-anchored `\bSeconds\b` does
          // NOT match "Seconds" in the middle of a camelCase identifier (no
          // boundary between "n" and "S" in "durationSeconds") - verified by
          // injecting exactly that identifier and confirming a bounded regex
          // let it through.
          return /seconds/i.test(line)
        })

      expect(offenders, `${file} must express combat durations in steps, not seconds`)
        .toEqual([])
    }
  })
})
