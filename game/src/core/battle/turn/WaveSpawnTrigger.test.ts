import { describe, expect, it } from 'vitest'
import { shouldStartNextWave, isStageComplete } from './WaveSpawnTrigger'

describe('shouldStartNextWave', () => {
  it('true khi sân trống, không còn pending, và còn wave chưa spawn', () => {
    expect(shouldStartNextWave(0, 0, 1, 3)).toBe(true)
  })

  it('false khi còn enemy sống', () => {
    expect(shouldStartNextWave(1, 0, 1, 3)).toBe(false)
  })

  it('false khi còn pending telegraph chưa materialize', () => {
    expect(shouldStartNextWave(0, 1, 1, 3)).toBe(false)
  })

  it('false khi đã hết wave (waveIndex >= waveCount)', () => {
    expect(shouldStartNextWave(0, 0, 3, 3)).toBe(false)
  })
})

describe('isStageComplete', () => {
  it('true khi mọi enemy đã spawn, sân trống, không còn pending', () => {
    expect(isStageComplete(5, 5, 0, 0)).toBe(true)
  })

  it('false khi vẫn còn enemy sống, dù đã spawn hết', () => {
    expect(isStageComplete(5, 5, 1, 0)).toBe(false)
  })

  it('false khi còn enemy chưa spawn, dù sân trống', () => {
    expect(isStageComplete(2, 5, 0, 0)).toBe(false)
  })

  it('false khi còn pending telegraph, dù spawnedCount/aliveCount đã đủ điều kiện cũ — regression cho bug "victory fires mid-telegraph"', () => {
    expect(isStageComplete(5, 5, 0, 1)).toBe(false)
  })
})
