import { describe, expect, it } from 'vitest'
import {
  TU_LINH_TRAN_EFFECT_GROUP,
  getActiveCultivationSpeedPercent,
  splitCultivationSpeedWindow,
} from './TuLinhTranBalance'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'

function effect(overrides: Partial<PersistentTimedEffect>): PersistentTimedEffect {
  return {
    id: 'e1',
    sourceItemId: 'tu_linh_tran',
    appliedAtMs: 0,
    expiresAtMs: 10_000,
    modifiers: [],
    ...overrides,
  }
}

// Mission G Task 39 - one domain-owned read for the tu_linh_tran buff:
// group-filtered AND deadline-checked (matches activateTuLinhTran's
// group-stack accounting), not a sum over every active effect.
describe('getActiveCultivationSpeedPercent', () => {
  const now = 5_000

  it('sums only active same-group effects', () => {
    const effects = [
      effect({ effectGroup: TU_LINH_TRAN_EFFECT_GROUP, cultivationSpeedPercent: 0.25 }),
      effect({
        id: 'e2',
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        expiresAtMs: now - 1,
        cultivationSpeedPercent: 0.25,
      }),
    ]

    expect(getActiveCultivationSpeedPercent(effects, now)).toBe(0.25)
  })

  it('excludes effects in another group even when they carry the field', () => {
    const effects = [
      effect({ effectGroup: TU_LINH_TRAN_EFFECT_GROUP, cultivationSpeedPercent: 0.25 }),
      effect({
        id: 'e2',
        sourceItemId: 'other',
        effectGroup: 'pill_regen',
        cultivationSpeedPercent: 1,
      }),
    ]

    expect(getActiveCultivationSpeedPercent(effects, now)).toBe(0.25)
  })

  it('two stacked group effects sum', () => {
    const effects = [
      effect({ effectGroup: TU_LINH_TRAN_EFFECT_GROUP, cultivationSpeedPercent: 0.25 }),
      effect({
        id: 'e2',
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        cultivationSpeedPercent: 0.25,
      }),
    ]

    expect(getActiveCultivationSpeedPercent(effects, now)).toBe(0.5)
  })

  it('missing field / no group → 0', () => {
    expect(getActiveCultivationSpeedPercent([effect({})], now)).toBe(0)
    expect(getActiveCultivationSpeedPercent([], now)).toBe(0)
  })
})

// EM-02 - a buff expiring mid-offline-window: each segment must carry
// the percent live at segment start, not drag the save-time snapshot
// rate across the whole window.
describe('splitCultivationSpeedWindow', () => {
  const start = 100_000

  it('no effects → a single segment at 0%', () => {
    expect(splitCultivationSpeedWindow([], start, start + 60_000)).toEqual([
      { seconds: 60, percent: 0 },
    ])
  })

  it('buff alive past the window end → whole window carries the buff', () => {
    const effects = [
      effect({
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        expiresAtMs: start + 120_000,
        cultivationSpeedPercent: 0.2,
      }),
    ]

    expect(splitCultivationSpeedWindow(effects, start, start + 60_000)).toEqual([
      { seconds: 60, percent: 0.2 },
    ])
  })

  it('buff expiring mid-window splits segments and drops the expired percent', () => {
    const effects = [
      effect({
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        expiresAtMs: start + 20_000,
        cultivationSpeedPercent: 0.2,
      }),
    ]

    expect(splitCultivationSpeedWindow(effects, start, start + 60_000)).toEqual([
      { seconds: 20, percent: 0.2 },
      { seconds: 40, percent: 0 },
    ])
  })

  it('buff already expired at window start → no boosted segment', () => {
    const effects = [
      effect({
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        expiresAtMs: start - 1,
        cultivationSpeedPercent: 0.2,
      }),
    ]

    expect(splitCultivationSpeedWindow(effects, start, start + 60_000)).toEqual([
      { seconds: 60, percent: 0 },
    ])
  })

  it('two effects with different expiries produce three segments', () => {
    const effects = [
      effect({
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        expiresAtMs: start + 10_000,
        cultivationSpeedPercent: 0.2,
      }),
      effect({
        id: 'e2',
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        expiresAtMs: start + 30_000,
        cultivationSpeedPercent: 0.05,
      }),
    ]

    expect(splitCultivationSpeedWindow(effects, start, start + 60_000)).toEqual([
      { seconds: 10, percent: 0.25 },
      { seconds: 20, percent: 0.05 },
      { seconds: 30, percent: 0 },
    ])
  })

  it('expiry boundary is exclusive — an effect expiring exactly at segment start is dead', () => {
    const effects = [
      effect({
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        expiresAtMs: start + 30_000,
        cultivationSpeedPercent: 0.2,
      }),
    ]

    const segments = splitCultivationSpeedWindow(effects, start, start + 30_000)
    expect(segments).toEqual([{ seconds: 30, percent: 0.2 }])
  })

  it('zero-length window yields no segments', () => {
    expect(splitCultivationSpeedWindow([], start, start)).toEqual([])
  })
})
