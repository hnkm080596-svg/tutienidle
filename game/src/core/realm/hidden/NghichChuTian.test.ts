// HIDDEN-C - Nghich Chu Thien contract (design 2026-09-23 sec.12,
// master spec sec.8.3): discovery gated on 36/36 + open lineage,
// dual-cost attempts with the locked 100%->1% canonical chance curve,
// paid guaranteed success at the per-level pity threshold, frozen pity
// (no transfer), and completion -> completeHiddenBody.
import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  ZHOU_TIAN_CURRENCY_MATERIAL_ID,
} from '../../../data/realm/ZhouTian'
import { SPIRIT_STONE_MATERIAL_ID } from '../../material/SpiritStoneMaterial'
import { createDefaultPlayer } from '../../player/Player'
import type { PlayerData } from '../../player/Player'
import { getRealmHiddenState } from './HiddenLineage'
import {
  attemptNghichChuTian,
  getNghichChuTianMechanic,
  isNghichChuTianEligible,
  isNghichChuTianRevealed,
  maybeDiscoverNghichChuTian,
  NGHICH_CHU_TIAN_TOTAL_STEPS,
  nghichChuTianEssenceCost,
  nghichChuTianPityLimit,
  nghichChuTianStoneCost,
  nghichChuTianSuccessChance,
} from './NghichChuTian'
import { HIDDEN_MECHANIC_FINISHED_READERS } from './HiddenLineage'
import { HIDDEN_MECHANIC_STATE_VALIDATORS } from './HiddenPerfection'

const REALM_ID = 'foundation_establishment'

/** A player whose lineage is open, whose strict-prefix predecessors are
 * complete (mortal + qi_refining), in Truc Co - one field flip away from
 * full eligibility (zhou_tian 36/36). */
function lineagePlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = REALM_ID
  player.realmLevel = 18
  player.hiddenPerfection.lineageActive = true
  player.hiddenPerfection.completedHiddenBodyRealmIds = ['mortal', 'qi_refining']
  return player
}

function daiChuThien(player: PlayerData): void {
  player.bodyProgression.zhou_tian.completed = 36
}

/** Minimal honest bag: getAmount/has/remove semantics mirror MaterialBag
 * (remove is all-or-nothing). */
function fakeBag(amounts: Record<string, number>) {
  const store = { ...amounts }
  return {
    store,
    getAmount: (id: string) => store[id] ?? 0,
    has: (id: string, n: number) => (store[id] ?? 0) >= n,
    remove: (id: string, n: number) => {
      if ((store[id] ?? 0) < n) {
        return false
      }
      store[id] = (store[id] ?? 0) - n
      return true
    },
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NghichChuTian - canonical curves', () => {
  it('success chance is monotonically decreasing with locked endpoints', () => {
    expect(nghichChuTianSuccessChance(0)).toBeCloseTo(1.0)
    expect(nghichChuTianSuccessChance(35)).toBeCloseTo(0.01)
    for (let level = 1; level < NGHICH_CHU_TIAN_TOTAL_STEPS; level++) {
      expect(nghichChuTianSuccessChance(level))
        .toBeLessThan(nghichChuTianSuccessChance(level - 1))
    }
  })

  it('essence and stone costs are increasing', () => {
    for (let level = 1; level < NGHICH_CHU_TIAN_TOTAL_STEPS; level++) {
      expect(nghichChuTianEssenceCost(level))
        .toBeGreaterThan(nghichChuTianEssenceCost(level - 1))
      expect(nghichChuTianStoneCost(level))
        .toBeGreaterThanOrEqual(nghichChuTianStoneCost(level - 1))
      expect(nghichChuTianPityLimit(level))
        .toBeGreaterThanOrEqual(nghichChuTianPityLimit(level - 1))
    }
  })
})

