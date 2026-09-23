// M-F-CHU-THIEN - the Chu Thien chapter contract: realm-derived
// capacity (20*TC level, 180 Tieu / 360 Dai), milestone predicates,
// capacity-clamped idempotent invest, and the persisted/integrity
// validation halves of the chapter contract.
import { describe, expect, it } from 'vitest'

import { ZHOU_TIAN_CURRENCY_MATERIAL_ID } from '../../../data/realm/ZhouTian'
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

  it('capacity is 0 before Truc Co and 360 past it (fail closed on unknown realms)', () => {
    expect(getZhouTianCapacity(playerIn('mortal', 10))).toBe(0)
    expect(getZhouTianCapacity(playerIn('qi_refining', 18))).toBe(0)
    expect(getZhouTianCapacity(playerIn('not_a_realm', 1))).toBe(0)
    expect(getZhouTianCapacity(playerIn('golden_core', 1))).toBe(360)
  })

  it('capacity is 20 * realmLevel inside Truc Co, clamped at 360', () => {
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 1))).toBe(20)
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 9))).toBe(180)
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 17))).toBe(340)
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 18))).toBe(360)
    // No 361+: the ceiling is hard - higher levels never exceed 360.
    expect(getZhouTianCapacity(playerIn('foundation_establishment', 30))).toBe(360)
  })

  it('milestone boundaries: Tieu at 180, Dai at 360 (= complete), nothing past', () => {
    const player = playerIn('foundation_establishment', 18)
    const state = player.bodyProgression.zhou_tian

    state.circulation = 179
    expect(isTieuChuThienReached(player)).toBe(false)
    expect(isDaiChuThienReached(player)).toBe(false)

    state.circulation = 180
    expect(isTieuChuThienReached(player)).toBe(true)
    expect(isDaiChuThienReached(player)).toBe(false)
    expect(zhouTianChapter.isComplete(player)).toBe(false)

    state.circulation = 359
    expect(isDaiChuThienReached(player)).toBe(false)

    state.circulation = 360
    expect(isDaiChuThienReached(player)).toBe(true)
    expect(zhouTianChapter.isComplete(player)).toBe(true)
    expect(zhouTianChapter.progress(player)).toEqual({ completed: 360, total: 360 })
  })
})

describe('ZhouTianChapter - invest', () => {
  function tcPlayer(realmLevel: number) {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = realmLevel
    return player
  }

  it('consumes up to available within capacity, returns the consumed amount', () => {
    const player = tcPlayer(1) // capacity 20

    expect(zhouTianChapter.invest(player, 7, 0)).toBe(7)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(7)

    expect(zhouTianChapter.invest(player, 100, 0)).toBe(13)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(20)
  })

  it('is idempotent at capacity / completion (0 consumed, no mutation)', () => {
    const player = tcPlayer(1)
    player.bodyProgression.zhou_tian.circulation = 20

    expect(zhouTianChapter.invest(player, 50, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(20)

    player.realmLevel = 18
    player.bodyProgression.zhou_tian.circulation = 360
    expect(zhouTianChapter.invest(player, 50, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(360)
  })

  it('rejects non-positive / zero available without touching state', () => {
    const player = tcPlayer(18)

    expect(zhouTianChapter.invest(player, 0, 0)).toBe(0)
    expect(zhouTianChapter.invest(player, -5, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(0)
  })

  it('has zero capacity pre-Truc Co so invest consumes nothing', () => {
    const player = createDefaultPlayer() // mortal

    expect(zhouTianChapter.invest(player, 100, 0)).toBe(0)
    expect(player.bodyProgression.zhou_tian.circulation).toBe(0)
  })
})

describe('ZhouTianChapter - emission contract (mechanism only)', () => {
  it('collectBaseStatDeltas emits an empty map (values content-deferred)', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 18
    player.bodyProgression.zhou_tian.circulation = 200

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

  it('validatePersistedState rejects non-object slices and bad circulation shapes', () => {
    expect(collectIssues(undefined).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian'])
    expect(collectIssues(7).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian'])
    expect(collectIssues({ circulation: 'x' }).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian.circulation'])
    expect(collectIssues({ circulation: -1 }).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian.circulation'])
    // C2C-79 - fractional circulation rejects at this layer too.
    expect(collectIssues({ circulation: 1.5 }).map(i => i.path))
      .toEqual(['player.bodyProgression.zhou_tian.circulation'])
    expect(collectIssues({ circulation: 42 })).toEqual([])
  })

  it('integrityIssues flags non-integer / out-of-range circulation', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 18 // capacity 360 - the full range is legal

    expect(zhouTianChapter.integrityIssues(player)).toEqual([])

    player.bodyProgression.zhou_tian.circulation = 1.5
    expect(zhouTianChapter.integrityIssues(player).length).toBe(1)

    player.bodyProgression.zhou_tian.circulation = 361 // beyond Dai - impossible
    expect(zhouTianChapter.integrityIssues(player).length).toBe(2) // range + capacity

    player.bodyProgression.zhou_tian.circulation = -1
    expect(zhouTianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    player.bodyProgression.zhou_tian.circulation = 360
    expect(zhouTianChapter.integrityIssues(player)).toEqual([])
  })

  // C2C-75 - the realm-capacity invariant: circulation over the
  // realm-derived capacity is corrupt even inside the 0..360 range.
  it('integrityIssues flags circulation above the realm capacity', () => {
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.realmLevel = 1 // capacity 20

    player.bodyProgression.zhou_tian.circulation = 20
    expect(zhouTianChapter.integrityIssues(player)).toEqual([])

    player.bodyProgression.zhou_tian.circulation = 21
    expect(zhouTianChapter.integrityIssues(player)[0]).toMatch(/capacity/i)

    player.bodyProgression.zhou_tian.circulation = 360
    expect(zhouTianChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // Pre-Truc Co capacity is 0 - any circulation is corrupt there.
    const mortal = createDefaultPlayer()
    mortal.bodyProgression.zhou_tian.circulation = 1
    expect(zhouTianChapter.integrityIssues(mortal).length).toBeGreaterThan(0)
  })
})
