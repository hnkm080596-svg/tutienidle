import { afterEach, describe, expect, it, vi } from 'vitest'

// QA wave-4 blind seam hunt (2026-10-11) - qualityAccum edge seam:
// a meridian accumulating quality across MANY invests (mixed grades)
// must keep a correct running mean, the accumulator must survive a
// mid-accumulation reload, and the fold at progress 100 must write the
// clamped mean while dropping the accumulator. The ops seam these
// three calls replicate is investBodyChapter -> removeDetailed ->
// recordMeridianOpenQuality (GameManagerRealmAdvanceOps.ts:989-995).

import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import {
  meridianChapter,
  recordMeridianOpenQuality,
  MERIDIAN_FULL_PROGRESS,
} from './MeridianChapter'
import { PillBag } from '../../pill/PillBag'
import { THONG_MACH_DAN_MATERIAL_ID } from '../../../data/realm/Meridians'
import { PILL_QUALITY_EFFECT_UPLIFT } from '../../pill/PillQuality'
import type { ItemQuality } from '../../item/ItemQuality'

const NHAM = 'nham_mach'

function player(): PlayerData {
  const p = createDefaultPlayer()
  // nham_mach gates on page realm qi_refining + realmLevel >= 2; the
  // dispatch gate (unlocksAfterChapters) is replicated by marking
  // body_refinement complete the way a real save carries it.
  p.realmId = 'qi_refining'
  p.realmLevel = 2
  // Dispatch-level chapter order (unlocksAfterChapters) is not part of
  // the seam under test - invest() itself only gates page + pace.
  return p
}

const PILL = { id: THONG_MACH_DAN_MATERIAL_ID } as Parameters<PillBag['add']>[0]

// One deterministic invest: gain lands at mid-range (random() = 0.5 ->
// nham_mach gain 7.5), the bag holds exactly the grade we want spent.
function investOne(playerArg: PlayerData, bag: PillBag, grade: ItemQuality): boolean {
  bag.add(PILL, 1, grade)
  const available = bag.getAmount(THONG_MACH_DAN_MATERIAL_ID)
  const consumed = meridianChapter.invest(playerArg, available, 0)
  if (consumed <= 0) {
    return false
  }
  const spent = bag.removeDetailed(THONG_MACH_DAN_MATERIAL_ID, consumed)
  recordMeridianOpenQuality(playerArg, spent)
  return true
}

describe('SEAM-3 qualityAccum — running mean across many mixed-grade invests', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('the running mean folds the uplift-weighted average at completion', () => {
    const p = player()
    const bag = new PillBag()
    // nham_mach gain = 5 + 0.5*(10-5) = 7.5 per invest.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    // 5 invests with one of each grade in ascending spend order.
    const grades: ItemQuality[] = ['hoang', 'huyen', 'dia', 'thien', 'tien']
    for (const grade of grades) {
      expect(investOne(p, bag, grade)).toBe(true)
    }

    // Accumulator must hold sum = 1+1.25+1.5+1.75+2 = 7.5, count 5.
    const accum = p.bodyProgression.meridian.qualityAccum?.[NHAM]
    expect(accum).toEqual({ sum: 7.5, count: 5 })

    // Keep investing 'hoang' (1.0) until the meridian opens: 37.5 +
    // 9*7.5 = 105 -> clamped 100 at the 14th invest total.
    let guard = 0
    while ((p.bodyProgression.meridian.progress[NHAM] ?? 0) < MERIDIAN_FULL_PROGRESS) {
      expect(investOne(p, bag, 'hoang')).toBe(true)
      guard += 1
      expect(guard).toBeLessThan(20)
    }

    // Fold: sum = 7.5 + 9 = 16.5, count = 14 -> mean 1.178571..., in
    // the authored [1,2] band; accumulator is dropped.
    const written = p.bodyProgression.meridian.openedQualityMultipliers?.[NHAM]
    expect(written).toBeCloseTo(16.5 / 14, 10)
    expect(written).toBeGreaterThanOrEqual(1)
    expect(written).toBeLessThanOrEqual(2)
    expect(p.bodyProgression.meridian.qualityAccum?.[NHAM]).toBeUndefined()
  })

  it('a mid-accumulation reload preserves the running mean (JSON round-trip)', () => {
    const p = player()
    const bag = new PillBag()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    // Two invests - one 'tien' (2.0) and one 'hoang' (1.0) - progress 15.
    expect(investOne(p, bag, 'tien')).toBe(true)
    expect(investOne(p, bag, 'hoang')).toBe(true)
    expect(p.bodyProgression.meridian.qualityAccum?.[NHAM]).toEqual({ sum: 3, count: 2 })

    // Reload: the persisted slice round-trips through JSON exactly the
    // way buildGameSave/loadGame carry it.
    const restored = player()
    restored.bodyProgression.meridian = JSON.parse(
      JSON.stringify(p.bodyProgression.meridian),
    )

    // The shape gate must accept a legal mid-accumulation accumulator.
    const issues: string[] = []
    meridianChapter.validatePersistedState(
      restored.bodyProgression.meridian,
      'player.bodyProgression.meridian',
      (issue) => issues.push(issue.path),
    )
    expect(issues).toHaveLength(0)

    // Continue the same meridian: invests must ACCUMULATE onto the
    // restored {sum:3,count:2}, not restart.
    while ((restored.bodyProgression.meridian.progress[NHAM] ?? 0) < MERIDIAN_FULL_PROGRESS) {
      expect(investOne(restored, bag, 'hoang')).toBe(true)
    }

    // 15 + ceil(85/7.5)=12 more 'hoang' invests -> sum 3+12, count 14.
    const written = restored.bodyProgression.meridian.openedQualityMultipliers?.[NHAM]
    expect(written).toBeCloseTo(15 / 14, 10)
    expect(restored.bodyProgression.meridian.qualityAccum?.[NHAM]).toBeUndefined()
  })

  it('integrity checker pins the reset contract: stale accum/multiplier entries are flagged', () => {
    // No respec path exists for the meridian chapter - the consistency
    // checker is the deny arm that refuses a state carrying entries
    // the writer could never produce. Pin that contract.
    const p = player()
    p.bodyProgression.meridian.progress = { [NHAM]: 0 }
    // Accumulator on a meridian with no progress = orphaned entry.
    p.bodyProgression.meridian.qualityAccum = { [NHAM]: { sum: 1.5, count: 1 } }
    // Multiplier on an unopened meridian = orphaned multiplier.
    p.bodyProgression.meridian.openedQualityMultipliers = { [NHAM]: 1.5 }

    const issues = meridianChapter.integrityIssues(p)
    expect(issues.some((issue) => issue.includes('qualityAccum'))).toBe(true)
    expect(issues.some((issue) => issue.includes('openedQualityMultipliers'))).toBe(true)
  })

  it('sanity: uplift constants still inside the band the fold clamps to', () => {
    for (const value of Object.values(PILL_QUALITY_EFFECT_UPLIFT)) {
      expect(value).toBeGreaterThanOrEqual(1)
      expect(value).toBeLessThanOrEqual(2)
    }
  })
})
