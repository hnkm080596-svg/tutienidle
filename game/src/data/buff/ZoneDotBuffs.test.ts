import { describe, expect, it } from 'vitest'
import { DUNG_NHAM_BURN_DEFINITION } from './ZoneDotBuffs'

// Completion plan Task 7 Step 2 — structural assertions cho dot buff
// definition thay Lava Zone (Dung Nham reaction). dpsRatio quy đổi từ
// công thức hệ sống (Task 6 survey):
//   - Dung Nham: spawnLavaZone damagePerTick 20 CỐ ĐỊNH (ElementReaction.ts),
//     không might-scaling → baseline might 10 (StatBlock.ts) → 20/10 = 2.0
//     (damage/tick tại baseline giữ nguyên 20).
// (Kiếm Trận anchor removed — Kiem Tu Reimagined spec 2026-09-15 §7.)
// Duration giữ nguyên SỐ (no-rebalance policy): 6s tick 1s = 6 lượt.

describe('ZoneDotBuffs zone-as-dot definitions', () => {
  it('dung_nham_burn — dot fire dpsRatio 2.0, 6 lượt, polarity debuff', () => {
    expect(DUNG_NHAM_BURN_DEFINITION.id).toBe('dung_nham_burn')
    expect(DUNG_NHAM_BURN_DEFINITION.polarity).toBe('debuff')
    expect(DUNG_NHAM_BURN_DEFINITION.stackMode).toBe('refresh')
    expect(DUNG_NHAM_BURN_DEFINITION.duration).toBe(6)

    const effects = DUNG_NHAM_BURN_DEFINITION.effects
    expect(effects).toHaveLength(1)
    const effect = effects[0]
    if (effect?.type !== 'dot') throw new Error('expected dot effect')
    expect(effect.dpsRatio).toBe(2.0)
    expect(effect.element).toBe('fire')
  })
})
