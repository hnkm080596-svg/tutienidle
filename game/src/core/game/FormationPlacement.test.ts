import { describe, expect, it } from 'vitest'
import { localCellToAbsolute, resolvePartyFormation } from './FormationPlacement'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { createDefaultPlayer } from '../player/Player'

describe('localCellToAbsolute', () => {
  it('converts local slot (0,0) to the region origin', () => {
    expect(localCellToAbsolute({ row: 0, column: 0 })).toEqual({ row: 3, column: 0 })
  })

  it('converts local slot (2,2) to the far corner of the player standing-slot grid', () => {
    expect(localCellToAbsolute({ row: 2, column: 2 })).toEqual({ row: 7, column: 4 })
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
        { row: 2, column: 1, combatantId: 'companion_a' },
      ],
    }

    expect(resolvePartyFormation(player)).toEqual([
      { combatantId: 'player', row: 3, column: 0 },
      { combatantId: 'companion_a', row: 7, column: 2 },
    ])
  })
})
