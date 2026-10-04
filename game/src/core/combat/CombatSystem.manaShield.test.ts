import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  // dexterity:0/evasionRate:0 - hit chance 100% dam bao, cung ly do da
  // ghi trong BattleSystem.swordPath.test.ts (calculateStats() tu cong
  // them evasionRate dan xuat tu dexterity).
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0 })

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

// Phap Tu Redesign (magicpath) - "linh luc giam sat thuong nhan vao":
// currentMp giam sat thuong theo %, phan giam do THAT SU tru vao mana
// (khong free), tran nguoc lai HP khi het mana.
describe('CombatSystem — Mana Shield (Pháp Tu Redesign, magicpath)', () => {
  it('manaShieldPercent=0 (mặc định) — không đổi hành vi cũ, toàn bộ damage vào HP', () => {
    const combat = new CombatSystem(new EventBus())

    const source = createCombatant({ id: 'source', type: 'player', stats: createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 100 }) })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000, currentMp: 500 })

    const result = combat.resolveActionHit(source, target, { kind: 'physical', multiplier: 1 }, { critical: false })

    expect(result.manaShieldAbsorbed).toBe(0)
    expect(target.currentMp).toBe(500)
    expect(target.currentHp).toBe(1000 - result.finalDamage)
  })

  it('mana đủ che — đúng % damage chuyển sang mana theo tỉ lệ 1:1, còn lại vào HP', () => {
    const combat = new CombatSystem(new EventBus())

    const sourceStats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 100 })
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats })

    const targetStats = createBaseStats({ evasionRate: 0, dexterity: 0, manaShieldPercent: 0.5, maxMp: 500 })
    const target = createCombatant({ id: 'target', stats: targetStats, currentHp: 1000, maxHp: 1000, currentMp: 500 })

    const result = combat.resolveActionHit(source, target, { kind: 'physical', multiplier: 1 }, { critical: false })

    const expectedManaShield = result.finalDamage * 0.5

    expect(result.manaShieldAbsorbed).toBeCloseTo(expectedManaShield, 5)
    expect(target.currentMp).toBeCloseTo(500 - expectedManaShield, 5)
    expect(target.currentHp).toBeCloseTo(1000 - (result.finalDamage - expectedManaShield), 5)
  })

  it('mana KHÔNG đủ che — cạn mana về 0, phần thiếu tràn ngược lại HP (không ăn free)', () => {
    const combat = new CombatSystem(new EventBus())

    const sourceStats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 1000 })
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats })

    const targetStats = createBaseStats({ evasionRate: 0, dexterity: 0, manaShieldPercent: 1, maxMp: 10 })
    // Mana rat it so voi damage sap nhan - khong du che het du
    // manaShieldPercent=100%.
    const target = createCombatant({ id: 'target', stats: targetStats, currentHp: 1000, maxHp: 1000, currentMp: 10 })

    const result = combat.resolveActionHit(source, target, { kind: 'physical', multiplier: 1 }, { critical: false })

    // Chi che duoc dung bang luong mana dang co, khong hon.
    expect(result.manaShieldAbsorbed).toBe(10)
    expect(target.currentMp).toBe(0)
    expect(target.currentHp).toBe(1000 - (result.finalDamage - 10))
  })

  it('Ward hấp thụ TRƯỚC — Mana Shield chỉ tính trên phần damage CÒN LẠI sau Ward', () => {
    const combat = new CombatSystem(new EventBus())

    const sourceStats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, might: 100 })
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats })

    const targetStats = createBaseStats({ evasionRate: 0, dexterity: 0, manaShieldPercent: 0.5, wardMax: 1000, maxMp: 500 })
    const target = createCombatant({
      id: 'target',
      stats: targetStats,
      currentHp: 1000,
      maxHp: 1000,
      currentMp: 500,
      currentWard: 1000,
    })

    const result = combat.resolveActionHit(source, target, { kind: 'physical', multiplier: 1 }, { critical: false })

    // Ward thua suc che HET don nay -> khong con gi cho Mana Shield xu ly.
    expect(result.wardAbsorbed).toBe(result.finalDamage)
    expect(result.manaShieldAbsorbed).toBe(0)
    expect(target.currentMp).toBe(500)
    expect(target.currentHp).toBe(1000)
  })
})
