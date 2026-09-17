import { describe, expect, it } from 'vitest'
import {
  TU_LINH_TRAN_EFFECT_GROUP,
  getActiveCultivationSpeedPercent,
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

// Mission G Task 39 — one domain-owned read for the tu_linh_tran buff:
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
