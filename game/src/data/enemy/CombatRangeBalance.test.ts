import { describe, expect, it } from 'vitest'
import { ENEMIES } from './Enemies'
import { TRIBULATIONS } from './Tribulations'
import { MAX_ENEMY_ATTACK_RANGE_RANKS } from '../../core/enemy/EnemyStatInput'

// Balance pass 2026-08-26 — hợp đồng tầm đánh quái (đo trên Enemy RUNTIME
// sau normalizeEnemyStats — đúng giá trị BattleSystem tiêu thụ):
// - Cận chiến (không khai archetype) → attackRange = 1 (Dã Trư/hổ/gấu…
//   KHÔNG được thành sniper đứng xa bắn cổng).
// - 'ranged'/'caster' → tối đa MAX_ENEMY_ATTACK_RANGE_RANKS = 5, bảo đảm
//   điểm dừng xa nhất (cột 1+5=6) vẫn trong tầm với tới của Player
//   (base range 5) — không còn thế bất khả chiến thắng.
function collectOffenders(enemies: import('../../core/enemy/Enemy').Enemy[]): string[] {
  const offenders: string[] = []

  for (const enemy of enemies) {
    const ranks = enemy.stats.attackRange
    const isKiter = enemy.archetype === 'ranged' || enemy.archetype === 'caster'

    if (isKiter) {
      if (ranks < 1 || ranks > MAX_ENEMY_ATTACK_RANGE_RANKS) {
        offenders.push(`${enemy.id} (kiter, rank ${ranks})`)
      }
    } else if (ranks !== 1) {
      offenders.push(`${enemy.id} (melee, rank ${ranks})`)
    }
  }

  return offenders
}

describe('Enemy data — combat range balance contract', () => {
  it('mọi quái thường: melee rank 1, ranged/caster rank ≤ 5', () => {
    expect(collectOffenders(ENEMIES)).toEqual([])
  })

  it('mọi quái Kiếp: melee rank 1, ranged/caster rank ≤ 5', () => {
    expect(collectOffenders(TRIBULATIONS)).toEqual([])
  })

  it('có ít nhất một kiter và nhiều melee — guard chống xoá nhầm dữ liệu mẫu', () => {
    const kiters = ENEMIES.filter(
      (enemy) => enemy.archetype === 'ranged' || enemy.archetype === 'caster',
    )

    expect(kiters.length).toBeGreaterThan(0)
    expect(ENEMIES.length - kiters.length).toBeGreaterThan(0)
  })
})
