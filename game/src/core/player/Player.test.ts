import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from './Player'

describe('createDefaultPlayer — companions field', () => {
  it('initializes companions as an empty array (never undefined)', () => {
    const player = createDefaultPlayer()

    expect(player.companions).toEqual([])
  })
})
