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
    ['mortal', 1, 1],
    ['mortal', 11, 11],
    ['mortal', 12, 12],
    ['mortal', 17, 17],
    ['qi_refining', 1, 22],
    ['qi_refining', 11, 32],
    ['qi_refining', 17, 38],
    ['foundation_establishment', 1, 64],
    ['foundation_establishment', 11, 74],
    ['foundation_establishment', 17, 80],
  ])('%s level %i needs %i minutes', (realmId, level, minutes) => {
    expect(getCultivationDurationSeconds(realmId, level)).toBe(minutes * 60)
    expect(getRequiredCultivation(realmId, level)).toBe(minutes * 60 * BASE_CULTIVATION_PER_SECOND)
  })

  it.each([
    ['mortal', 66, 153],
    ['qi_refining', 297, 510],
    ['foundation_establishment', 759, 1224],
  ])('%s keeps core and extended totals independent', (realmId, coreMinutes, fullMinutes) => {
    const sumThrough = (lastSourceLevel: number) => Array.from(
      { length: lastSourceLevel },
      (_, index) => getCultivationDurationSeconds(realmId, index + 1) / 60,
    ).reduce((sum, minutes) => sum + minutes, 0)

    expect(sumThrough(11)).toBe(coreMinutes)
    expect(sumThrough(17)).toBe(fullMinutes)
  })

  it.each(['mortal', 'qi_refining', 'foundation_establishment'])('%s advances to 18 and stops', realmId => {
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

  it('đột phá tiểu cảnh giới cấp attributePoints nhưng KHÔNG còn cấp skillInsight (skill-insight-and-auto-combat-hud-plan.md mục 1)', () => {
    const player = createDefaultPlayer()
    const required = getRequiredCultivation(player.realmId, player.realmLevel)

    addCultivation(player, required)

    expect(breakthrough(player)).toBe(true)
    expect(player.attributePoints).toBe(1)
    expect(player.skillInsight).toBe(0)
  })
})
