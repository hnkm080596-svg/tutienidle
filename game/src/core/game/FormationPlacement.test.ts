import { describe, expect, it } from 'vitest'
import { localCellToAbsolute, resolvePartyFormation } from './FormationPlacement'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { createDefaultPlayer } from '../player/Player'

describe('localCellToAbsolute', () => {
  it('maps local (0,0) to PLAYER_SIDE_REGION\'s top-left corner (row 3, column 0)', () => {
    expect(localCellToAbsolute({ row: 0, column: 0 })).toEqual({ row: 3, column: 0 })
  })

  it('maps local (5,5) to PLAYER_SIDE_REGION\'s bottom-right corner (row 8, column 5)', () => {
    expect(localCellToAbsolute({ row: 5, column: 5 })).toEqual({ row: 8, column: 5 })
  })
})

describe('resolvePartyFormation', () => {
  it('falls back to DEFAULT_PARTY_FORMATION when player.formationLoadout is null', () => {
    const player = createDefaultPlayer()

    expect(resolvePartyFormation(player)).toEqual(DEFAULT_PARTY_FORMATION)
  })

  it('resolves a configured formationLoadout into absolute PartyFormationSlot positions', () => {
    const player = createDefaultPlayer()

    player.formationLoadout = {
      formationId: 'test_formation',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 2, column: 3, combatantId: 'companion_a' },
      ],
    }

    expect(resolvePartyFormation(player)).toEqual([
      { combatantId: 'player', row: 3, column: 0 },
      { combatantId: 'companion_a', row: 5, column: 3 },
    ])
  })
})
