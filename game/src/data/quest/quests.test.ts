import { describe, expect, it } from 'vitest'
import { QUESTS } from './quests'
import { ENEMIES } from '../enemy/Enemies'

describe('foundation quests', () => {
  it('có đúng 5 quest Trúc Cơ', () => {
    const foundation = QUESTS.filter((quest) => quest.requiredRealmId === 'foundation_establishment')
    expect(foundation).toHaveLength(5)
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
})