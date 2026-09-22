import { describe, expect, it } from 'vitest'
import { QUESTS } from './quests'
import { ENEMIES } from '../enemy/Enemies'

describe('foundation quests', () => {
  it('có đúng 5 quest Trúc Cơ (chuỗi once) + 1 token daily', () => {
    const foundation = QUESTS.filter((quest) => quest.requiredRealmId === 'foundation_establishment')
    // M1 chain = 5 once-quests; the gacha token daily (P7-M9) shares the
    // realm gate but is not part of the chain.
    expect(foundation.filter((quest) => quest.cadence === 'once')).toHaveLength(5)
    expect(foundation).toHaveLength(6)
  })

  it('mọi kill quest tham chiếu enemy tồn tại', () => {
    const ids = new Set(ENEMIES.map((enemy) => enemy.id))
    for (const quest of QUESTS) {
      if (quest.condition.kind === 'kill' && quest.condition.enemyId) {
        expect(ids.has(quest.condition.enemyId)).toBe(true)
      }
    }
  })

  it('quest Trúc Cơ không có id trùng', () => {
    const foundation = QUESTS.filter((quest) => quest.requiredRealmId === 'foundation_establishment')
    const ids = foundation.map((quest) => quest.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // QI-D8 - the former Hoi Xuan Thao daily is retargeted onto the live
  // Tu Linh herb while the hoi_xuan family stays deferred. The quest id
  // is preserved so active progress/claimed state keeps resolving.
  it('daily_collect_hoi_xuan_thao thu thập Tụ Linh Thảo Luyện Khí (QI-D8 retarget)', () => {
    const quest = QUESTS.find((entry) => entry.id === 'daily_collect_hoi_xuan_thao')!

    expect(quest).toBeDefined()
    expect(quest.condition).toEqual({
      kind: 'collect',
      materialId: 'tu_linh_thao_qi_refining_decade',
      amount: 5,
    })
    expect(quest.cadence).toBe('daily')
    expect(quest.reward).toEqual({ reward: { skillInsight: 15 } })
    expect(quest.name).toContain('Tụ Linh Thảo')
    expect(quest.name).not.toContain('Hồi Xuân')
    expect(quest.description).toContain('Tụ Linh Thảo')
    expect(quest.description).not.toContain('Hồi Xuân')
  })
})