describe('NghichChuTian - discovery gate (sec.12.1)', () => {
  it('is ineligible and unrevealed until normal Chu Thien is 36/36', () => {
    const player = lineagePlayer()
    player.bodyProgression.zhou_tian.completed = 35

    expect(isNghichChuTianEligible(player)).toBe(false)
    expect(isNghichChuTianRevealed(player)).toBe(false)
    expect(maybeDiscoverNghichChuTian(player)).toBeUndefined()
    expect(getRealmHiddenState(player, REALM_ID)).toBeUndefined()
  })

  it('is ineligible with a closed lineage even at 36/36 (no hint leaks)', () => {
    const player = lineagePlayer()
    player.hiddenPerfection.lineageActive = false
    daiChuThien(player)

    expect(isNghichChuTianEligible(player)).toBe(false)
    expect(isNghichChuTianRevealed(player)).toBe(false)
    expect(maybeDiscoverNghichChuTian(player)).toBeUndefined()
  })

  it('is ineligible outside foundation_establishment', () => {
    const player = lineagePlayer()
    player.realmId = 'golden_core'
    daiChuThien(player)

    expect(isNghichChuTianEligible(player)).toBe(false)
  })

  it('is ineligible while an earlier hidden body is incomplete', () => {
    const player = lineagePlayer()
    player.hiddenPerfection.completedHiddenBodyRealmIds = ['mortal']
    daiChuThien(player)

    expect(isNghichChuTianEligible(player)).toBe(false)
    expect(isNghichChuTianRevealed(player)).toBe(false)
  })

  it('a frozen discovered record hides the continuation (sec.12.1 - no hint while lineage closed)', () => {
    const player = lineagePlayer()
    daiChuThien(player)
    maybeDiscoverNghichChuTian(player)
    expect(isNghichChuTianRevealed(player)).toBe(true)

    // Lineage closure freezes inert progress (HiddenLineage close seam).
    player.hiddenPerfection.lineageActive = false
    getRealmHiddenState(player, REALM_ID)!.frozen = true

    expect(isNghichChuTianRevealed(player)).toBe(false)
  })

  it('discovers the realm record + installs the mechanic payload, idempotent', () => {
    const player = lineagePlayer()
    daiChuThien(player)

    expect(isNghichChuTianRevealed(player)).toBe(true)

    const mechanic = maybeDiscoverNghichChuTian(player)

    expect(mechanic).toEqual({
      kind: 'nghich_chu_tian',
      completed: 0,
      pityByLevel: [],
      active: true,
    })
    expect(getRealmHiddenState(player, REALM_ID)?.discovered).toBe(true)
    // Second call returns the same payload - no re-init, no duplicate.
    expect(maybeDiscoverNghichChuTian(player)).toBe(mechanic)
  })
})

