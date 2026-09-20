import { describe, expect, it } from 'vitest'
import { buffDisplayName } from './BuffNames'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'

describe('buffDisplayName', () => {
  it('returns the registry name for a known buff id', () => {
    expect(buffDisplayName('hoa_an')).toBe(BUFF_REGISTRY.get('hoa_an').name)
  })

  it('falls back to the raw id for an unknown buff id without throwing', () => {
    expect(() => buffDisplayName('definitely_not_a_buff_id')).not.toThrow()
    expect(buffDisplayName('definitely_not_a_buff_id')).toBe('definitely_not_a_buff_id')
  })
})
