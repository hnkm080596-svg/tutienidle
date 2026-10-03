// Tam Phap progression lock (2026-10-03): the technique surface stays
// sealed until the player has broken through to Luyen Khi AND committed
// a pathway - both conditions verified independently.
import { describe, expect, it } from 'vitest'
import { isBetaTechniqueSurfaceUnlocked } from './betaScopeTechniqueDomain'

describe('isBetaTechniqueSurfaceUnlocked', () => {
  it('seals a mortal player even when a corrupt save claims a way', () => {
    expect(isBetaTechniqueSurfaceUnlocked({
      realmId: 'mortal',
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
    })).toBe(false)
  })

  it('seals a qi_refining player who has not committed a pathway', () => {
    expect(isBetaTechniqueSurfaceUnlocked({
      realmId: 'qi_refining',
      cultivationPath: undefined,
      cultivationWay: undefined,
    })).toBe(false)
    // A catalog-less way id resolves no definition - still sealed.
    expect(isBetaTechniqueSurfaceUnlocked({
      realmId: 'qi_refining',
      cultivationPath: 'sword',
      cultivationWay: 'bogus_way' as never,
    })).toBe(false)
  })

  it('opens once the player reached Luyen Khi and committed a way', () => {
    expect(isBetaTechniqueSurfaceUnlocked({
      realmId: 'qi_refining',
      cultivationPath: 'sword',
      cultivationWay: 'sword_pathway',
    })).toBe(true)
    expect(isBetaTechniqueSurfaceUnlocked({
      realmId: 'foundation_establishment',
      cultivationPath: 'spell',
      cultivationWay: 'spell_pathway',
    })).toBe(true)
  })
})
