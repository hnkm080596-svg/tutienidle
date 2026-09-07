import { describe, expect, it } from 'vitest'
import { buffDisplayName } from './TurnBuffNames'
import { TURN_BUFF_REGISTRY } from '../../../data/buff/TurnBuffRegistry'

// Phase A6 (2026-09-08) — throw-safe display-name resolver for buff
// badges. TURN_BUFF_REGISTRY.get() THROWS on unknown ids; presentation
// code needs a soft fallback (raw id) instead.

describe('buffDisplayName', () => {
  it('returns the registry name for a known buff id', () => {
    expect(buffDisplayName('bong')).toBe(TURN_BUFF_REGISTRY.get('bong').name)
  })

  it('falls back to the raw id for an unknown buff id without throwing', () => {
    expect(() => buffDisplayName('definitely_not_a_buff_id')).not.toThrow()
    expect(buffDisplayName('definitely_not_a_buff_id')).toBe('definitely_not_a_buff_id')
  })
})
