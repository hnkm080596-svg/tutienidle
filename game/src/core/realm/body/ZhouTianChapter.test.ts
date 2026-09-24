// HIDDEN-C - the Chu Thien chapter contract under the design 2026-09-23
// sec.11 discrete-step track: realm-derived capacity (2 steps/TC level,
// 36 total), Tieu 18 / Dai 36 lore marks, per-step-cost idempotent
// invest, authored per-step stat rewards, and the persisted/integrity
// validation halves of the chapter contract.
import { describe, expect, it } from 'vitest'

import {
  ZHOU_TIAN_CURRENCY_MATERIAL_ID,
  ZHOU_TIAN_TOTAL_STEPS,
  zhouTianStepCost,
  zhouTianStepReward,
} from '../../../data/realm/ZhouTian'
import { createDefaultPlayer } from '../../player/Player'
import {
  getZhouTianCapacity,
  isDaiChuThienReached,
  isTieuChuThienReached,
  zhouTianChapter,
} from './ZhouTianChapter'
import type { BodyProgressionIssue } from './BodyChapter'

describe('ZhouTianChapter - capacity + milestones', () => {
  function playerIn(realmId: string, realmLevel = 1) {
    const player = createDefaultPlayer()
    player.realmId = realmId
    player.realmLevel = realmLevel
    return player
  }

  it('capacity is 0 before Truc Co and 36 past it (fail closed on unknown realms)', () => {
    expect(getZhouTianCapacity(playerIn('mortal', 10))).toBe(0)
    expect(getZhouTianCapacity(playerIn('qi_refining', 18))).toBe(0)
    expect(getZhouTianCapacity(playerIn('not_a_realm', 1))).toBe(0)
    expect(getZhouTianCapacity(playerIn('golden_core', 1))).toBe(36)
  })

  it('capacity is 2 * realmLevel inside Truc Co, clamped at 36', () => {
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 1))).toBe(2)
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 9))).toBe(18)
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 17))).toBe(34)
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 18))).toBe(36)
    // No 37+: the ceiling is hard - higher levels never exceed 36.
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 30))).toBe(36)
  })

  it('milestone boundaries: Tieu at 18, Dai at 36 (= complete), nothing past', () => {
    const player = playerIn('foundation_establishment', 18)
    const state = player.bodyProgression.zhou_tian

    state.completed = 17
    expect(isTieuChuThienReached(player)).toBe(false)
    expect(isDaiChuThienReached(player)).toBe(false)

    state.completed = 18
    expect(isTieuChuThienReached(player)).toBe(true)
    expect(isDaiChuThienReached(player)).toBe(false)
    expect(zhouTianChapter.isComplete(player)).toBe(false)

    state.completed = 35
    expect(isDaiChuThienReached(player)).toBe(false)

    state.completed = 36
    expect(isDaiChuThienReached(player)).toBe(true)
    expect(zhouTianChapter.isComplete(player)).toBe(true)
    expect(zhouTianChapter.progress(player)).toEqual({ completed: 36, total: 36 })
  })
})

