import { describe, expect, it } from 'vitest'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { localCellToAbsolute } from './FormationPlacement'

describe('DEFAULT_PARTY_FORMATION', () => {
  it('places the player at the center standing slot, matching formation placement', () => {
    const center = localCellToAbsolute({ row: 1, column: 1 })
    expect(DEFAULT_PARTY_FORMATION).toEqual([
      { combatantId: 'player', row: center.row, column: center.column },
    ])
    expect(center).toEqual({ row: 5, column: 2 })
  })
})
