import { describe, expect, it } from 'vitest'
import { CombatSystem } from './CombatSystem'
import { EventBus } from '../events/EventBus'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from './CombatEntity'
import { createSkillRuntimeStats } from '../skill/SkillRuntimeStats'

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0 }

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

// Thủy Tu Trúc Cơ Pure (Plans/waterpath mục IX, 2026-08-21) —
// "Thủy Thế là 1 Defensive Stat TỒN TẠI LIÊN TỤC" (khác Hỏa Thế —
// không phải resource tích/tiêu theo combat), giảm THẲNG % sát thương
// cuối cùng nhận vào, không phân biệt loại damage.
describe('CombatSystem — Thủy Thế (Plans/waterpath, Tụ Thủy)', () => {
  it('thuyThePercent=0 (mặc định) — không đổi hành vi cũ', () => {
    const combat = new CombatSystem(new EventBus())

    const source = createCombatant({ id: 'source', type: 'player', stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 } })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const result = combat.resolveMissileHit(source, target, { kind: 'physical', multiplier: 1 }, false)

    expect(target.currentHp).toBe(1000 - result.finalDamage)
  })

  it('thuyThePercent=0.1 (vd minh hoạ doc) — giảm đúng 10% sát thương cuối cùng', () => {
    const combat = new CombatSystem(new EventBus())

    const sourceStats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 }
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats })

    const withoutMitigation = createCombatant({ id: 'target_a', currentHp: 100000, maxHp: 100000 })
    const rawResult = combat.resolveMissileHit(source, withoutMitigation, { kind: 'physical', multiplier: 1 }, false)

    const targetStats = { ...createBaseStats(), evasionRate: 0, dexterity: 0 }
    const target = createCombatant({ id: 'target_b', stats: targetStats, skillStats: { ...createSkillRuntimeStats(), thuyThePercent: 0.1 }, currentHp: 100000, maxHp: 100000 })

    const result = combat.resolveMissileHit(source, target, { kind: 'physical', multiplier: 1 }, false)

    expect(result.finalDamage).toBeCloseTo(rawResult.finalDamage * 0.9, 5)
    expect(target.currentHp).toBe(100000 - result.finalDamage)
  })

  it('thuyThePercent bị clamp ở WATER_MITIGATION_CAP — không thể giảm sát thương về 0', () => {
    const combat = new CombatSystem(new EventBus())

    const sourceStats = { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100000 }
    const source = createCombatant({ id: 'source', type: 'player', stats: sourceStats })

    const targetStats = { ...createBaseStats(), evasionRate: 0, dexterity: 0 }
    const target = createCombatant({ id: 'target', stats: targetStats, skillStats: { ...createSkillRuntimeStats(), thuyThePercent: 5 }, currentHp: 1000000, maxHp: 1000000 })

    const result = combat.resolveMissileHit(source, target, { kind: 'physical', multiplier: 1 }, false)

    expect(result.finalDamage).toBeGreaterThan(0)
  })
})
