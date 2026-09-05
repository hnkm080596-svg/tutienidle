import { describe, expect, it } from 'vitest'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { HERO_LANE_INDEX, HERO_COLUMN } from '../battle/BattleLane'

describe('DEFAULT_PARTY_FORMATION', () => {
  it('is exactly one slot: the player at the current fixed hero position', () => {
    expect(DEFAULT_PARTY_FORMATION).toEqual([
      { combatantId: 'player', row: HERO_LANE_INDEX, column: HERO_COLUMN },
    ])
  })
})
