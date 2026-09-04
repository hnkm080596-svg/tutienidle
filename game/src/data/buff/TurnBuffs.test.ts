import { describe, expect, it } from 'vitest'
import { DUNG_NHAM_BURN_DEFINITION, KIEM_TRAN_BURN_DEFINITION } from './TurnBuffs'

// Completion plan Task 7 Step 2 — structural assertions cho 2 dot buff
// definition thay Lava Zone (Dung Nham reaction) / Sword Zone (Kiếm Trận
// keystone). dpsRatio quy đổi từ công thức hệ sống (Task 6 survey):
//   - Dung Nham: spawnLavaZone damagePerTick 20 CỐ ĐỊNH (ElementReaction.ts),
//     không attack-scaling → baseline attack 10 (StatBlock.ts) → 20/10 = 2.0
//     (damage/tick tại baseline giữ nguyên 20).
//   - Kiếm Trận: spawnSwordZone damagePerTick = multiplier × 0.3 × attack
//     (SkillEffectSystem) → dpsRatio 0.3 1:1 (đã attack-scaled sẵn).
// Duration giữ nguyên SỐ (no-rebalance policy): 6s tick 1s = 6 lượt;
// charges 3 = 3 lượt.

describe('TurnBuffs zone-as-dot definitions', () => {
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

  it('kiem_tran_burn — dot metal dpsRatio 0.3, 3 lượt (mirror charges), polarity buff', () => {
    expect(KIEM_TRAN_BURN_DEFINITION.id).toBe('kiem_tran_burn')
    expect(KIEM_TRAN_BURN_DEFINITION.polarity).toBe('buff')
    expect(KIEM_TRAN_BURN_DEFINITION.stackMode).toBe('refresh')
    expect(KIEM_TRAN_BURN_DEFINITION.duration).toBe(3)

    const effects = KIEM_TRAN_BURN_DEFINITION.effects
    expect(effects).toHaveLength(1)
    const effect = effects[0]
    if (effect?.type !== 'dot') throw new Error('expected dot effect')
    expect(effect.dpsRatio).toBe(0.3)
    expect(effect.element).toBe('metal')
  })
})
