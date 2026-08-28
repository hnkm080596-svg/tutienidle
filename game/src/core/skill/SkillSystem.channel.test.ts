import { describe, expect, it } from 'vitest'
import { usesCooldownClockForTest } from './SkillSystem'

describe("execution policy 'channel'", () => {
  it('channel KHÔNG dùng cooldown clock (không CDR, không CD)', () => {
    expect(usesCooldownClockForTest({ kind: 'channel', tickSeconds: 3 })).toBe(false)
  })
})
