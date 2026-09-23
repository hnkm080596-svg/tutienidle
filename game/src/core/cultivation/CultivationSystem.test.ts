import { describe, expect, it } from 'vitest'
import { addCultivation, breakthrough, canBreakthrough } from './CultivationSystem'
import { createDefaultPlayer } from '../player/Player'
import { REALMS } from '../../data/realms/realm'
import {
  BASE_CULTIVATION_PER_SECOND,
  BASE_CULTIVATION_UNIT_SECONDS,
  EXTENDED_REALM_LEVEL,
  getRequiredCultivation,
} from '../realm/realmSystem'

describe('Cultivation progression curve', () => {
  // Mission G - data contract: each realm declares exactly ONE formula
  // field (minutes-per-level XOR total-duration-budget). The retired
  // baseRequiredCultivation/cultivationMultiplier exponential path is
  // gone; this invariant is the regression net.
  it('every realm declares exactly one cultivation formula field (XOR)', () => {
    expect(
      REALMS.every(
        (realm) =>
          (realm.baseCultivationMinutes !== undefined) !==
          (realm.realmDurationMultiplier !== undefined),
      ),
    ).toBe(true)
  })

  // M-F-REALM18 (ruling section 1) - every major Realm = 18 minor
  // levels; the KD+ rows normalized from the old 9-tier cap.
  it('every major realm declares 18 minor levels', () => {
    expect(REALMS.every((realm) => realm.maxLevel === EXTENDED_REALM_LEVEL)).toBe(true)
  })

  it('pinned outputs — budget formula and mortal minutes unchanged', () => {
    expect(getRequiredCultivation('golden_core', 1)).toBe(1_025_365)
    expect(getRequiredCultivation('mortal', 1)).toBe(60 * BASE_CULTIVATION_PER_SECOND)
  })

  it.each([
    ['golden_core', 90],
    ['nascent_soul', 270],
    ['soul_transformation', 810],
    ['void_refinement', 2430],
    ['body_integration', 7290],
    ['mahayana', 21870],
    ['tribulation', 65610],
  ])('%s re-splits its unchanged %ix time budget across all 18 tiers', (realmId, multiplier) => {
    const budget = multiplier * BASE_CULTIVATION_UNIT_SECONDS * BASE_CULTIVATION_PER_SECOND
    const sum = Array.from(
      { length: EXTENDED_REALM_LEVEL },
      (_, index) => getRequiredCultivation(realmId, index + 1),
    ).reduce((total, required) => total + required, 0)

    // Per-level Math.floor drops < 1 unit each, so the sum stays below
    // the budget by less than the tier count.
    expect(sum).toBeLessThanOrEqual(budget)
    expect(budget - sum).toBeLessThan(EXTENDED_REALM_LEVEL)
  })

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
    expect(getRequiredCultivation(realmId, level)).toBe(minutes * 60 * BASE_CULTIVATION_PER_SECOND)
  })

  it.each([
    ['mortal', 66, 153],
    ['qi_refining', 297, 510],
    ['foundation_establishment', 759, 1224],
  ])('%s keeps core and extended totals independent', (realmId, coreMinutes, fullMinutes) => {
    const sumThrough = (lastSourceLevel: number) => Array.from(
      { length: lastSourceLevel },
      (_, index) => getRequiredCultivation(realmId, index + 1) / BASE_CULTIVATION_PER_SECOND / 60,
    ).reduce((sum, minutes) => sum + minutes, 0)

    expect(sumThrough(11)).toBe(coreMinutes)
    expect(sumThrough(17)).toBe(fullMinutes)
  })

  it.each(REALMS.map((realm) => realm.id))('%s advances to 18 and stops', realmId => {
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
