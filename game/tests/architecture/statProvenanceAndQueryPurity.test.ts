/**
 * R14.3 guard (R2/AR-02+AR-05 and R8.1/AR-09) — stat provenance and quest
 * query purity.
 *
 * R2 contract (2026-09-08): `entity.baseStats` is the RESOLVED base stats
 * contract, written once by the battle adapter from the canonical
 * calculator. Post-hoc assignment elsewhere reintroduces AR-02 (resolve
 * then re-derive: 10 -> 70 -> 130). Evidence at guard-authoring time: ZERO
 * production `.baseStats =` assignment sites (only test fixtures).
 *
 * R8.1 contract (2026-09-08): `getActiveQuests` is a pure read; activation
 * belongs to the `reconcileActiveQuests` lifecycle command. Mission 0
 * AR-09: quest activation used to live inside the panel read, making
 * gameplay progress depend on opening QuestPanel. The behavioral test
 * lives in QuestSystem.lifecycle.test.ts; this guard pins the source so
 * re-coupling query -> activation fails the suite even if the behavioral
 * fixture is later weakened.
 */
import { describe, expect, it } from 'vitest'
import { join, relative } from 'node:path'
import { listProductionTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

describe('R14.3a — R2: baseStats is written only at battle-adapter construction', () => {
  it('no production source in src/ assigns .baseStats after creation', { timeout: SCAN_TIMEOUT }, () => {
    const offenders: string[] = []
    for (const file of listProductionTs(join(GAME_ROOT, 'src'))) {
      const rel = relative(GAME_ROOT, file)
      const source = readTs(file)
      const re = /\.baseStats\s*[+\-*/]?=(?!=)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(source)) !== null) offenders.push(`${rel}@char ${m.index}`)
    }
    expect(
      offenders,
      'post-creation baseStats writes must go through the stat authority (R2/AR-02). Evidence at guard-authoring time: zero production writers.',
    ).toEqual([])
  })
})

describe('R14.3c — R2 type level: raw base stats are nominally branded', () => {
  const STAT_BLOCK = join(GAME_ROOT, 'src/core/stats/StatBlock.ts')
  const STAT_CALCULATOR = join(GAME_ROOT, 'src/core/stats/StatCalculator.ts')
  const PLAYER = join(GAME_ROOT, 'src/core/player/Player.ts')

  it('BaseStats is a branded Stats subtype produced only by createBaseStats/asBaseStats', () => {
    const source = readTs(STAT_BLOCK)
    expect(source).toMatch(/declare const baseStatsBrand: unique symbol/)
    expect(source).toMatch(/export type BaseStats = Stats & \{ readonly \[baseStatsBrand\]: 'base' \}/)
    expect(source).toMatch(/export function createBaseStats\([^)]*\): BaseStats/)
    expect(source).toMatch(/export function asBaseStats\(stats: Stats\): BaseStats/)
  })

  it('the derivation pipeline accepts only the branded raw input', () => {
    const source = readTs(STAT_CALCULATOR)
    // Resolved Stats values (entity.stats, entity.baseStats — the resolved
    // at-entry snapshot) must NOT be passable here: feeding a derived
    // snapshot back into calculateStats re-derives attribute bonuses
    // (R2 audit: 10 -> 70 -> 130). The brand makes that a compile error.
    expect(source).toMatch(/export function calculateStats\(baseStats: BaseStats,/)
  })

  it('PlayerData.baseStats carries the brand (canonical raw source)', () => {
    const source = readTs(PLAYER)
    expect(source).toMatch(/\bbaseStats: BaseStats\b/)
  })
})

describe('R14.3b — R8.1/AR-09: quest queries never activate', () => {
  const QUEST_SYSTEM = join(GAME_ROOT, 'src/core/quest/QuestSystem.ts')

  // Strip comments before scanning: a mention of the command in a COMMENT
  // is documentation, not an activation call. Only live code counts.
  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
  }

  // Extract the getActiveQuests method body from QuestSystem.ts source.
  function getActiveQuestsBody(): string {
    const source = stripComments(readTs(QUEST_SYSTEM))
    const start = source.indexOf('getActiveQuests(')
    expect(start, 'QuestSystem.getActiveQuests must exist').toBeGreaterThanOrEqual(0)
    // Brace-match from the first `{` after the signature.
    const open = source.indexOf('{', start)
    let depth = 0
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++
      if (source[i] === '}') {
        depth--
        if (depth === 0) return source.slice(start, i)
      }
    }
    throw new Error('unbalanced braces scanning getActiveQuests body')
  }

  it('getActiveQuests body contains no activation/lifecycle command', () => {
    const body = getActiveQuestsBody()
    const forbidden = [/reconcileActiveQuests/, /activateQuest/, /activeQuestIds?\s*[+\-*/]?=/]
    const hits = forbidden
      .map((re) => (re.test(body) ? re.source : null))
      .filter((s): s is string => s !== null)
    expect(hits, 'query must stay observational (AR-09 regression class)').toEqual([])
  })

  it('the lifecycle command reconcileActiveQuests exists as the activation owner', () => {
    expect(readTs(QUEST_SYSTEM)).toMatch(/reconcileActiveQuests\(/)
  })
})
