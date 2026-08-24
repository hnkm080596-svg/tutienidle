import { describe, expect, it } from 'vitest'
import { isValidLoginId, isValidPassword } from './AuthService'

describe('AuthService validation', () => {
  it.each(['dao_huu', 'Abc1', 'player_2026'])('accepts valid login ID %s', value => {
    expect(isValidLoginId(value)).toBe(true)
  })

  it.each(['abc', 'đạo_hữu', 'white space', 'name!', 'a'.repeat(21)])('rejects invalid login ID %s', value => {
    expect(isValidLoginId(value)).toBe(false)
  })

  it('requires at least six password characters', () => {
    expect(isValidPassword('12345')).toBe(false)
    expect(isValidPassword('123456')).toBe(true)
  })
})
