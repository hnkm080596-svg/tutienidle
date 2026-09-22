import { describe, expect, it } from 'vitest'

import { BODY_REFINEMENT_TIERS } from '../../../data/realm/BodyRefinement'
import { MERIDIANS } from '../../../data/realm/Meridians'
import { createDefaultPlayer } from '../../player/Player'
import {
  assertBodyProgressionIntegrity,
  canProgressPhysiqueChapter,
  getPhysiqueGrade,
  investBodyChapterState,
} from './BodyProgressionSystem'

// M-QI-07 (QI-D4) - physique transformation authority: the 6/6
// body_refinement completion advances physiqueGrade pham -> bao
// exactly once, realm-independent, idempotent, and the semantic
// integrity gate derives the exact reachable grade from the authored
// contiguous-prefix chain.
function fillAllTiers(player: ReturnType<typeof createDefaultPlayer>): void {
  for (const tier of BODY_REFINEMENT_TIERS) {
    const consumed = investBodyChapterState(player, 'body_refinement', tier.cap, 0)
    expect(consumed).toBe(tier.cap)
  }
}

describe('physique transformation (QI-D4)', () => {
  it('default player starts at pham', () => {
    const player = createDefaultPlayer()
    expect(getPhysiqueGrade(player)).toBe('pham')
  })

  it('completing 6/6 body_refinement transforms pham -> bao exactly once', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'

    fillAllTiers(player)

    expect(player.bodyProgression.body_refinement.completedTiers).toBe(6)
    expect(getPhysiqueGrade(player)).toBe('bao')

    // Exactly-once: a later successful-invest-free evaluation cannot
    // re-apply (the invest call on a complete chapter consumes 0).
    expect(investBodyChapterState(player, 'body_refinement', 10, 0)).toBe(0)
    expect(getPhysiqueGrade(player)).toBe('bao')
  })

  it('partial completion (5/6) leaves the grade at pham', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'

    for (const tier of BODY_REFINEMENT_TIERS.slice(0, 5)) {
      investBodyChapterState(player, 'body_refinement', tier.cap, 0)
    }

    expect(player.bodyProgression.body_refinement.completedTiers).toBe(5)
    expect(getPhysiqueGrade(player)).toBe('pham')
  })

  it('late completion transforms too - realm is not a condition', () => {
    const player = createDefaultPlayer()
    // Luyen Khi player finishing the old Mortal chapter late.
    player.realmId = 'qi_refining'
    player.realmLevel = 12

    fillAllTiers(player)

    expect(getPhysiqueGrade(player)).toBe('bao')
  })

  it('a grade already at/past the source is never rewritten (source-guard)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.physiqueGrade = 'bao'

    fillAllTiers(player)

    expect(getPhysiqueGrade(player)).toBe('bao')
  })

  it('meridian completion never touches physiqueGrade', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.realmLevel = 18

    for (let i = 0; i < MERIDIANS.length; i++) {
      investBodyChapterState(player, 'meridian', 999, 999)
    }

    expect(player.bodyProgression.meridian.openedIds).toHaveLength(MERIDIANS.length)
    expect(getPhysiqueGrade(player)).toBe('pham')
  })
})

describe('canProgressPhysiqueChapter (INV-5 invest gate)', () => {
  it('gates a synthetic bao->phap advancement while grade is pham', () => {
    const player = createDefaultPlayer()
    const synthetic = { from: 'bao' as const, to: 'phap' as const }

    expect(canProgressPhysiqueChapter(player, synthetic)).toBe(false)

    player.physiqueGrade = 'bao'
    expect(canProgressPhysiqueChapter(player, synthetic)).toBe(true)

    player.physiqueGrade = 'phap'
    expect(canProgressPhysiqueChapter(player, synthetic)).toBe(true)
  })

  it('the real pham binding is never gated (vacuous for every grade)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'

    // Even the lowest rung satisfies from:'pham' - today's chapter is
    // never blocked by the gate.
    expect(canProgressPhysiqueChapter(player, { from: 'pham', to: 'bao' })).toBe(true)

    const consumed = investBodyChapterState(player, 'body_refinement', 5, 0)
    expect(consumed).toBe(5)
  })
})

describe('physique coherence at assertBodyProgressionIntegrity (INV-8)', () => {
  it('accepts the canonical pairs: 0/6 + pham and 6/6 + bao', () => {
    const fresh = createDefaultPlayer()
    expect(() => assertBodyProgressionIntegrity(fresh)).not.toThrow()

    const done = createDefaultPlayer()
    done.realmId = 'qi_refining'
    done.physiqueGrade = 'bao'
    done.bodyProgression.body_refinement.completedTiers = 6
    expect(() => assertBodyProgressionIntegrity(done)).not.toThrow()
  })

  it('rejects a complete chapter whose transform was never applied (6/6 + pham)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.bodyProgression.body_refinement.completedTiers = 6
    // physiqueGrade stays 'pham' - incoherent: no recompute, reject.

    expect(() => assertBodyProgressionIntegrity(player)).toThrow(/physique/i)
  })

  it('rejects a grade outrunning its incomplete chapter (5/6 + bao)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'
    player.physiqueGrade = 'bao'
    player.bodyProgression.body_refinement.completedTiers = 5

    expect(() => assertBodyProgressionIntegrity(player)).toThrow(/physique/i)
  })

  it('rejects unreachable rungs with no authored chain (6/6 + phap/tien)', () => {
    for (const rung of ['phap', 'tien'] as const) {
      const player = createDefaultPlayer()
      player.realmId = 'qi_refining'
      player.physiqueGrade = rung
      player.bodyProgression.body_refinement.completedTiers = 6

      expect(() => assertBodyProgressionIntegrity(player)).toThrow(/physique/i)
    }
  })
})
