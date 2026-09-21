import { describe, expect, it } from 'vitest'
import { createSpellPathState } from './PhapTuState'
import { createDefaultPlayer } from '../player/Player'

describe('SpellPathState', () => {
  it('defaults: no element, null route', () => {
    expect(createSpellPathState()).toEqual({ element: null, route: null })
  })

  it('player factory carries spellPath state', () => {
    expect(createDefaultPlayer().spellPath).toEqual(createSpellPathState())
  })
})
