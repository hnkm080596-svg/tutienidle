/**
 * Combat-scheduler driver-seam guard (buff2 M4 cutover) -- the per-cycle
 * CombatScheduler is the live combat authority: constructed at the
 * composition root (GameManagerTurnBattleOps.mintCycleScheduler) and
 * injected into TurnBattleSystem, which drives it through the documented
 * op lanes and lifecycle roots.
 *
 * This guard greps production src/ for scheduler intake/driver calls
 * outside the sanctioned locations:
 * - the scheduler module itself (src/core/battle/runtime/scheduler/**)
 *   defines and self-uses these APIs;
 * - the construction sites may build + inject the instance
 *   (GameManagerTurnBattleOps.ts production, TurnRuntimeFixtures.ts the
 *   shared headless test runtime);
 * - SANCTIONED_DRIVERS may call intake APIs (TBS op lanes, the proc
 *   system's authored op queue, the test fixture's apply/lifecycle
 *   helpers). No OTHER production file may drive or re-mint the
 *   scheduler -- a new driver is a boundary violation.
 *
 * Patterns policed:
 * - combatScheduler.run( (including combatScheduler?.run() and the
 *   aliased form: a file that references combatScheduler AND calls any
 *   `.run(` is driving it through a local -- the only other `.run(`
 *   user, TurnPipeline step.run, never touches combatScheduler)
 * - .enqueueAuthored( / .enqueueEvent( / .createLifecycleSink( /
 *   .registerImmediateHandler( / .reserveOperationId( on any receiver
 *   (these names are unique to the scheduler surface)
 * - new CombatScheduler anywhere except the construction sites (a
 *   third construction site is also a violation)
 *
 * Test files are excluded automatically (listProductionTs skips
 * *.test.ts): test-scope drivers are sanctioned. TurnRuntimeFixtures.ts
 * is a test-support module that lives under src/, so it is allowlisted
 * explicitly.
 */
import { describe, expect, it } from 'vitest'
import { join, relative } from 'node:path'
import { listProductionTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const SRC_DIR = join(GAME_ROOT, 'src')

const SCHEDULER_MODULE_PREFIX = 'src/core/battle/runtime/scheduler/'

/** Files allowed to `new CombatScheduler`. The shared headless fixture
    mirrors the production mint so tests exercise the same wiring. */
const CONSTRUCTION_SITES = [
  'src/core/game/GameManagerTurnBattleOps.ts',
  'src/core/battle/turn/testing/TurnRuntimeFixtures.ts',
]

/** Files allowed to call scheduler intake/driver APIs (outside the
    scheduler module itself). Everything else stays hands-off. */
const SANCTIONED_DRIVERS = new Set([
  // TBS op lanes + lifecycle roots (emitAndSettle, applyBuffOp,
  // runBuffLifecycle, gauge staging).
  'src/core/battle/turn/TurnBattleSystem.ts',
  // Proc-authored ops (reactive procs enqueue follow-ups / resource
  // spends through the scheduler).
  'src/core/proc/CombatProcSystem.ts',
  // Shared headless test runtime (apply/lifecycle helpers drive the
  // same lanes production does).
  'src/core/battle/turn/testing/TurnRuntimeFixtures.ts',
])

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
    // The scheduler module owns its API surface; sanctioned drivers may
    // call intake APIs. Neither is scanned for call patterns.
    if (
      rel.startsWith(SCHEDULER_MODULE_PREFIX) ||
      CONSTRUCTION_SITES.includes(rel) ||
      SANCTIONED_DRIVERS.has(rel)
    ) {
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

describe('combat-scheduler driver seams (buff2 M4) -- only documented lanes drive the live scheduler', () => {
  const { offenders, constructionSites } = collectOffenders()

  it('schedulers are constructed only at the production mint + the shared test fixture (guard cannot silently pass on deleted wiring)', { timeout: SCAN_TIMEOUT }, () => {
    expect(constructionSites.sort()).toEqual([...CONSTRUCTION_SITES].sort())
  })

  it('no production file outside the scheduler module / sanctioned drivers drives or re-mints the scheduler', { timeout: SCAN_TIMEOUT }, () => {
    expect(
      offenders.map((o) => `${o.file}:${o.line} [${o.rule}] ${o.text}`),
    ).toEqual([])
  })
})
