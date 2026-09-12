import { describe, expect, it } from 'vitest'
import { addCultivation, breakthrough, canBreakthrough } from './CultivationSystem'
import { createDefaultPlayer } from '../player/Player'
import { getRequiredCultivation } from '../realm/realmSystem'

// Talent v4 M2 — Hai Nap (spec §4.3 row 19): cultivation that would
// overflow past the level cap banks into cultivationOvercharge and pours
// into the next tier on breakthrough. Without the talent the existing
// clamp-at-required behavior is preserved.
describe('CultivationSystem — Hai Nap overflow bank', () => {
  it('with hai_na: overflow past required banks into cultivationOvercharge', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['hai_na']

    const required = getRequiredCultivation(player.realmId, player.realmLevel)

    addCultivation(player, required + 500)

    expect(player.cultivation).toBe(required)
    expect(player.cultivationOvercharge).toBe(500)
  })

  it('without the talent: overflow is discarded exactly as before', () => {
    const player = createDefaultPlayer()

    const required = getRequiredCultivation(player.realmId, player.realmLevel)

    addCultivation(player, required + 500)

    expect(player.cultivation).toBe(required)
    expect(player.cultivationOvercharge).toBe(0)
  })

  it('with hai_na: breakthrough pours the bank into the new tier', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['hai_na']
    player.realmId = 'mortal'
    player.realmLevel = 1

    const requiredT1 = getRequiredCultivation('mortal', 1)
    const requiredT2 = getRequiredCultivation('mortal', 2)

    addCultivation(player, requiredT1 + 400)
    expect(canBreakthrough(player)).toBe(true)
    expect(breakthrough(player)).toBe(true)

    expect(player.realmLevel).toBe(2)
    expect(player.cultivation).toBe(Math.min(400, requiredT2))
    expect(player.cultivationOvercharge).toBe(Math.max(0, 400 - requiredT2))
  })

  it('bank pouring still respects the new tier cap — no multi-tier jump', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['hai_na']
    player.realmId = 'mortal'
    player.realmLevel = 1

    const requiredT1 = getRequiredCultivation('mortal', 1)

    // Bank far more than one tier's requirement.
    player.cultivation = requiredT1
    player.cultivationOvercharge = requiredT1 * 10

    expect(breakthrough(player)).toBe(true)
    expect(player.realmLevel).toBe(2)
    expect(player.cultivation).toBe(getRequiredCultivation('mortal', 2))
    // Leftover stays banked rather than skipping another tier.
    expect(player.cultivationOvercharge).toBeGreaterThan(0)
  })
})
