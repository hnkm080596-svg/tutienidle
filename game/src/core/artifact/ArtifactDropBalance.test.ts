import { describe, expect, it } from 'vitest'
import {
  ARTIFACT_STONE_BOSS_QUANTITY_MAX,
  ARTIFACT_STONE_BOSS_QUANTITY_MIN,
  ARTIFACT_STONE_DROP_CHANCE,
} from './ArtifactDropBalance'

describe('ArtifactDropBalance (doc §6)', () => {
  it('tỉ lệ rơi đúng thứ tự Thường < Tinh Anh < Boss', () => {
    expect(ARTIFACT_STONE_DROP_CHANCE.normal).toBe(0.02)
    expect(ARTIFACT_STONE_DROP_CHANCE.elite).toBe(0.08)
    expect(ARTIFACT_STONE_DROP_CHANCE.boss).toBe(0.25)

    expect(ARTIFACT_STONE_DROP_CHANCE.normal).toBeLessThan(ARTIFACT_STONE_DROP_CHANCE.elite)
    expect(ARTIFACT_STONE_DROP_CHANCE.elite).toBeLessThan(ARTIFACT_STONE_DROP_CHANCE.boss)
  })

  it('số lượng Boss là 1-2', () => {
    expect(ARTIFACT_STONE_BOSS_QUANTITY_MIN).toBe(1)
    expect(ARTIFACT_STONE_BOSS_QUANTITY_MAX).toBe(2)
  })
})