describe('NghichChuTian - attempt resolution', () => {
  function readyPlayer(level = 0): PlayerData {
    const player = lineagePlayer()
    daiChuThien(player)
    maybeDiscoverNghichChuTian(player)
    const mechanic = getNghichChuTianMechanic(player)!
    mechanic.completed = level
    return player
  }

  function stockedBag(level: number) {
    return fakeBag({
      [ZHOU_TIAN_CURRENCY_MATERIAL_ID]: nghichChuTianEssenceCost(level),
      [SPIRIT_STONE_MATERIAL_ID]: nghichChuTianStoneCost(level),
    })
  }

  it('ineligible without a discovered mechanic, and complete only at 36', () => {
    const player = lineagePlayer()
    daiChuThien(player)

    // Eligible but never discovered: the attempt itself discovers it.
    const first = attemptNghichChuTian(player, fakeBag({}))
    // No stock -> insufficient, but the mechanic now exists.
    expect(first.outcome).toBe('insufficient')
    expect(getNghichChuTianMechanic(player)).toBeDefined()

    const done = readyPlayer(NGHICH_CHU_TIAN_TOTAL_STEPS)
    expect(attemptNghichChuTian(done, fakeBag({})).outcome).toBe('complete')
  })

  it('insufficient: either cost missing -> no debit of either', () => {
    const player = readyPlayer(0)
    const bag = fakeBag({ [ZHOU_TIAN_CURRENCY_MATERIAL_ID]: nghichChuTianEssenceCost(0) })

    const result = attemptNghichChuTian(player, bag)

    expect(result.outcome).toBe('insufficient')
    expect(bag.store[ZHOU_TIAN_CURRENCY_MATERIAL_ID]).toBe(nghichChuTianEssenceCost(0))
    expect(getNghichChuTianMechanic(player)!.completed).toBe(0)
    expect(getNghichChuTianMechanic(player)!.pityByLevel).toEqual([])
  })

  it('success: debits BOTH costs in full and advances exactly +1', () => {
    const player = readyPlayer(0) // chance 1.0 - any roll succeeds
    const bag = stockedBag(0)
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    const result = attemptNghichChuTian(player, bag)

    expect(result.outcome).toBe('success')
    expect(result.level).toBe(1)
    expect(bag.store[ZHOU_TIAN_CURRENCY_MATERIAL_ID]).toBe(0)
    expect(bag.store[SPIRIT_STONE_MATERIAL_ID]).toBe(0)
    expect(getNghichChuTianMechanic(player)!.completed).toBe(1)
  })

  it('failure: consumes the full cost and records pity on the attempted level only', () => {
    const player = readyPlayer(34) // chance ~3.9%
    const bag = stockedBag(34)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const result = attemptNghichChuTian(player, bag)

    expect(result.outcome).toBe('failure')
    expect(result.level).toBe(34)
    expect(result.pity).toBe(1)
    expect(bag.store[ZHOU_TIAN_CURRENCY_MATERIAL_ID]).toBe(0)
    expect(bag.store[SPIRIT_STONE_MATERIAL_ID]).toBe(0)
    expect(getNghichChuTianMechanic(player)!.pityByLevel[34]).toBe(1)
  })

  it('pity threshold: guaranteed-but-paid success regardless of the roll', () => {
    const player = readyPlayer(35) // chance 1%, pity limit 11
    const mechanic = getNghichChuTianMechanic(player)!
    mechanic.pityByLevel[35] = nghichChuTianPityLimit(35)
    const bag = stockedBag(35)
    vi.spyOn(Math, 'random').mockReturnValue(0.9999)

    const result = attemptNghichChuTian(player, bag)

    expect(result.outcome).toBe('success')
    expect(result.level).toBe(36)
    // Still fully paid.
    expect(bag.store[ZHOU_TIAN_CURRENCY_MATERIAL_ID]).toBe(0)
    expect(bag.store[SPIRIT_STONE_MATERIAL_ID]).toBe(0)
  })

  it('completing 36/36 completes the hidden body: active=false, bodyCompleted, +10pp', () => {
    const player = readyPlayer(35)
    const bag = stockedBag(35)
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const result = attemptNghichChuTian(player, bag)

    expect(result.outcome).toBe('success')
    expect(result.level).toBe(36)
    const mechanic = getNghichChuTianMechanic(player)!
    expect(mechanic.active).toBe(false)
    expect(getRealmHiddenState(player, REALM_ID)?.bodyCompleted).toBe(true)
    expect(player.hiddenPerfection.completedHiddenBodyRealmIds)
      .toContain(REALM_ID)
    // Post-completion attempts report 'complete' - the finished record
    // outlives eligibility (strict prefix already moved on).
    expect(attemptNghichChuTian(player, fakeBag({})).outcome).toBe('complete')
  })

  it('pity persists on the level it was spent and does not transfer', () => {
    const player = readyPlayer(5)
    const bag = fakeBag({
      [ZHOU_TIAN_CURRENCY_MATERIAL_ID]: 100000,
      [SPIRIT_STONE_MATERIAL_ID]: 100000,
    })
    vi.spyOn(Math, 'random').mockReturnValue(0.9999)

    // Two failures at level 5 record pity 2 on index 5.
    attemptNghichChuTian(player, bag)
    attemptNghichChuTian(player, bag)
    expect(getNghichChuTianMechanic(player)!.pityByLevel[5]).toBe(2)

    // Force success at level 5 via pity, then a failure at level 6:
    // level 6 starts from ZERO - no transfer.
    const mechanic = getNghichChuTianMechanic(player)!
    mechanic.pityByLevel[5] = nghichChuTianPityLimit(5)
    expect(attemptNghichChuTian(player, bag).outcome).toBe('success')
    expect(mechanic.completed).toBe(6)
    expect(mechanic.pityByLevel[6]).toBeUndefined()
    expect(mechanic.pityByLevel[5]).toBe(nghichChuTianPityLimit(5))
  })

  it('failure at a fresh level writes pityByLevel DENSELY - survives JSON round-trip validation', () => {
    const player = readyPlayer(5)
    const bag = fakeBag({
      [ZHOU_TIAN_CURRENCY_MATERIAL_ID]: 100000,
      [SPIRIT_STONE_MATERIAL_ID]: 100000,
    })
    vi.spyOn(Math, 'random').mockReturnValue(0.9999)

    // One failure at level 5 with zero prior failures: a sparse write
    // (holes -> JSON nulls) would fail persisted-state validation.
    expect(attemptNghichChuTian(player, bag).outcome).toBe('failure')
    expect(getNghichChuTianMechanic(player)!.pityByLevel)
      .toEqual([0, 0, 0, 0, 0, 1])

    const roundTripped = JSON.parse(
      JSON.stringify(getNghichChuTianMechanic(player)),
    )
    const issues: string[] = []
    HIDDEN_MECHANIC_STATE_VALIDATORS['nghich_chu_tian']!(
      roundTripped,
      (issue: string) => issues.push(issue),
    )
    expect(issues).toEqual([])
  })

  it('ineligible mid-mechanic when the lineage closes (frozen lineage = frozen pity)', () => {
    const player = readyPlayer(3)
    player.hiddenPerfection.lineageActive = false

    const result = attemptNghichChuTian(
      player,
      fakeBag({
        [ZHOU_TIAN_CURRENCY_MATERIAL_ID]: 100000,
        [SPIRIT_STONE_MATERIAL_ID]: 100000,
      }),
    )

    expect(result.outcome).toBe('ineligible')
    // Nothing debited, nothing advanced.
    expect(getNghichChuTianMechanic(player)!.completed).toBe(3)
  })
})

