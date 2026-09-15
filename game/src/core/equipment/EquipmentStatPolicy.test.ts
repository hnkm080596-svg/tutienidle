import { describe, expect, it } from 'vitest'
import { AffixRegistry } from './AffixRegistry'
import {
  EQUIPMENT_FORBIDDEN_STATS,
  EQUIPMENT_SLOT_STAT_POLICY,
  assertValidEquipmentMainStats,
  isValidEquipmentMainStat,
  isValidEquipmentSubstat,
} from './EquipmentStatPolicy'
import { statLabel } from '../stats/StatLabels'
import { affixes } from '../../data/equipment/affixes'
import { equipment } from '../../data/equipment/equipment'
import type { StatType } from '../stats/StatTypes'

// stat-system-reimagined Task 11 (D1, INV-15): speed is the dominant
// tempo stat, so it may never be the only desirable roll in its pool.
// Competitive set = offense amps + crit stats + defense stats.
const SPEED_COMPETITIVE_STATS: ReadonlySet<StatType> = new Set<StatType>([
  // offense amps
  'might',
  'accuracyRating',
  'skillDamagePercent',
  'ailmentPotencyPercent',
  'leechPercent',
  'finalDamagePercent',
  'firePower',
  'woodPower',
  'waterPower',
  'metalPower',
  'earthPower',
  'firePenetration',
  'woodPenetration',
  'waterPenetration',
  'metalPenetration',
  'earthPenetration',
  // crit stats
  'criticalRate',
  'criticalDamage',
  // defense stats
  'maxHp',
  'defense',
  'evasionRate',
  'wardMax',
  'wardRegenPerTurn',
  'blockChance',
  'blockEffectiveness',
  'enduranceThreshold',
  'endurancePercent',
  'thornsPercent',
  'hpRegenPerTurn',
  'criticalAvoidance',
  'ailmentResistPercent',
  'dotResistancePercent',
  'finalDamageReductionPercent',
  'fireResistance',
  'woodResistance',
  'waterResistance',
  'metalResistance',
  'earthResistance',
])

function expectSpeedPoolCompetitive(poolName: string, stats: readonly StatType[]): void {
  if (!stats.includes('speed')) {
    return
  }
  const rivals = stats.filter((stat) => SPEED_COMPETITIVE_STATS.has(stat))
  expect(rivals.length, `${poolName} gives speed no rival roll`).toBeGreaterThanOrEqual(2)
}

describe('EquipmentStatPolicy', () => {
  it('mỗi slot chỉ nhận main stat thuộc bản sắc của slot', () => {
    expect(isValidEquipmentMainStat('weapon', 'might')).toBe(true)
    expect(isValidEquipmentMainStat('helmet', 'maxHp')).toBe(true)
    expect(isValidEquipmentMainStat('armor', 'defense')).toBe(true)
    expect(isValidEquipmentMainStat('boots', 'evasionRate')).toBe(true)
    expect(isValidEquipmentMainStat('ring', 'criticalDamage')).toBe(true)
    expect(isValidEquipmentMainStat('necklace', 'speed')).toBe(true)
    expect(isValidEquipmentMainStat('boots', 'might')).toBe(false)
  })

  it('không cho main stat xuất hiện lại trong substat pool', () => {
    for (const policy of Object.values(EQUIPMENT_SLOT_STAT_POLICY)) {
      expect(policy.mainStats.some((stat) => policy.substats.includes(stat))).toBe(false)
      expect(new Set(policy.substats).size).toBe(policy.substats.length)
    }
  })

  it('mọi stat equipment đều có tên hiển thị chuẩn, không lộ key kỹ thuật', () => {
    for (const policy of Object.values(EQUIPMENT_SLOT_STAT_POLICY)) {
      for (const stat of [...policy.mainStats, ...policy.substats]) {
        expect(statLabel(stat)).not.toBe(stat)
      }
    }
  })

  it('pool advanced có nội dung thật', () => {
    const registry = new AffixRegistry()
    for (const affix of affixes) registry.register(affix)
    expect(registry.getAll().some((affix) => affix.pool === 'advanced')).toBe(true)
    expect(registry.getAll().some((affix) => affix.stat === 'fireResistance')).toBe(true)
  })

  it('cấm tuyệt đối năm thuộc tính nhân vật trên equipment', () => {
    for (const stat of EQUIPMENT_FORBIDDEN_STATS) {
      expect(
        Object.keys(EQUIPMENT_SLOT_STAT_POLICY).some((slot) =>
          isValidEquipmentSubstat(slot as keyof typeof EQUIPMENT_SLOT_STAT_POLICY, stat),
        ),
      ).toBe(false)
    }
  })

  it('báo lỗi dữ liệu affix dùng thuộc tính bị cấm ngay khi đăng ký', () => {
    const registry = new AffixRegistry()
    expect(() =>
      registry.register({
        id: 'invalid_strength',
        name: 'Sai',
        stat: 'strength',
        kind: 'prefix',
        pool: 'supreme',
        tiers: [{ tier: 1, min: 1, max: 1 }],
      }),
    ).toThrow(/Forbidden equipment stat/)
  })

  it.each([
    { min: Number.NaN, max: 10 },
    { min: 1, max: Number.POSITIVE_INFINITY },
    { min: 10, max: 1 },
  ])('từ chối main stat range không roll được: $min..$max', (range) => {
    expect(() =>
      assertValidEquipmentMainStats({
        id: 'invalid_range',
        slot: 'weapon',
        mainStats: [{ stat: 'might', ...range }],
      }),
    ).toThrow(/Invalid main stat range/)
  })

  // D1/INV-15: speed scarcity is structural -- every pool that can roll
  // speed must force a real trade-off against >=2 competitive stats.
  it('mọi slot policy pool chứa speed đều có >=2 stat cạnh tranh (INV-15)', () => {
    for (const [slot, policy] of Object.entries(EQUIPMENT_SLOT_STAT_POLICY)) {
      expectSpeedPoolCompetitive(`${slot}.mainStats`, policy.mainStats)
      expectSpeedPoolCompetitive(`${slot}.substats`, policy.substats)
    }
  })

  it('mọi AffixPool chứa speed đều có >=2 stat cạnh tranh (INV-15)', () => {
    const statsByPool = new Map<string, Set<StatType>>()
    for (const affix of affixes) {
      const stats = statsByPool.get(affix.pool) ?? new Set<StatType>()
      stats.add(affix.stat)
      statsByPool.set(affix.pool, stats)
    }

    for (const [pool, stats] of statsByPool) {
      if (!stats.has('speed')) {
        continue
      }
      const rivals = [...stats].filter((stat) => SPEED_COMPETITIVE_STATS.has(stat))
      expect(rivals.length, `affix pool ${pool} gives speed no rival roll`).toBeGreaterThanOrEqual(2)
    }
  })

  it('mọi equipment template mainStats chứa speed đều có >=2 stat cạnh tranh (INV-15)', () => {
    // The item-level mainStats array is the actual roll pool
    // (EquipmentRolling picks one entry); the slot policy is only the
    // whitelist -- a speed-only item pool would defeat the invariant.
    for (const item of equipment) {
      expectSpeedPoolCompetitive(
        `${item.id}.mainStats`,
        item.mainStats.map((range) => range.stat),
      )
    }
  })
})
