// Turn-Based Combat Completion (Task 4) — fold TurnStatModifierEffect
// đang active trên TurnBuffPool thành StatModifier[] rồi tính QUA
// calculateEffectiveStats(): 1 pass trên ALREADY-RESOLVED base, KHÔNG
// derive lại attribute (R2 / AR-02 — calculateStats() giữ quyền derive
// attribute duy nhất, chạy 1 lần khi build entity từ store/enemy data).
// Đây là bridge "buff turn-based → stats hiệu lực" thay cho
// BuffSystem.getActiveModifiers() của hệ real-time.
import type { Stats } from '../../stats/StatBlock'
import type { StatModifier } from '../../stats/StatCalculator'
import { calculateEffectiveStats } from '../../stats/StatCalculator'
import type { TurnBuffPool } from './TurnBuffPool'

export function recomputeEffectiveStats(resolvedBase: Stats, buffs: TurnBuffPool): Stats {
  const modifiers = collectStatModifiers(buffs)

  return calculateEffectiveStats(resolvedBase, modifiers)
}

function collectStatModifiers(buffs: TurnBuffPool): StatModifier[] {
  const modifiers: StatModifier[] = []

  for (const buff of buffs.getAll()) {
    for (const effect of buff.effects) {
      if (effect.type === 'statModifier') {
        modifiers.push({
          id: `buff:${buff.id}:${buff.sourceId}:${effect.stat}`,
          sourceId: buff.sourceId,
          sourceType: buff.polarity,
          stat: effect.stat,
          flat: effect.flat,
          percent: effect.percent,
          stacks: buff.stacks,
        })
      }
    }
  }

  return modifiers
}
