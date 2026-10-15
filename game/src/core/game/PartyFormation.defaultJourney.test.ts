// R1 regression pin (2026-10-15): couples DEFAULT_PARTY_FORMATION (and
// DEFAULT_PLAYER_STANDING_POSITION = row 5, col 2) with the real
// standing-slot resolver and real shipped stages so a formation/target-
// priority change cannot silently wall the canonical early-game loop at
// mortal_dong_9.
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { localCellToAbsolute, resolvePartyFormation } from './FormationPlacement'
import { DEFAULT_PLAYER_STANDING_POSITION } from '../battle/BattlefieldRegions'
import { EarlyGameSession } from '../simulation/earlygame/EarlyGameSession'
import { CANONICAL_EARLY_LOOP, runLoop } from '../simulation/earlygame/EarlyGameLoop'

const PINNED_PROFILE = {
  name: 'default-formation-journey-pin',
  talentIds: ['hap_linh'],
}

describe('PartyFormation default standing position -> canonical mortal journey pin (R1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('resolves DEFAULT_PARTY_FORMATION to the canonical row-5 standing slot and clears mortal_dong_9..10 within loop budget', { timeout: 60_000 }, () => {
    const center = localCellToAbsolute({ row: 1, column: 1 })
    expect(center).toEqual(DEFAULT_PLAYER_STANDING_POSITION)
    expect(center.row).toBe(5)

    const session = new EarlyGameSession({ seed: 11, profile: PINNED_PROFILE })
    const resolved = resolvePartyFormation(session.player)
    expect(resolved).toEqual(DEFAULT_PARTY_FORMATION)
    expect(resolved[0]?.row).toBe(5)

    session.player.skillInsight += 600
    const report = runLoop(session, CANONICAL_EARLY_LOOP)

    expect(report.failedAt).toBeNull()
    expect(report.snapshot.completedStageIds).toContain('mortal_dong_8')
    expect(report.snapshot.completedStageIds).toContain('mortal_dong_9')
    expect(report.snapshot.completedStageIds).toContain('mortal_dong_10')
    expect(report.snapshot.completedStageIds).toContain('qi_refining_forest')
  })
})
