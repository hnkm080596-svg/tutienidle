import { describe, expect, it } from 'vitest'
import { calculateComponentDamage, calculateElementComponentDamage, calculateSkillBaseDamage, elementalBasePower } from './ElementDamageCalculator'
import { baseAttackPlusPower, calculateBaseDamage } from './DamageCalculator'
import { getResistanceMitigationPercent } from './Resistance'
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
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

// Spec 2026-08-30-phap-tu-dao-sac §5 — describe Phong/Lôi (wind/
// lightning) đã xoá cùng ElementType: pipeline ElementDamageCalculator
// giờ chỉ còn Ngũ Hành + Hỗn Nguyên, test tương ứng bỏ theo.

// combat-skill-flow-element-power-dot-plan.md §3.1/§9 — nguồn damage nền
// dùng chung ATK + Power hệ; mixed component KHÔNG cộng hai lần ATK
// (tổng hệ số ATK đúng bằng tổng ratio).
describe('ElementDamageCalculator — Skill Power nền dùng chung (plan §3)', () => {
  it('Pure Fire dùng đúng (ATK + FirePower) × (1 - kháng)', () => {
    const source = createCombatant({
      stats: { ...createBaseStats(), attack: 30, firePower: 70 },
    })

    const target = createCombatant({
      stats: { ...createBaseStats(), fireResistance: 20 },
    })

    const damage = calculateElementComponentDamage(source, target, 'fire')

    // Kháng 20 rating → mitigation theo Resistance.ts (penetration 0).
    const unmitigated = calculateElementComponentDamage(source, target, 'fire', true)

    expect(unmitigated).toBe(100)

    expect(damage).toBeCloseTo(100 * (1 - getResistanceMitigationPercent(20, 0)), 5)
    expect(damage).toBeLessThan(100)
    expect(damage).toBeGreaterThan(0)
  })

  it('mixed 20% Physical + 80% Fire: hệ số ATK tổng đúng bằng 1, không double-count', () => {
    const attack = 50

    const source = createCombatant({
      stats: { ...createBaseStats(), attack, firePower: 40 },
    })

    const noArmorTarget = createCombatant({
      stats: { ...createBaseStats() },
    })

    const components: Parameters<typeof calculateSkillBaseDamage>[2] = [
      { kind: 'physical', ratio: 0.2 },
      { kind: 'element', element: 'fire', ratio: 0.8 },
    ]

    // Target không giáp → physical không bị giảm; fire 0 kháng.
    const total = calculateSkillBaseDamage(source, noArmorTarget, components, true)

    expect(total).toBeCloseTo(attack * 0.2 + (attack + 40) * 0.8, 5)
  })

  it('primordial component cũng cộng ATK vào Power nền', () => {
    const source = createCombatant({
      stats: { ...createBaseStats(), attack: 25, primordialPower: 15 },
    })

    const target = createCombatant()

    const total = calculateSkillBaseDamage(source, target, [{ kind: 'primordial', ratio: 1 }], true)

    expect(total).toBe(40)
  })

  it('Primordial ATK + primordialPower và elemental power QUA MỘT helper nền dùng chung (2026-08-26)', () => {
    // Trước đây calculateBaseDamage('primordial') tự cộng tay
    // attack + primordialPower trong khi elementalBasePower() cộng riêng
    // attack + `${element}Power` — hai công thức độc lập dễ lệch. Giờ cả
    // hai đều qua baseAttackPlusPower().
    const source = createCombatant({
      stats: { ...createBaseStats(), attack: 25, primordialPower: 15, firePower: 40 },
    })

    const target = createCombatant()

    expect(calculateBaseDamage(source, target, 'primordial')).toBe(baseAttackPlusPower(25, 15))

    expect(elementalBasePower(source, 'fire')).toBe(baseAttackPlusPower(25, 40))

    expect(calculateSkillBaseDamage(source, target, [{ kind: 'primordial', ratio: 1 }], true)).toBe(
      baseAttackPlusPower(25, 15),
    )
  })
})
