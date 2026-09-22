import { describe, expect, it } from 'vitest'
import { createDefaultPlayer } from '../player/Player'
import { getSkillCoreLevel, getSkillCoreUpgradeCost, skillCoreNodeId } from './SkillCoreLevel'

// M-QI-05 / QI-D3 - player.nodeLevels[core_<skillId>] is the ONLY
// writable skill-level authority. This leaf owns the id convention,
// the raw level read, and the frozen Insight cost curve (5 + 3x(L-1),
// re-homed verbatim from the retired SkillUpgradeBalance).

describe('skillCoreNodeId', () => {
  it('canonical convention core_<skillId>', () => {
    expect(skillCoreNodeId('tram')).toBe('core_tram')
    expect(skillCoreNodeId('orb_dam')).toBe('core_orb_dam')
    expect(skillCoreNodeId('ngu_kiem_thuat')).toBe('core_ngu_kiem_thuat')
  })
})

describe('getSkillCoreLevel', () => {
  it('reads nodeLevels[core_<id>] — 0 when ungranted', () => {
    const player = createDefaultPlayer()

    expect(getSkillCoreLevel(player, 'tram')).toBe(0)

    player.nodeLevels = { core_tram: 3 }

    expect(getSkillCoreLevel(player, 'tram')).toBe(3)
    expect(getSkillCoreLevel(player, 'linh_bao')).toBe(0)
  })
})

describe('getSkillCoreUpgradeCost', () => {
  it('frozen curve 5 + 3x(L-1)', () => {
    expect(getSkillCoreUpgradeCost(1)).toBe(5)
    expect(getSkillCoreUpgradeCost(2)).toBe(8)
    expect(getSkillCoreUpgradeCost(3)).toBe(11)
    expect(getSkillCoreUpgradeCost(9)).toBe(29)
  })

  it('level 0 prices like level 1 (grant never pays, defensive read)', () => {
    expect(getSkillCoreUpgradeCost(0)).toBe(5)
  })
})
