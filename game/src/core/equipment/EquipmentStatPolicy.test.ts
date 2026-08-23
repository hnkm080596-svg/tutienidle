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

describe('EquipmentStatPolicy', () => {
  it('mỗi slot chỉ nhận main stat thuộc bản sắc của slot', () => {
    expect(isValidEquipmentMainStat('weapon', 'attack')).toBe(true)
    expect(isValidEquipmentMainStat('helmet', 'maxHp')).toBe(true)
    expect(isValidEquipmentMainStat('armor', 'defense')).toBe(true)
    expect(isValidEquipmentMainStat('boots', 'evasionRate')).toBe(true)
    expect(isValidEquipmentMainStat('ring', 'criticalDamage')).toBe(true)
    expect(isValidEquipmentMainStat('necklace', 'castSpeedPercent')).toBe(true)
    expect(isValidEquipmentMainStat('boots', 'attack')).toBe(false)
  })

  it('không cho main stat xuất hiện lại trong substat pool', () => {
    for (const policy of Object.values(EQUIPMENT_SLOT_STAT_POLICY)) {
      expect(policy.mainStats.some(stat => policy.substats.includes(stat))).toBe(false)
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

  it('không còn Movement Speed vô dụng và pool advanced có nội dung thật', () => {
    expect(Object.values(EQUIPMENT_SLOT_STAT_POLICY).some(policy => policy.substats.includes('movementSpeed'))).toBe(false)

    const registry = new AffixRegistry()
    for (const affix of affixes) registry.register(affix)
    expect(registry.getAll().some(affix => affix.pool === 'advanced')).toBe(true)
    expect(registry.getAll().some(affix => affix.stat === 'fireResistance')).toBe(true)
  })

  it('cấm tuyệt đối năm thuộc tính nhân vật trên equipment', () => {
    for (const stat of EQUIPMENT_FORBIDDEN_STATS) {
      expect(Object.keys(EQUIPMENT_SLOT_STAT_POLICY).some(slot =>
        isValidEquipmentSubstat(slot as keyof typeof EQUIPMENT_SLOT_STAT_POLICY, stat),
      )).toBe(false)
    }
  })

  it('báo lỗi dữ liệu affix dùng thuộc tính bị cấm ngay khi đăng ký', () => {
    const registry = new AffixRegistry()
    expect(() => registry.register({
      id: 'invalid_strength', name: 'Sai', stat: 'strength', kind: 'prefix', pool: 'supreme',
      tiers: [{ tier: 1, min: 1, max: 1 }],
    })).toThrow(/Forbidden equipment stat/)
  })

  it.each([
    { min: Number.NaN, max: 10 },
    { min: 1, max: Number.POSITIVE_INFINITY },
    { min: 10, max: 1 },
  ])('từ chối main stat range không roll được: $min..$max', range => {
    expect(() => assertValidEquipmentMainStats({
      id: 'invalid_range',
      slot: 'weapon',
      mainStats: [{ stat: 'attack', ...range }],
    })).toThrow(/Invalid main stat range/)
  })
})
