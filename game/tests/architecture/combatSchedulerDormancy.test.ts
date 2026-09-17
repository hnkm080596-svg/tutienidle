/**
 * Combat-contract dormancy guard (M4; P5 T4) -- the per-cycle
 * CombatScheduler is CONSTRUCTED at the composition root
 * (GameManagerTurnBattleOps.mintCycleScheduler) and injected into
 * TurnBattleSystem as a dormant diagnostic surface, but NO production
 * code may drive it until the buff/skill cutover lands.
 *
 * This guard greps production src/ for scheduler intake/driver calls
 * outside the two sanctioned locations:
 * - the scheduler module itself (src/core/battle/runtime/scheduler/**)
 *   defines and self-uses these APIs;
 * - the construction site (GameManagerTurnBattleOps.ts) may construct
 *   and inject the instance (it makes no API calls today).
 *
 * Patterns policed:
 * - combatScheduler.run( (including combatScheduler?.run() and the
 *   aliased form: a file that references combatScheduler AND calls any
 *   `.run(` is driving it through a local -- the only other `.run(`
 *   user, TurnPipeline step.run, never touches combatScheduler)
 * - .enqueueAuthored( / .enqueueEvent( / .createLifecycleSink( /
 *   .registerImmediateHandler( / .reserveOperationId( on any receiver
 *   (these names are unique to the scheduler surface)
 * - new CombatScheduler anywhere except the construction site (a
 *   second construction site is also a dormancy violation)
 *
 * Test files are excluded automatically (listProductionTs skips
 * *.test.ts): the wiring test in GameManager.battleCycle.test.ts is
 * the one sanctioned driver.
 */
import { describe, expect, it } from 'vitest'
import { join, relative } from 'node:path'
import { listProductionTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')

const SCHEDULER_MODULE_PREFIX = 'src/core/battle/runtime/scheduler/'
const CONSTRUCTION_SITE = 'src/core/game/GameManagerTurnBattleOps.ts'

// Receiver-explicit drive: `combatScheduler.run(` / `combatScheduler?.run(`.
const SCHEDULER_RUN_RE = /\bcombatScheduler\s*(?:\?\s*)?\.\s*run\s*\(/
// Scheduler-unique intake APIs on ANY receiver.
const INTAKE_API_RE =
  /\.(enqueueAuthored|enqueueEvent|createLifecycleSink|registerImmediateHandler|reserveOperationId)\s*\(/
const ANY_RUN_RE = /\.run\s*\(/
const CONSTRUCT_RE = /\bnew\s+CombatScheduler\b/
const REFERENCES_SCHEDULER_RE = /\bcombatScheduler\b/

interface Offender {
  file: string
  line: number
  text: string
  rule: string
}

/**
 * Comment-blind scan (same discipline as combatContract.test.ts): the
 * guard polices calls, not prose. Block comments are blanked in place
 * (newlines preserved) so reported line numbers stay true; the `(^|[^:])`
 * line-comment form keeps `https://`-style text intact.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function collectOffenders(): { offenders: Offender[]; constructionSites: string[] } {
  const offenders: Offender[] = []
  const constructionSites: string[] = []
  for (const file of listProductionTs(SRC_DIR)) {
    const rel = relative(GAME_ROOT, file).replaceAll('\\', '/')
    const text = readTs(file)
    if (CONSTRUCT_RE.test(text)) constructionSites.push(rel)
    // The scheduler module owns its API surface; the construction site
    // may build + inject. Neither is scanned for call patterns.
    if (rel.startsWith(SCHEDULER_MODULE_PREFIX) || rel === CONSTRUCTION_SITE) {
      continue
    }
    const referencesScheduler = REFERENCES_SCHEDULER_RE.test(text)
    const lines = stripComments(text).split('\n')
    lines.forEach((line, idx) => {
      if (CONSTRUCT_RE.test(line)) {
        offenders.push({ file: rel, line: idx + 1, text: line.trim(), rule: 'new CombatScheduler outside construction site' })
        return
      }
      if (SCHEDULER_RUN_RE.test(line)) {
        offenders.push({ file: rel, line: idx + 1, text: line.trim(), rule: 'combatScheduler.run(' })
        return
      }
      if (INTAKE_API_RE.test(line)) {
        offenders.push({ file: rel, line: idx + 1, text: line.trim(), rule: 'scheduler intake API' })
        return
      }
      // Aliased drive: the file references combatScheduler and calls
      // `.run(` on something -- treat as scheduler drive (TurnPipeline's
      // step.run never co-occurs with a combatScheduler reference).
      if (referencesScheduler && ANY_RUN_RE.test(line)) {
        offenders.push({ file: rel, line: idx + 1, text: line.trim(), rule: 'aliased scheduler .run(' })
      }
    })
  }
  return { offenders, constructionSites }
}

describe('combat-contract M4 -- CombatScheduler stays dormant outside its module + construction site (P5 T4)', () => {
  const { offenders, constructionSites } = collectOffenders()

  it('the composition root still constructs exactly one scheduler (guard cannot silently pass on deleted wiring)', { timeout: SCAN_TIMEOUT }, () => {
    expect(constructionSites).toEqual([CONSTRUCTION_SITE])
  })

  it('no production file outside the scheduler module / construction site drives or re-mints the scheduler', { timeout: SCAN_TIMEOUT }, () => {
    expect(
      offenders.map((o) => `${o.file}:${o.line} [${o.rule}] ${o.text}`),
    ).toEqual([])
  })
})
