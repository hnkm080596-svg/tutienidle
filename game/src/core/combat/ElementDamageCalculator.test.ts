import { describe, expect, it } from 'vitest'
import { calculateComponentDamage, calculateElementComponentDamage, calculateSkillBaseDamage } from './ElementDamageCalculator'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentRage: 0,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    lane: 2,
    alive: true,
    ...overrides,
  }
}

// Pháp Tu Redesign (magicpath) — Phong/Lôi vừa thêm vào ElementType
// (core/element/ElementType.ts) phải chạy được qua ĐÚNG pipeline
// ElementDamageCalculator hiện có (generic theo `${element}Power` —
// không tạo damage engine riêng cho hành mới), y hệt Ngũ Hành.
describe('ElementDamageCalculator — Phong/Lôi (7-element framework, Pháp Tu Redesign)', () => {
  it('windPower trừ windResistance ra đúng base damage, không đụng hành khác', () => {
    const source = createCombatant({
      stats: { ...createBaseStats(), windPower: 100, firePower: 999 },
    })

    const target = createCombatant({
      stats: { ...createBaseStats(), windResistance: 50 },
    })

    const windDamage = calculateElementComponentDamage(source, target, 'wind')

    expect(windDamage).toBeGreaterThan(0)
    expect(windDamage).toBeLessThan(100)

    // firePower=999 trên source KHÔNG rò vào kết quả windDamage — mỗi
    // hành là 1 damage type độc lập (đúng nguyên tắc đã chốt, không có
    // sinh/khắc/lẫn hành).
    const fireDamage = calculateElementComponentDamage(source, target, 'fire')

    expect(fireDamage).not.toBe(windDamage)
  })

  it('lightningPenetration giảm hiệu lực lightningResistance của target', () => {
    const target = createCombatant({
      stats: { ...createBaseStats(), lightningResistance: 100 },
    })

    const withoutPenetration = createCombatant({
      stats: { ...createBaseStats(), lightningPower: 200 },
    })

    const withPenetration = createCombatant({
      stats: { ...createBaseStats(), lightningPower: 200, lightningPenetration: 50 },
    })

    const damageWithoutPenetration = calculateElementComponentDamage(withoutPenetration, target, 'lightning')
    const damageWithPenetration = calculateElementComponentDamage(withPenetration, target, 'lightning')

    expect(damageWithPenetration).toBeGreaterThan(damageWithoutPenetration)
  })

  it('skill nhiều component trộn Phong + Lôi + physical cộng đúng tổng base damage', () => {
    const source = createCombatant({
      stats: { ...createBaseStats(), attack: 40, windPower: 60, lightningPower: 80 },
    })

    const target = createCombatant()

    const components: Parameters<typeof calculateSkillBaseDamage>[2] = [
      { kind: 'physical', ratio: 0.2 },
      { kind: 'element', element: 'wind', ratio: 0.4 },
      { kind: 'element', element: 'lightning', ratio: 0.4 },
    ]

    const total = calculateSkillBaseDamage(source, target, components)

    const expectedTotal = components.reduce(
      (sum, component) => sum + calculateComponentDamage(source, target, component),
      0,
    )

    expect(total).toBe(expectedTotal)
    expect(total).toBeGreaterThan(0)
  })
})
