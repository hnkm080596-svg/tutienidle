/**
 * Mission C Task 9 guard (spec C4, audit T5-44) — the battle orchestrator
 * never dispatches on cultivation-path identity. All path predicates and
 * path-module imports funnel through the CultivationPathRuntime boundary
 * (core/player/CultivationPathRegistry is the single dispatch site, per
 * the cultivationPathIsolation authority rule).
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs } from './helpers/scanTs'

const OPS = join(process.cwd(), 'src/core/game/GameManagerTurnBattleOps.ts')

describe('battle lifecycle boundary — no path dispatch in GameManagerTurnBattleOps', () => {
  const source = readTs(OPS)

  it('imports nothing from the path modules', () => {
    const pathModuleImports = source.match(/from\s+['"][^'"]*(kiem-tu|phap-tu|the-tu)\/[^'"]*['"]/g) ?? []
    expect(pathModuleImports).toEqual([])
  })

  it('references no path-identity predicate', () => {
    const predicates = source.match(/\bisKiemTu\w*|\bisPhapTu\w*|\bisTheTu\w*|\bisUngThe\w*/g) ?? []
    expect(predicates).toEqual([])
  })
})
