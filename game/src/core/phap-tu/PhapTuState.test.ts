import { describe, expect, it } from 'vitest'
import { createSpellPathState } from './PhapTuState'
import { createDefaultPlayer } from '../player/Player'

describe('SpellPathState', () => {
  it('defaults: no element committed', () => {
    expect(createSpellPathState()).toEqual({ element: null })
  })

  it('player factory carries spellPath state', () => {
    expect(createDefaultPlayer().spellPath).toEqual(createSpellPathState())
  })
})
