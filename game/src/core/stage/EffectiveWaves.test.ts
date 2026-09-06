import { describe, expect, it } from 'vitest'
import { STAGES } from '@/data/stage/Stages'
import { effectiveTotalEnemyCount } from './EffectiveEnemyCount'
import { effectiveWaves } from './EffectiveWaves'

describe('effectiveWaves() sum invariant (Turn-Based Wave Redesign)', () => {
  it.each(STAGES.map((stage) => stage.id))(
    '%s: sum(effectiveWaves) === effectiveTotalEnemyCount',
    (stageId) => {
      const stage = STAGES.find((candidate) => candidate.id === stageId)!
      const waves = effectiveWaves(stage)
      const sum = waves.reduce((total, count) => total + count, 0)

      expect(sum).toBe(effectiveTotalEnemyCount(stage))
    },
  )
})

describe('effectiveWaves() floor-10 override', () => {
  it('floor 10 stage với bossEnemyId → luôn [1] bất kể waves thô là gì', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'qi_refining_abyssal_pool')!

    expect(stage.floor).toBe(10)
    expect(effectiveWaves(stage)).toEqual([1])
  })

  it('floor khác 10 → trả nguyên waves thô, không override', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'qi_refining_forest')!

    expect(effectiveWaves(stage)).toEqual(stage.waves)
  })
})
