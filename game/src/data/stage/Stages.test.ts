import { describe, expect, it } from 'vitest'
import { STAGES } from './Stages'

describe('stage encounter scaling', () => {
  it('tăng tuyến tính số quái từ tầng 1 đến tầng 10 ở mọi chapter', () => {
    for (const chapter of [1, 2, 3]) {
      const stages = STAGES
        .filter(stage => stage.chapter === chapter)
        .sort((left, right) => (left.floor ?? 0) - (right.floor ?? 0))

      expect(stages).toHaveLength(10)
      expect(stages.map(stage => stage.totalEnemyCount)).toEqual(
        Array.from({ length: 10 }, (_, index) => 10 + index),
      )
    }
  })

  it('gán đầy đủ tầng hiển thị, kể cả tầng đầu vốn bỏ trống requiredRealmLevel', () => {
    expect(STAGES.every(stage => stage.floor !== undefined)).toBe(true)
  })
})
