import { describe, expect, it } from 'vitest'
import { join, relative, sep } from 'node:path'

import { listProductionTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

// ---------------------------------------------------------------------------
// skilldef M5 (INV-S2) -- fail-closed producer-source discovery.
//
// Every TurnSkillDefinition literal carries the required `cooldownTurns`
// field, so a filesystem scan for `cooldownTurns:` catches every file that
// can CONSTRUCT a def. Any matching file under src/ must either be a
// src/data/** module (reached by the LegacySkillCoverage deep-walk) or a
// declared producer file below -- a NEW producer file fails this guard
// until a census leg covers its output and the file is registered here.
//
// Companion gate: src/core/skilldef/LegacySkillCoverage.test.ts owns the
// runtime census (data deep-walk, authored sweep, runtime-seam fixtures,
// provider/combo emissions, companion kits, engine fallback).
// ---------------------------------------------------------------------------

const GAME_ROOT = process.cwd()
const SRC_ROOT = join(GAME_ROOT, 'src')

// Non-data src files allowed to contain `cooldownTurns:` -- def
// construction sites, the contract declaration itself, and files that
// only read or document the field. Each entry names the census leg or
// the reason the file is not a producer.
const NON_DATA_DEF_SOURCE_FILES: Record<string, string> = {
  'core/battle/turn/TurnSkillAction.ts': 'contract declaration + engine fallback leg (selectAction -> basic_attack)',
  'core/kiem-tu/KiemPhoProvider.ts': 'kiem_tu:hien runtime leg (combo extras via onCastResolved)',
  'core/player/CultivationPathRegistry.ts': 'runtime-seam leg (resolveAuthoredBasic forced fields)',
  'core/skilldef/LegacySkillAdapter.ts': 'the adapter itself -- field-map comments + reads, not a producer',
  'core/skilldef/ResolvedSkillPlan.ts': 'plan IR field references, not a producer',
  'core/skilldef/SkillDefinition.ts': 'canonical IR contract (SkillDefinition.cooldownTurns), not a producer',
  'core/skilldef/SkillExecutor.testkit.ts': 'testkit only -- never a production producer',
}

describe('skilldef producer sources (INV-S2 fail-closed discovery)', () => {
  it(
    'every non-test src file constructing defs is walked data or a declared producer',
    () => {
      const failures: string[] = []

      for (const file of listProductionTs(SRC_ROOT)) {
        const text = readTs(file)
        if (!/cooldownTurns\s*:/.test(text)) continue

        const fromSrc = relative(SRC_ROOT, file).split(sep).join('/')
        if (fromSrc.startsWith('data/')) continue
        if (NON_DATA_DEF_SOURCE_FILES[fromSrc] !== undefined) continue

        failures.push(
          `${fromSrc} contains \`cooldownTurns:\` but is not a declared ` +
            `producer -- add a LegacySkillCoverage census leg and register ` +
            `the file in NON_DATA_DEF_SOURCE_FILES`,
        )
      }

      expect(failures, `undeclared def producers:\n${failures.join('\n')}`).toEqual([])
    },
    SCAN_TIMEOUT,
  )

  it('every declared producer file still exists and still carries the marker', () => {
    // Stale manifest entries silently weaken the boundary: a renamed or
    // refactored producer file must update its registration, not leave a
    // dead entry behind.
    const failures: string[] = []

    for (const fromSrc of Object.keys(NON_DATA_DEF_SOURCE_FILES)) {
      const file = join(SRC_ROOT, fromSrc)
      let text: string
      try {
        text = readTs(file)
      } catch {
        failures.push(`${fromSrc} is declared but no longer exists -- remove or fix the manifest entry`)
        continue
      }
      if (!/cooldownTurns\s*:/.test(text)) {
        failures.push(`${fromSrc} is declared but no longer carries \`cooldownTurns:\` -- stale manifest entry`)
      }
    }

    expect(failures, `stale producer manifest entries:\n${failures.join('\n')}`).toEqual([])
  })
})
