import { describe, expect, it } from 'vitest'
import {
  applyBossMultiplier,
  applyEliteMultiplier,
  normalizeEnemyAttackSpeed,
  normalizeEnemyStats,
} from './EnemyStatInput'
import { createBaseStats } from '../stats/StatBlock'

function baseEnemyStats() {
  return normalizeEnemyStats({
    maxHp: 100,
    might: 20,
    attackSpeed: 5,
    criticalRate: 0.05,
    criticalDamage: 1.5,
    armor: 10,
    elemental: { element: 'fire', power: 8 },
  })
}

describe('enemy combat stat normalization', () => {
  it('quy đổi tốc đánh legacy và giữ dữ liệu authored theo thang mới', () => {
    expect(normalizeEnemyAttackSpeed(3)).toBeCloseTo(1.2)
    expect(normalizeEnemyAttackSpeed(5)).toBe(2)
    expect(normalizeEnemyAttackSpeed(7)).toBe(2.5)
    expect(normalizeEnemyAttackSpeed(1.5)).toBe(1.5)
    expect(normalizeEnemyAttackSpeed(0.2)).toBe(0.8)
  })

  // stat-system-reimagined Task 3 (D16/D17) -- attackRange is retired:
  // reach is a skill/action-targeting concern, not a character stat.
  // EnemyStatInput no longer declares a range-rank field; a stale
  // authored field is ignored by normalization, and neither the
  // normalized enemy Stats nor the player createBaseStats() record
  // carries attackRange.
  it('stale range-rank authored input is ignored -- output has no attackRange key', () => {
    const legacyAuthored = {
      maxHp: 100,
      might: 20,
      attackSpeed: 1,
      attackRangeRanks: 9,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    }

    const stats = normalizeEnemyStats(legacyAuthored)

    expect('attackRange' in stats).toBe(false)
  })

  it('createBaseStats() output has no attackRange key', () => {
    expect('attackRange' in createBaseStats()).toBe(false)
  })

  it('Elite ưu tiên độ bền hơn burst damage', () => {
    const elite = applyEliteMultiplier(baseEnemyStats())

    expect(elite.maxHp).toBe(250)
    expect(elite.might).toBe(27)
    expect(elite.defense).toBeCloseTo(11.5)
    expect(elite.accuracyRating).toBeCloseTo(88)
  })

  it('Boss có profile công thủ riêng và kháng hành chủ đạo', () => {
    const boss = applyBossMultiplier(baseEnemyStats())

    expect(boss.maxHp).toBe(700)
    expect(boss.might).toBe(40)
    expect(boss.defense).toBe(12)
    expect(boss.accuracyRating).toBeCloseTo(92)
    expect(boss.criticalAvoidance).toBe(0.15)
    expect(boss.fireResistance).toBe(15)
    expect(boss.woodResistance).toBe(0)
  })
})