describe('ZhouTianChapter - invest', () => {
  function tcPlayer(realmLevel: number) {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = realmLevel
    return player
  }

  it('advances whole steps only - partial essence below the step cost debits nothing', () => {
    const player = tcPlayer(18)

    // Step 0 costs 15: 14 essence buys nothing, no partial credit.
    expect(zhouTianChapter.invest(player, 14, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.completed).toBe(0)

    expect(zhouTianChapter.invest(player, 15, 0)).toBe(15)
    expect(player.bodyProgression.zhou_tian.completed).toBe(1)
  })

  it('consumes consecutive step costs while affordable within capacity', () => {
    const player = tcPlayer(1) // capacity 2

    // Steps 0+1 cost 15+20=35; a surplus beyond that stays unspent.
    expect(zhouTianChapter.invest(player, 100, 0)).toBe(35)
    expect(player.bodyProgression.zhou_tian.completed).toBe(2)
  })

  it('advances exactly +1 deterministic per authored cost (no RNG)', () => {
    const player = tcPlayer(18)

    let expectedCompleted = 0
    for (let step = 0; step < 5; step++) {
      const cost = zhouTianStepCost(expectedCompleted)
      expect(zhouTianChapter.invest(player, cost, 0)).toBe(cost)
      expectedCompleted += 1
      expect(player.bodyProgression.zhou_tian.completed).toBe(expectedCompleted)
    }
  })

  it('is idempotent at capacity / completion (0 consumed, no mutation)', () => {
    const player = tcPlayer(1)
    player.bodyProgression.zhou_tian.completed = 2

    expect(zhouTianChapter.invest(player, 50, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.completed).toBe(2)

    player.realmLevel = 18
    player.bodyProgression.zhou_tian.completed = 36
    expect(zhouTianChapter.invest(player, 50, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.completed).toBe(36)
  })

  it('rejects non-positive / zero available without touching state', () => {
    const player = tcPlayer(18)

    expect(zhouTianChapter.invest(player, 0, 0)).toBe(0)
    expect(zhouTianChapter.invest(player, -5, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.completed).toBe(0)
  })

  it('has zero capacity pre-Truc Co so invest consumes nothing', () => {
    const player = createDefaultPlayer() // mortal

    expect(zhouTianChapter.invest(player, 100, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.completed).toBe(0)
  })
})

describe('ZhouTianChapter - emission contract (authored step rewards)', () => {
  it('collectBaseStatDeltas sums authored raw/base rewards over completed steps', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 18
    player.bodyProgression.zhou_tian.completed = 10

    // Steps 0..9 rewards summed: maxHp 190, might 30, defense 14,
    // hpRegenPerTurn 1 (sec.11.3 vocabulary - no five-main stats, no
    // generic percentage).
    const expected: Record<string, number> = {}
    for (let step = 0; step < 10; step++) {
      for (const [stat, amount] of Object.entries(zhouTianStepReward(step))) {
        expected[stat] = (expected[stat] ?? 0) + amount
      }
    }

    expect(zhouTianChapter.collectBaseStatDeltas(player)).toEqual(expected)
    expect(expected).toEqual({
      maxHp: 190,
      might: 28,
      defense: 14,
      hpRegenPerTurn: 1,
    })
  })

  it('collectBaseStatDeltas emits an empty map at zero progress', () => {
    const player = createDefaultPlayer()
    expect(zhouTianChapter.collectBaseStatDeltas(player)).toEqual({})
  })

  it('scrubLegacyModifiers strips zhou-tian:* slices, leaves others', () => {
    const player = createDefaultPlayer()
    player.modifiers = [
      {
        id: 'zhou-tian:legacy:might',
        sourceId: 'zhou_tian',
        sourceType: 'realm',
        stat: 'might',
        percent: 0.1,
      },
      {
        id: 'equipment:kiem:might',
        sourceId: 'kiem',
        sourceType: 'equipment',
        stat: 'might',
        flat: 10,
      },
    ]

    zhouTianChapter.scrubLegacyModifiers(player)

    expect(player.modifiers.map(m => m.id)).toEqual(['equipment:kiem:might'])
  })

  it('declares the authored Phap-essence currency id (C2C-64)', () => {
    expect(zhouTianChapter.currency).toEqual({ bag: 'material', id: 'tinh_hoa_phap_the' })
    expect(zhouTianChapter.currency.id).toBe(ZHOU_TIAN_CURRENCY_MATERIAL_ID)
    expect(zhouTianChapter.auxCurrency).toBeUndefined()
    expect(zhouTianChapter.physiqueAdvancement).toBeUndefined()
  })
})

describe('ZhouTianChapter - persisted + integrity validation', () => {
  function collectIssues(slice: unknown): BodyProgressionIssue[] {
    const issues: BodyProgressionIssue[] = []
    zhouTianChapter.validatePersistedState(
      slice,
      'player.bodyProgression.zhou_tian',
      issue => issues.push(issue),
    )
    return issues
  }

  it('validatePersistedState rejects non-object slices and bad completed shapes', () => {
    expect(collectIssues(undefined).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian'])
    expect(collectIssues(7).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian'])
    expect(collectIssues({ completed: 'x' }).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian.completed'])
    expect(collectIssues({ completed: -1 }).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian.completed'])
    // C2C-79 - fractional completed rejects at this layer too.
    expect(collectIssues({ completed: 1.5 }).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian.completed'])
    expect(collectIssues({ completed: ZHOU_TIAN_TOTAL_STEPS + 1 }).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian.completed'])
    expect(collectIssues({ completed: 20 })).toEqual([])
  })

  it('integrityIssues flags non-integer / out-of-range completed', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 18 // capacity 36 - the full range is legal

    expect(zhouTianChapter.integrityIssues(player)).toEqual([])

    player.bodyProgression.zhou_tian.completed = 1.5
    expect(zhouTianChapter.integrityIssues(player).length).toBe(1)

    player.bodyProgression.zhou_tian.completed = 37 // beyond Dai - impossible
    expect(zhouTianChapter.integrityIssues(player).length).toBe(2) // range + capacity

    player.bodyProgression.zhou_tian.completed = -1
    expect(zhouTianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    player.bodyProgression.zhou_tian.completed = 36
    expect(zhouTianChapter.integrityIssues(player)).toEqual([])
  })

  // C2C-75 - the realm-capacity invariant: completed over the
  // realm-derived capacity is corrupt even inside the 0..36 range.
  it('integrityIssues flags completed above the realm capacity', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 1 // capacity 2

    player.bodyProgression.zhou_tian.completed = 2
    expect(zhouTianChapter.integrityIssues(player)).toEqual([])

    player.bodyProgression.zhou_tian.completed = 3
    expect(zhouTianChapter.integrityIssues(player)[0]).toMatch(/capacity/i)

    player.bodyProgression.zhou_tian.completed = 36
    expect(zhouTianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Pre-Truc Co capacity is 0 - any completed steps are corrupt there.
    const mortal = createDefaultPlayer()
    mortal.bodyProgression.zhou_tian.completed = 1
    expect(zhouTianChapter.integrityIssues(mortal).length).toBeGreaterThan(0)
  })
})
