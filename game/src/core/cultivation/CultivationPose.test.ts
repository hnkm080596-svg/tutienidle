import { describe, expect, it } from 'vitest'
import { isCultivationPoseActive } from './CultivationPose'

describe('cultivation pose', () => {
  it('đứng chiến đấu trong battle và trở lại tu luyện sau battle', () => {
    expect(isCultivationPoseActive(true)).toBe(false)
    expect(isCultivationPoseActive(false)).toBe(true)
  })
})
