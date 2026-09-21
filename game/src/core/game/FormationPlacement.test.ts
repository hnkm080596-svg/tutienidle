import { describe, expect, it } from 'vitest'
import { commitFormationLoadout, localCellToAbsolute, resolvePartyFormation } from './FormationPlacement'
import { DEFAULT_PARTY_FORMATION } from './PartyFormation'
import { createDefaultPlayer } from '../player/Player'
import type { CompanionInstance } from '../../data/companion/Companions'
import { GameManager } from './GameManager'

function ownedCompanion(definitionId: string): CompanionInstance {
  return {
    instanceId: `inst-${definitionId}`,
    definitionId,
    realmId: 'mortal',
    realmLevel: 1,
    exp: 0,
    constellationRank: 0,
  }
}

// P7-M9 (decisions D3 + M9-F1): formation commits require the unlocked domain
// (Tru Co+); resolvePartyFormation stays ungated so grandfathered
// loadouts still resolve.
function unlockedPlayer() {
  const player = createDefaultPlayer()
  player.realmId = 'foundation_establishment'
  return player
}

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

// F4 (architecture-qa-repairs) - formationLoadout commits must pass through
// the validating owner; the panel used to write the field directly, so a
// stale draft could persist rows battle construction would silently skip.
describe('commitFormationLoadout', () => {
  it('rejects an unknown formationId without touching formationLoadout', () => {
    const player = unlockedPlayer()

    expect(
      commitFormationLoadout(player, { formationId: 'khong_ton_tai', assignments: [] }),
    ).toBe(false)
    expect(player.formationLoadout).toBeNull()
  })

  it('rejects a combatantId that is neither player nor an owned companion', () => {
    const player = unlockedPlayer()

    expect(
      commitFormationLoadout(player, {
        formationId: 'doc_hanh_tran',
        assignments: [{ row: 1, column: 2, combatantId: 'ghost_companion' }],
      }),
    ).toBe(false)
    expect(player.formationLoadout).toBeNull()
  })

  it('rejects an assignment outside the formation cellPattern', () => {
    const player = unlockedPlayer()

    // doc_hanh_tran lights exactly one cell: { row: 1, column: 2 }.
    expect(
      commitFormationLoadout(player, {
        formationId: 'doc_hanh_tran',
        assignments: [{ row: 0, column: 0, combatantId: 'player' }],
      }),
    ).toBe(false)
    expect(player.formationLoadout).toBeNull()
  })

  it('rejects a duplicate combatantId', () => {
    const player = unlockedPlayer()

    expect(
      commitFormationLoadout(player, {
        formationId: 'luong_nghi_tran',
        assignments: [
          { row: 1, column: 0, combatantId: 'player' },
          { row: 1, column: 2, combatantId: 'player' },
        ],
      }),
    ).toBe(false)
    expect(player.formationLoadout).toBeNull()
  })

  it('rejects two combatants stacked on the same cell', () => {
    const player = unlockedPlayer()
    player.companions = [ownedCompanion('ho_ly_tinh')]

    expect(
      commitFormationLoadout(player, {
        formationId: 'doc_hanh_tran',
        assignments: [
          { row: 1, column: 2, combatantId: 'player' },
          { row: 1, column: 2, combatantId: 'ho_ly_tinh' },
        ],
      }),
    ).toBe(false)
    expect(player.formationLoadout).toBeNull()
  })

  it('commits a legal loadout as a detached copy', () => {
    const player = unlockedPlayer()
    player.companions = [ownedCompanion('ho_ly_tinh')]

    const draft = {
      formationId: 'luong_nghi_tran',
      assignments: [
        { row: 1, column: 0, combatantId: 'ho_ly_tinh' },
        { row: 1, column: 2, combatantId: 'player' },
      ],
    }

    expect(commitFormationLoadout(player, draft)).toBe(true)
    expect(player.formationLoadout).toEqual(draft)

    // Detached copy: mutating the caller's draft afterwards must not leak
    // into the committed loadout.
    draft.assignments.push({ row: 0, column: 0, combatantId: 'player' })
    draft.assignments[0]!.combatantId = 'tampered'
    expect(player.formationLoadout?.assignments).toHaveLength(2)
    expect(player.formationLoadout?.assignments[0]?.combatantId).toBe('ho_ly_tinh')
  })
})

describe('GameManagerTurnBattleOps.setFormationLoadout', () => {
  it('exposes the validating commit through gameManager.turnBattleOps', () => {
    const gameManager = new GameManager()
    const player = unlockedPlayer()
    gameManager.setActivePlayer(player)

    expect(
      gameManager.turnBattleOps.setFormationLoadout(player, {
        formationId: 'doc_hanh_tran',
        assignments: [{ row: 1, column: 2, combatantId: 'player' }],
      }),
    ).toBe(true)
    expect(player.formationLoadout?.formationId).toBe('doc_hanh_tran')

    expect(
      gameManager.turnBattleOps.setFormationLoadout(player, {
        formationId: 'bogus_formation',
        assignments: [],
      }),
    ).toBe(false)
    expect(player.formationLoadout?.formationId).toBe('doc_hanh_tran')
  })
})

// P7-M9 (decisions D3 + M9-F1): Tran Phap unlocks at Tru Co with the companion
// domain. The commit rejects below the threshold without touching state;
// resolvePartyFormation is NOT gated, so a grandfathered loadout keeps
// resolving in combat.
describe('formation realm gate', () => {
  const LEGAL_LOADOUT = {
    formationId: 'doc_hanh_tran',
    assignments: [{ row: 1, column: 2, combatantId: 'player' }],
  }

  it.each(['mortal', 'qi_refining'])('rejects commits at %s without touching formationLoadout', (realmId) => {
    const player = createDefaultPlayer()
    player.realmId = realmId

    expect(commitFormationLoadout(player, LEGAL_LOADOUT)).toBe(false)
    expect(player.formationLoadout).toBeNull()
  })

  it('accepts the same commit at foundation_establishment', () => {
    const player = unlockedPlayer()

    expect(commitFormationLoadout(player, LEGAL_LOADOUT)).toBe(true)
    expect(player.formationLoadout?.formationId).toBe('doc_hanh_tran')
  })

  it('resolvePartyFormation still resolves a grandfathered loadout at mortal', () => {
    const player = createDefaultPlayer()

    player.formationLoadout = {
      formationId: 'doc_hanh_tran',
      assignments: [{ row: 1, column: 2, combatantId: 'player' }],
    }

    expect(resolvePartyFormation(player)).toEqual([{ combatantId: 'player', row: 5, column: 4 }])
  })
})
