import { describe, expect, it } from 'vitest'
import {
  applyBossMultiplier,
  applyEliteMultiplier,
  MAX_ENEMY_ATTACK_RANGE_RANKS,
  normalizeEnemyAttackSpeed,
  normalizeEnemyStats,
} from './EnemyStatInput'

function baseEnemyStats() {
  return normalizeEnemyStats({
    maxHp: 100,
    attack: 20,
    attackSpeed: 5,
    movementSpeed: 2,
    attackRangeRanks: 2,
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

  it('go board: data author truc tiep theo rank, khong heuristic', () => {
    expect(baseEnemyStats().movementSpeed).toBe(2)
    expect(baseEnemyStats().attackRange).toBe(2)
  })

  it('balance pass: attackRangeRanks > 5 bị clamp về trần 5 — quái luôn đứng trong tầm Player', () => {
    const clamped = normalizeEnemyStats({
      maxHp: 100,
      attack: 20,
      attackSpeed: 1,
      movementSpeed: 2,
      attackRangeRanks: 9,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
    })

    expect(MAX_ENEMY_ATTACK_RANGE_RANKS).toBe(5)
    expect(clamped.attackRange).toBe(5)
  })

  it('Elite ưu tiên độ bền hơn burst damage', () => {
    const elite = applyEliteMultiplier(baseEnemyStats())

    expect(elite.maxHp).toBe(250)
    expect(elite.attack).toBe(27)
    expect(elite.defense).toBeCloseTo(11.5)
    expect(elite.accuracyRating).toBeCloseTo(88)
  })

  it('Boss có profile công thủ riêng và kháng hành chủ đạo', () => {
    const boss = applyBossMultiplier(baseEnemyStats())

    expect(boss.maxHp).toBe(700)
    expect(boss.attack).toBe(32)
    expect(boss.defense).toBe(12)
    expect(boss.accuracyRating).toBeCloseTo(92)
    expect(boss.criticalAvoidance).toBe(0.15)
    expect(boss.fireResistance).toBe(15)
    expect(boss.woodResistance).toBe(0)
  })
})
