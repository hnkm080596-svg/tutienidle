import { describe, expect, it } from 'vitest'
import { TALENT_BUFFS } from './TalentBuffs'
import { TALENT_PASSIVE_SKILLS } from '../skill/TalentPassives'
// CP-01 regression pin - rate stats whose assembled base is 0 make percent
// modifiers dead values (percent * (0 + 0) = 0). These stats must be driven
// through the flat channel or the buff/passive silently does nothing.
const ZERO_BASE_RATE_STATS = new Set([
  'finalDamagePercent',
  'finalDamageReductionPercent',
  'criticalAvoidance',
  'metalPenetration',
])

type ModifierLike = { stat: string; flat?: number; percent?: number }

function modifiersOf(list: readonly { statModifiers?: readonly ModifierLike[]; passiveModifiers?: readonly ModifierLike[] }[]) {
  return list.flatMap((entry) => [
    ...(entry.statModifiers ?? []),
    ...(entry.passiveModifiers ?? []),
  ])
}

const ALL_MODIFIERS = [...modifiersOf(TALENT_BUFFS), ...modifiersOf(TALENT_PASSIVE_SKILLS)]

describe('TalentBuffs / TalentPassives zero-base stat channel (CP-01)', () => {
  it('no nonzero modifier on a zero-base rate stat uses the percent channel', () => {
    const violations = ALL_MODIFIERS.filter(
      (m) => ZERO_BASE_RATE_STATS.has(m.stat) && m.percent !== undefined && m.percent !== 0,
    )
    expect(violations).toEqual([])
  })

  it('every modifier on a zero-base rate stat uses flat', () => {
    const missing = ALL_MODIFIERS.filter(
      (m) => ZERO_BASE_RATE_STATS.has(m.stat) && m.flat === undefined && m.percent !== 0,
    )
    expect(missing).toEqual([])
  })
})
