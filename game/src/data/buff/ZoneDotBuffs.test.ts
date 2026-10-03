import { describe, expect, it } from 'vitest'
import { DUNG_NHAM_BURN_DEFINITION } from './ZoneDotBuffs'

// Completion plan Task 7 Step 2 - structural assertions cho dot buff
// definition thay Lava Zone (Dung Nham reaction). coefficient quy doi tu
// cong thuc he song (Task 6 survey):
//   - Dung Nham: spawnLavaZone damagePerTick 20 CO DINH (ElementReaction.ts),
//     khong might-scaling -> baseline might 10 (StatBlock.ts) -> 20/10 = 2.0
//     (damage/tick tai baseline giu nguyen 20).
// (Kiem Tran anchor removed - Kiem Tu Reimagined spec 2026-09-15 sec7.)
// Duration giu nguyen SO (no-rebalance policy): 6 luot.
// M4: same numbers asserted in the canonical periodic recipe.

describe('ZoneDotBuffs zone-as-dot definitions', () => {
  it('dung_nham_burn — fire periodic coefficient 2.0, 6 holder-turns, polarity debuff', () => {
    expect(DUNG_NHAM_BURN_DEFINITION.id).toBe('dung_nham_burn')
    expect(DUNG_NHAM_BURN_DEFINITION.polarity).toBe('debuff')
    expect(DUNG_NHAM_BURN_DEFINITION.stacking.onReapplyStacks).toBe('keep')
    expect(DUNG_NHAM_BURN_DEFINITION.lifetime).toMatchObject({ clock: 'holder_turns', duration: 6 })

    const periodic = DUNG_NHAM_BURN_DEFINITION.periodic
    expect(periodic).toHaveLength(1)
    const p = periodic![0]!
    if (p.type !== 'damage') throw new Error('expected damage periodic')
    expect(p.coefficient).toBe(2.0)
    expect(p.element).toBe('fire')
    expect(p.damageProfile).toBe('legacy_dot')
  })
})
