// BLIND-REVIEW probe (2026-10-01 falsification sweep, class 2: hostile
// save shapes). grantedRealmPassiveIds coherence is one-directional
// (marker -> live payload, F-W-9/v82). The reverse direction is never
// checked: a player.modifiers entry of sourceType 'realm' (or any
// sourceType) requires no granting marker, no catalog match, and no
// percent bound. validateStatModifierEntries is shape-only.
//
// Expected: the acceptance layer that hard-fails orphan markers and
// unowned talentLevels should also fail loud on a realm-passive modifier
// whose sourceId was never granted - a forged entry is the same class of
// latent corruption and it silently mints arbitrary stats.
// Actual: validateGameSaveShape accepts the save and
// resolvePlayerStatAssembly emits the forged modifiers verbatim.
import { describe, expect, it } from 'vitest'

import { createDefaultPlayer } from '../../core/player/Player'
import { resolvePlayerStatAssembly } from '../../core/player/Player'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { validateGameSaveShape } from './saveShapeValidation'

function validSave(): Record<string, unknown> {
  return {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

describe('forged player.modifiers mint stats past acceptance', () => {
  it('a realm-sourced modifier with no granted marker validates and emits', () => {
    const save = validSave()
    const player = save.player as ReturnType<typeof createDefaultPlayer>

    player.modifiers.push({
      id: 'realm-passive:forged',
      sourceId: 'nhap_dao',
      sourceType: 'realm',
      stat: 'strength',
      percent: 9,
    })

    // grantedRealmPassiveIds stays empty - no marker for nhap_dao, so
    // acceptance flags the payload and the emit seam resolves it inert.
    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.message.includes('nhap_dao'))).toBe(true)

    const { stats } = resolvePlayerStatAssembly(player, [])
    const baseline = resolvePlayerStatAssembly(createDefaultPlayer(), []).stats
    expect(stats.strength).toBe(baseline.strength)
  })
})
