import { describe, expect, it } from 'vitest'
import { getRealmPressureMultiplier } from './RealmPressure'
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
    lane: 'ground',
    alive: true,
    ...overrides,
  }
}

// Realm Passive & Pressure System (2026-08-20) — bảng số liệu ở đây
// khớp ĐÚNG mục VII/VIII tài liệu Plan gốc (gap=1) — xem
// RealmPressure.ts's hằng số cho phần mở rộng gap>1.
describe('RealmPressure — getRealmPressureMultiplier', () => {
  it('cùng cảnh giới -> không có Pressure (×1.00), bất kể grade', () => {
    const a = createCombatant({ type: 'player', realmIndex: 1, breakthroughGrade: 1 })
    const b = createCombatant({ realmIndex: 1 })

    expect(getRealmPressureMultiplier(a, b)).toBe(1)
  })

  it('gap=1, grade1 (chưa mitigation gì): cao->thấp ×2.00, thấp->cao ×0.50', () => {
    const high = createCombatant({ type: 'player', realmIndex: 2, breakthroughGrade: 1 })
    const low = createCombatant({ realmIndex: 1 })

    expect(getRealmPressureMultiplier(high, low)).toBeCloseTo(2.0)
    expect(getRealmPressureMultiplier(low, high)).toBeCloseTo(0.5)
  })

  it('gap=1, grade6 (mitigation tối đa): cả 2 chiều đều ×1.00', () => {
    const high = createCombatant({ type: 'player', realmIndex: 2, breakthroughGrade: 6 })
    const low = createCombatant({ realmIndex: 1 })

    expect(getRealmPressureMultiplier(high, low)).toBeCloseTo(1.0)
    expect(getRealmPressureMultiplier(low, high)).toBeCloseTo(1.0)
  })

  it('gap=1, grade3: cao->thấp ×1.60, thấp->cao ×0.70 (đúng bảng mục VIII)', () => {
    const high = createCombatant({ type: 'player', realmIndex: 2, breakthroughGrade: 3 })
    const low = createCombatant({ realmIndex: 1 })

    expect(getRealmPressureMultiplier(high, low)).toBeCloseTo(1.6)
    expect(getRealmPressureMultiplier(low, high)).toBeCloseTo(0.7)
  })

  it('không có breakthroughGrade ở bên nào (enemy vs enemy) -> mặc định grade 6, không mitigation phạt', () => {
    const high = createCombatant({ realmIndex: 2 })
    const low = createCombatant({ realmIndex: 1 })

    expect(getRealmPressureMultiplier(high, low)).toBeCloseTo(1.0)
  })

  it('gap lớn (5), grade1: bên thấp bị floor ở 0.1 thay vì âm/0', () => {
    const high = createCombatant({ type: 'player', realmIndex: 5, breakthroughGrade: 1 })
    const low = createCombatant({ realmIndex: 0 })

    expect(getRealmPressureMultiplier(low, high)).toBeCloseTo(0.1)
  })

  it('gap vượt MAX_REALM_GAP (5) vẫn bị clamp, không tăng thêm', () => {
    const high = createCombatant({ type: 'player', realmIndex: 9, breakthroughGrade: 1 })
    const low = createCombatant({ realmIndex: 0 })

    expect(getRealmPressureMultiplier(high, low)).toBeCloseTo(getRealmPressureMultiplier(
      createCombatant({ type: 'player', realmIndex: 5, breakthroughGrade: 1 }),
      createCombatant({ realmIndex: 0 }),
    ))
  })
})
