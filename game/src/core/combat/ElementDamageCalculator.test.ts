import { describe, expect, it } from 'vitest'
import { calculateElementComponentDamage, calculateSkillBaseDamage, elementalBasePower } from './ElementDamageCalculator'
import { baseMightPlusPower, calculateBaseDamage } from './DamageCalculator'
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

    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

// Spec 2026-08-30-phap-tu-dao-sac sec5 - describe Phong/Loi (wind/
// lightning) da xoa cung ElementType: pipeline ElementDamageCalculator
// gio chi con Ngu Hanh + Hon Nguyen, test tuong ung bo theo.

// combat-skill-flow-element-power-dot-plan.md sec3.1/sec9 - nguon damage nen
// dung chung ATK + Power he; mixed component KHONG cong hai lan ATK
// (tong he so ATK dung bang tong ratio).
describe('ElementDamageCalculator — Skill Power nền dùng chung (plan §3)', () => {
  it('Pure Fire dùng đúng (ATK + FirePower) × (1 - kháng)', () => {
    const source = createCombatant({
      stats: createBaseStats({ might: 30, firePower: 70 }),
    })

    const target = createCombatant({
      stats: createBaseStats({ fireResistance: 20 }),
    })

    const damage = calculateElementComponentDamage(source, target, 'fire')

    // Khang 20 rating -> mitigation theo Resistance.ts (penetration 0).
    const unmitigated = calculateElementComponentDamage(source, target, 'fire', true)

    expect(unmitigated).toBe(100)

    expect(damage).toBeCloseTo(100 * (1 - getResistanceMitigationPercent(20, 0)), 5)
    expect(damage).toBeLessThan(100)
    expect(damage).toBeGreaterThan(0)
  })

  it('mixed 20% Physical + 80% Fire: hệ số ATK tổng đúng bằng 1, không double-count', () => {
    const might = 50

    const source = createCombatant({
      stats: createBaseStats({ might, firePower: 40 }),
    })

    const noArmorTarget = createCombatant({
      stats: createBaseStats({}),
    })

    const components: Parameters<typeof calculateSkillBaseDamage>[2] = [
      { kind: 'physical', ratio: 0.2 },
      { kind: 'element', element: 'fire', ratio: 0.8 },
    ]

    // Target khong giap -> physical khong bi giam; fire 0 khang.
    const total = calculateSkillBaseDamage(source, noArmorTarget, components, true)

    expect(total).toBeCloseTo(might * 0.2 + (might + 40) * 0.8, 5)
  })

  it('primordial component cũng cộng ATK vào Power nền', () => {
    const source = createCombatant({
      stats: createBaseStats({ might: 25, primordialPower: 15 }),
    })

    const target = createCombatant()

    const total = calculateSkillBaseDamage(source, target, [{ kind: 'primordial', ratio: 1 }], true)

    expect(total).toBe(40)
  })

  it('Primordial ATK + primordialPower và elemental power QUA MỘT helper nền dùng chung (2026-08-26)', () => {
    // Truoc day calculateBaseDamage('primordial') tu cong tay
    // might + primordialPower trong khi elementalBasePower() cong rieng
    // might + `${element}Power` - hai cong thuc doc lap de lech. Gio ca
    // hai deu qua baseMightPlusPower().
    const source = createCombatant({
      stats: createBaseStats({ might: 25, primordialPower: 15, firePower: 40 }),
    })

    const target = createCombatant()

    expect(calculateBaseDamage(source, target, 'primordial')).toBe(baseMightPlusPower(25, 15))

    expect(elementalBasePower(source, 'fire')).toBe(baseMightPlusPower(25, 40))

    expect(calculateSkillBaseDamage(source, target, [{ kind: 'primordial', ratio: 1 }], true)).toBe(
      baseMightPlusPower(25, 15),
    )
  })
})
