import { describe, expect, it } from 'vitest'
import { toTurnBuffDefinition, TURN_BUFF_REGISTRY } from './TurnBuffRegistry'
import type { BuffDefinition } from '../../core/buff/BuffDefinition'
import { buffs as LIVE_BUFFS } from './buffs'

// Completion plan Task 13 — migrate 46 real BuffDefinition →
// TurnBuffDefinition. No-rebalance: duration GIỮ NGUYÊN SỐ (giây → lượt),
// convertsAfterContinuousSeconds → convertsAfterContinuousTurns, mọi effect
// field khác copy nguyên vẹn (TurnBuffTypes effect shapes 1:1 với BuffTypes).

const SAMPLE: BuffDefinition = {
  id: 'sample_buff',
  name: 'Sample',
  description: 'desc',
  polarity: 'buff',
  duration: 6,
  stackMode: 'refresh',
  convertsToId: 'other',
  convertsAfterContinuousSeconds: 3,
  effects: [
    { type: 'statModifier', stat: 'attack', percent: -0.15 },
    { type: 'dot', dpsRatio: 0.5, element: 'fire', armorIgnorePercentByRealm: true },
    { type: 'cc', ccEffect: 'stun' },
    { type: 'onHitProc', chance: 0.2, appliesBuffId: 'other' },
  ],
}

describe('toTurnBuffDefinition', () => {
  it('converts duration/converts fields seconds→turns, keeps the SAME number', () => {
    const converted = toTurnBuffDefinition(SAMPLE)

    expect(converted.duration).toBe(6)
    expect(converted.convertsToId).toBe('other')
    expect(converted.convertsAfterContinuousTurns).toBe(3)
    expect('convertsAfterContinuousSeconds' in converted).toBe(false)
  })

  it('copies effects array verbatim (effect template shapes are 1:1)', () => {
    const converted = toTurnBuffDefinition(SAMPLE)

    expect(converted.effects).toEqual(SAMPLE.effects)
  })

  it('copies id/name/description/polarity/hidden/stackMode/maxStacks', () => {
    const converted = toTurnBuffDefinition({
      ...SAMPLE,
      hidden: true,
      maxStacks: 5,
      duration: Infinity,
    })

    expect(converted.id).toBe('sample_buff')
    expect(converted.name).toBe('Sample')
    expect(converted.description).toBe('desc')
    expect(converted.polarity).toBe('buff')
    expect(converted.hidden).toBe(true)
    expect(converted.maxStacks).toBe(5)
    expect(converted.duration).toBe(Infinity)
  })
})

describe('TURN_BUFF_REGISTRY completeness', () => {
  it('every live BuffDefinition id has a converted TurnBuffDefinition entry', () => {
    expect(LIVE_BUFFS.length).toBeGreaterThan(40)

    for (const live of LIVE_BUFFS) {
      const definition = TURN_BUFF_REGISTRY.get(live.id)

      expect(definition, `missing turn buff: ${live.id}`).toBeDefined()
      expect(definition.duration).toBe(live.duration)
      expect(definition.stackMode).toBe(live.stackMode)
      expect(definition.effects.length).toBe(live.effects.length)
    }
  })
})
