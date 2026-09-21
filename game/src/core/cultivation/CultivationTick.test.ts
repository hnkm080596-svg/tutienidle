// P6-M1 - cultivateTick is the framework-neutral production cultivation
// step shared by the Pinia `cultivate()` action and EarlyGameSession.
// These tests pin the semantics the extraction must preserve: talent
// speed, realm ramp, timed modifiers, the cultivationPerSecond snapshot,
// lifetime accrual, and insight conversion.
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import { getRequiredCultivation, BASE_CULTIVATION_PER_SECOND } from '../realm/realmSystem'
import { breakthrough } from './CultivationSystem'
import { cultivateTick } from './CultivationTick'

const NOW = 1_700_000_000_000

describe('cultivateTick', () => {
  it('no talents: per-second = BASE, writes the snapshot, accrues lifetime', () => {
    const player = createDefaultPlayer()
    const gained = cultivateTick(player, 10, NOW)

    expect(player.cultivationPerSecond).toBe(BASE_CULTIVATION_PER_SECOND)
    expect(gained).toBe(BASE_CULTIVATION_PER_SECOND * 10)
    expect(player.cultivation).toBe(gained)
    expect(player.totalCultivationGained).toBe(gained)
  })

  it('clamps at required: gained reflects the actual write', () => {
    const player = createDefaultPlayer()
    const required = getRequiredCultivation(player.realmId, player.realmLevel)
    player.cultivation = required - 1

    const gained = cultivateTick(player, 10_000, NOW)
    expect(gained).toBe(1)
    expect(player.cultivation).toBe(required)
    expect(player.totalCultivationGained).toBe(1)
  })

  it('pham_cot (-75% speed) still progresses at the guarded floor rate', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['pham_cot']

    const gained = cultivateTick(player, 10, NOW)
    expect(player.cultivationPerSecond).toBeCloseTo(BASE_CULTIVATION_PER_SECOND * 0.25)
    expect(gained).toBeCloseTo(BASE_CULTIVATION_PER_SECOND * 0.25 * 10)
  })

  it('ho_tich_bat_phat: realm ramp multiplies the rate (lvl1 -50%, lvl6 +0%)', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['ho_tich_bat_phat']
    player.realmLevel = 1
    cultivateTick(player, 1, NOW)
    expect(player.cultivationPerSecond).toBeCloseTo(BASE_CULTIVATION_PER_SECOND * 0.5)

    player.realmLevel = 6
    cultivateTick(player, 1, NOW)
    expect(player.cultivationPerSecond).toBeCloseTo(BASE_CULTIVATION_PER_SECOND * 1.0)
  })

  it('tu_linh_tran timed effect applies only while expiresAtMs > now', () => {
    const player = createDefaultPlayer()
    player.persistentTimedEffects = [
      {
        id: 'fx1', sourceItemId: 'x', effectGroup: 'tu_linh_tran',
        appliedAtMs: NOW, expiresAtMs: NOW + 60_000,
        modifiers: [], cultivationSpeedPercent: 0.5,
      },
      {
        id: 'fx2', sourceItemId: 'x', effectGroup: 'tu_linh_tran',
        appliedAtMs: NOW, expiresAtMs: NOW - 1, // expired at `now`
        modifiers: [], cultivationSpeedPercent: 1.0,
      },
      {
        id: 'fx3', sourceItemId: 'x', effectGroup: 'other_group', // ignored
        appliedAtMs: NOW, expiresAtMs: NOW + 60_000,
        modifiers: [], cultivationSpeedPercent: 9,
      },
    ]

    cultivateTick(player, 1, NOW)
    expect(player.cultivationPerSecond).toBeCloseTo(BASE_CULTIVATION_PER_SECOND * 1.5)
  })

  it('ngo_dao: insight accrues at the 2000-cultivation threshold with rollover', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['ngo_dao']

    // Per-tick gain clamps at the level's required (mortal:1 = 600), so
    // accrual crosses levels: fill -> breakthrough -> fill.
    let guard = 0
    while (player.skillInsight === 0 && guard++ < 10) {
      const required = getRequiredCultivation(player.realmId, player.realmLevel)
      cultivateTick(player, required / player.cultivationPerSecond + 1, NOW)
      if (player.cultivation >= required) breakthrough(player)
    }

    expect(player.skillInsight).toBe(1)
    expect(player.totalSkillInsightGained).toBe(1)
    expect(player.cultivationInsightAccumulator).toBeGreaterThanOrEqual(0)
    expect(player.cultivationInsightAccumulator).toBeLessThan(2000)
  })

  it('hap_linh (combat passive) does not subsidize cultivation or insight', () => {
    const player = createDefaultPlayer()
    player.selectedTalentIds = ['hap_linh']
    const gained = cultivateTick(player, 10, NOW)

    expect(player.cultivationPerSecond).toBe(BASE_CULTIVATION_PER_SECOND)
    expect(player.skillInsight).toBe(0)
    expect(gained).toBe(BASE_CULTIVATION_PER_SECOND * 10)
  })
})
