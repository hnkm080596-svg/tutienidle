/**
 * P2 (canonical build composition) guard - GameManagerTurnBattleOps
 * consumes ONE resolved build; player-side recomposition (stat assembly,
 * kit resolution, formation, companion minting, path-runtime dispatch)
 * must not creep back into the orchestrator. Those seams live in
 * core/game/CombatBuild.ts, the single composition site.
 *
 * The `resolvePathRuntime` dep stays: it is the sanctioned
 * setPathRuntimeResolver override seam and carries the dormant
 * revive/regrant read. The free `resolveCultivationPathRuntime` import is
 * banned - ops never dispatches on the registry itself.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs } from './helpers/scanTs'

const OPS = join(process.cwd(), 'src/core/game/GameManagerTurnBattleOps.ts')

const BANNED_IDENTIFIERS = [
  'resolveCultivationPathRuntime',
  'resolvePartyFormation',
  'COMPANIONS',
  'companionToCombatEntity',
  'resolveCompanionSkillKit',
  'TRAN_PHAP_FORMATIONS',
  'aggregateNodeStatModifiers',
  'resolvePlayerFinalStats',
  'playerToCombatEntity',
] as const

describe('build composition boundary — no player-side recomposition in ops', () => {
  const source = readTs(OPS)

  for (const identifier of BANNED_IDENTIFIERS) {
    it(`references no ${identifier}`, () => {
      const hits = source.match(new RegExp(`\\b${identifier}\\b`, 'g')) ?? []
      expect(hits).toEqual([])
    })
  }

  it('resolves through the single resolveCombatBuild dep', () => {
    expect(source.match(/\bresolveCombatBuild\b/g)?.length ?? 0).toBeGreaterThan(0)
  })
})
