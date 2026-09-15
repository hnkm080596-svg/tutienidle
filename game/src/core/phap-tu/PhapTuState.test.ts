import { describe, expect, it } from 'vitest'
import { createPhapTuState } from './PhapTuState'
import { createDefaultPlayer } from '../player/Player'

describe('PhapTuState', () => {
  it('defaults: no element, null route', () => {
    expect(createPhapTuState()).toEqual({ element: null, route: null })
  })

  it('player factory carries phapTu state', () => {
    expect(createDefaultPlayer().phapTu).toEqual(createPhapTuState())
  })
})
