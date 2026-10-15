import { describe, expect, it } from 'vitest'
import { QUEST_V2_MAINLINE } from './questV2Mainline'
import { utcWeekBucket } from '../../core/quest/recurring/RecurringSchedule'
import { AchievementSystem } from '../../core/achievement/AchievementSystem'

describe('quest integration with shared resources', () => {
  it('accepts recurring week identities in achievement receipts', () => {
    const system = new AchievementSystem('weekly-integration', 0)
    const occurredAt = Date.UTC(2026, 9, 12)
    expect(system.ingest({ playerId: 'weekly-integration', eventId: 'week-1', committed: true, authority: 'quest', sourceId: 'recurring', occurredAt, kind: 'weekly_quest_claimed', claimId: 'week-1', utcWeekBucket: utcWeekBucket(occurredAt) })).toBe(true)
  })
  it('uses canonical wood and ore identities in every authored acquisition', () => {
    const ids = QUEST_V2_MAINLINE.flatMap(row => row.condition.objectives.filter(o => o.kind === 'acquire').map(o => o.materialId))
    expect(ids).toEqual(['material_spirit_wood_decade', 'material_spirit_ore_decade', 'tu_linh_thao_qi_refining_decade', 'material_spirit_ore_decade', 'material_spirit_ore_decade'])
  })
  it('retains lifetime ore through reopen and unlocks the foundation reward only after attainment', () => {
    const system = new AchievementSystem('integration', 0)
    const receipt = { playerId: 'integration', eventId: 'ore-1', committed: true, authority: 'inventory', sourceId: 'production', occurredAt: 1, kind: 'material_delivered', materialId: 'material_spirit_ore_decade', quantityDelivered: 30 } as const
    expect(system.ingest(receipt)).toBe(true)
    expect(system.ingest(receipt)).toBe(false)
    expect(system.get('ach_m04_khoang_anh')?.ready).toBe(true)
    expect(system.get('ach_f03_hau_son_khoang')).toMatchObject({ current: 30, ready: false, available: false })
    expect(system.claim('ach_f03_hau_son_khoang', () => { throw new Error('must stay locked') })).toBe('not-ready')
    const reopened = new AchievementSystem('integration', 0)
    expect(reopened.restore(JSON.parse(JSON.stringify(system.snapshot())))).toBe(true)
    expect(reopened.reconcile({ playerId: 'integration', completedStageIds: [], completedOnceIds: [], reachedRealmIds: ['foundation_establishment'], attainedElementIds: [] })).toBe(true)
    expect(reopened.get('ach_f03_hau_son_khoang')).toMatchObject({ current: 30, ready: true, available: true })
    expect(reopened.claim('ach_f03_hau_son_khoang', () => true)).toBe('granted')
    expect(reopened.claim('ach_f03_hau_son_khoang', () => { throw new Error('duplicate') })).toBe('already-claimed')
  })
})
