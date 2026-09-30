import { describe, expect, it } from 'vitest'
import { QUESTS } from './quests'
import { ENEMIES } from '../enemy/Enemies'

describe('foundation quests', () => {
  it('có đúng 5 quest Trúc Cơ (chuỗi once); token daily đã rời khỏi beta', () => {
    const foundation = QUESTS.filter((quest) => quest.requiredRealmId === 'foundation_establishment')
    // M1 chain = 5 once-quests. BETA SCOPE LOCK v2 sec.15: the gacha
    // token daily (P7-M9) retired from the authored set - the companion
    // domain it paid into is scope-hidden and daily cadence is off.
    expect(foundation.filter((quest) => quest.cadence === 'once')).toHaveLength(5)
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

  // BETA SCOPE LOCK v2 sec.15 - all three daily quests retired from the
  // authored set; the ids stay absent so a restored save finds no active
  // quest to resume (inert residue only - see ChieuHienLenhDrops.test).
  it('daily quests đã rời khỏi authored set', () => {
    expect(QUESTS.some((quest) => quest.cadence === 'daily')).toBe(false)
    const ids = QUESTS.map((quest) => quest.id)
    expect(ids).not.toContain('daily_collect_hoi_xuan_thao')
    expect(ids).not.toContain('daily_kill_bandit_15')
    expect(ids).not.toContain('daily_chieu_hien_lenh')
  })
})