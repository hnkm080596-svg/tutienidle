import { describe, expect, it } from 'vitest'
import { addCultivation, breakthrough, canBreakthrough } from './CultivationSystem'
import { createDefaultPlayer } from '../player/Player'
import {
  BASE_CULTIVATION_PER_SECOND,
  EXTENDED_REALM_LEVEL,
  getCultivationDurationSeconds,
  getRequiredCultivation,
} from '../realm/realmSystem'

describe('Cultivation progression curve', () => {
  it.each([
    ['pham_nhan', 1, 1],
    ['pham_nhan', 11, 11],
    ['pham_nhan', 12, 12],
    ['pham_nhan', 17, 17],
    ['qi_refining', 1, 22],
    ['qi_refining', 11, 32],
    ['qi_refining', 17, 38],
    ['foundation', 1, 64],
    ['foundation', 11, 74],
    ['foundation', 17, 80],
  ])('%s level %i needs %i minutes', (realmId, level, minutes) => {
    expect(getCultivationDurationSeconds(realmId, level)).toBe(minutes * 60)
    expect(getRequiredCultivation(realmId, level)).toBe(minutes * 60 * BASE_CULTIVATION_PER_SECOND)
  })

  it.each([
    ['pham_nhan', 66, 153],
    ['qi_refining', 297, 510],
    ['foundation', 759, 1224],
  ])('%s keeps core and extended totals independent', (realmId, coreMinutes, fullMinutes) => {
    const sumThrough = (lastSourceLevel: number) => Array.from(
      { length: lastSourceLevel },
      (_, index) => getCultivationDurationSeconds(realmId, index + 1) / 60,
    ).reduce((sum, minutes) => sum + minutes, 0)

    expect(sumThrough(11)).toBe(coreMinutes)
    expect(sumThrough(17)).toBe(fullMinutes)
  })

  it.each(['pham_nhan', 'qi_refining', 'foundation'])('%s advances to 18 and stops', realmId => {
    const player = createDefaultPlayer()
    player.realmId = realmId

    for (let expectedLevel = 1; expectedLevel < EXTENDED_REALM_LEVEL; expectedLevel++) {
      const required = getRequiredCultivation(player.realmId, player.realmLevel)
      addCultivation(player, required)
      expect(canBreakthrough(player)).toBe(true)
      expect(breakthrough(player)).toBe(true)
      expect(player.realmLevel).toBe(expectedLevel + 1)
    }

    const requiredAtCap = getRequiredCultivation(player.realmId, player.realmLevel)
    addCultivation(player, requiredAtCap * 5)

    expect(player.realmLevel).toBe(EXTENDED_REALM_LEVEL)
    expect(player.cultivation).toBe(requiredAtCap)
    expect(breakthrough(player)).toBe(false)
  })

  it('does not accumulate beyond the current threshold', () => {
    const player = createDefaultPlayer()
    const required = getRequiredCultivation(player.realmId, player.realmLevel)
    addCultivation(player, required * 5)
    expect(player.cultivation).toBe(required)
  })
})