describe('NghichChuTian - persisted-state validator + finished reader', () => {
  const validator = HIDDEN_MECHANIC_STATE_VALIDATORS['nghich_chu_tian']
  const finished = HIDDEN_MECHANIC_FINISHED_READERS['nghich_chu_tian']

  function issuesOf(payload: unknown): string[] {
    const issues: string[] = []
    validator!(payload as never, (issue: string) => issues.push(issue))
    return issues
  }

  it('validator accepts the canonical payload, flags bad shapes loudly', () => {
    expect(issuesOf({
      kind: 'nghich_chu_tian',
      completed: 12,
      pityByLevel: [0, 0, 3],
      active: true,
    })).toEqual([])

    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 1.5, pityByLevel: [], active: true }).length).toBeGreaterThan(0)
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 37, pityByLevel: [], active: true }).length).toBeGreaterThan(0)
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 0, pityByLevel: 'x', active: true }).length).toBeGreaterThan(0)
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 0, pityByLevel: [1.5], active: true }).length).toBeGreaterThan(0)
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 0, pityByLevel: [-1], active: true }).length).toBeGreaterThan(0)
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 0, pityByLevel: new Array(37).fill(0), active: true }).length).toBeGreaterThan(0)
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 0, pityByLevel: [], active: 'yes' }).length).toBeGreaterThan(0)
  })

  it('validator enforces active === (completed < 36) coherence', () => {
    // Inactive before 36: crafted dead-end - attempt returns 'ineligible'
    // forever while the UI still renders 'Complete'.
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 5, pityByLevel: [], active: false }).length).toBeGreaterThan(0)
    // Active past 36: likewise incoherent.
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 36, pityByLevel: [], active: true }).length).toBeGreaterThan(0)
    // Canonical endpoints stay clean.
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 35, pityByLevel: [], active: true })).toEqual([])
    expect(issuesOf({ kind: 'nghich_chu_tian', completed: 36, pityByLevel: [], active: false })).toEqual([])
  })

  it('finished reader reports true exactly at 36/36', () => {
    expect(finished!({ completed: 36 } as never)).toBe(true)
    expect(finished!({ completed: 35 } as never)).toBe(false)
    expect(finished!({ completed: 0 } as never)).toBe(false)
  })
})
