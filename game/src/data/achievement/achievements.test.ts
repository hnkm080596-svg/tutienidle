import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from './achievements'
import { AchievementSystem } from '../../core/achievement/AchievementSystem'

describe('authored achievement contract', () => {
  const expected = [
    ['ach_m01_lam_thu', 5, 10, 0], ['ach_m02_tru_tich', 8, 15, 0], ['ach_m03_mach_san', 8, 15, 0],
    ['ach_m04_khoang_anh', 8, 20, 0], ['ach_m05_khi_ho', 10, 20, 0], ['ach_m06_the_mach', 10, 25, 0], ['ach_m07_hung_tru', 14, 30, 0],
    ['ach_q01_nhap_hoa', 4, 0, 100], ['ach_q02_tru_tac', 8, 0, 150], ['ach_q03_linh_thao', 8, 0, 150],
    ['ach_q04_dan_su', 10, 0, 200], ['ach_q05_cong_phap', 10, 0, 300], ['ach_q06_toi_luyen', 12, 0, 300], ['ach_q07_son_tac_vuong', 16, 0, 400],
    ['ach_f01_kien_co', 4, 0, 500], ['ach_f02_bach_lang', 7, 0, 800], ['ach_f03_hau_son_khoang', 8, 0, 900],
    ['ach_f04_dong_hanh', 8, 0, 1000], ['ach_f05_tran_phap', 10, 0, 1200], ['ach_f06_than_the', 10, 0, 1500], ['ach_f07_lang_vuong', 16, 0, 2000],
    ['ach_story_thanh_van_sealed', 1000, 0, 2000], ['ach_meta_three_boss', 500, 0, 1000], ['ach_meta_day_7', 250, 0, 500], ['ach_meta_week_4', 400, 0, 800],
  ] as const

  it('matches every authored base reward and has only one story ID', () => {
    expect(ACHIEVEMENTS.map((row) => [row.id, row.reward.spiritStone ?? 0, row.reward.cultivation ?? 0, row.reward.skillInsight ?? 0])).toEqual(expected)
    expect(ACHIEVEMENTS.filter((row) => row.id.includes('story'))).toHaveLength(1)
  })

  it('reaches all 25 objectives from their authored owner boundaries, claims all once and survives JSON reopen', () => {
    const playerId = 'catalog-player'
    const system = new AchievementSystem(playerId, 0)
    const base = { playerId, committed: true, sourceId: 'catalog-fixture', occurredAt: 0 } as const
    let n = 0
    for (const [materialId, quantityDelivered] of [['material_spirit_wood_decade', 20], ['material_spirit_ore_decade', 15], ['tu_linh_thao_qi_refining_decade', 20], ['material_spirit_ore_decade', 30]] as const) {
      system.ingest({ ...base, authority: 'inventory', kind: 'material_delivered', eventId: `e${n++}`, materialId, quantityDelivered })
    }
    for (const [enemyId, quantity] of [['mortal_wild_boar', 10], ['bandit', 20], ['foundation_spirit_wolf', 30]] as const) {
      for (let i = 0; i < quantity; i++) system.ingest({ ...base, authority: 'battle', kind: 'enemy_defeated', eventId: `e${n++}`, enemyId })
    }
    for (let i = 0; i < 5; i++) {
      system.ingest({ ...base, authority: 'alchemy', kind: 'alchemy_crafted', eventId: `e${n++}`, craftId: `craft${i}` })
      system.ingest({ ...base, authority: 'body', kind: 'body_refinement_committed', eventId: `e${n++}`, realmAtCommit: 'foundation_establishment' })
    }
    for (let i = 0; i < 3; i++) {
      system.ingest({ ...base, authority: 'equipment', kind: 'equipment_enhanced', eventId: `e${n++}`, enhancementId: `enhance${i}` })
      system.ingest({ ...base, authority: 'production', kind: 'production_batch_claimed', eventId: `e${n++}`, batchId: `batch${i}`, realmAtCommit: 'mortal' })
      system.ingest({ ...base, authority: 'battle', kind: 'battle_victory', eventId: `e${n++}`, battleId: `battle${i}`, formationAtBattleStart: true })
    }
    for (let i = 0; i < 2; i++) system.ingest({ ...base, authority: 'equipment', kind: 'equipment_equipped', eventId: `e${n++}`, instanceId: `gear${i}` })
    system.reconcile({ playerId, completedStageIds: ['mortal_dong_10', 'qi_refining_abyssal_pool', 'foundation_floor_10'],
      completedOnceIds: Array.from({ length: 21 }, (_, index) => `tvdm2_main_${String(index + 1).padStart(2, '0')}`),
      reachedRealmIds: ['qi_refining', 'foundation_establishment'], attainedElementIds: ['fire'],
      techniqueRankThreeEver: true, entitledCompanionIds: ['beta'], assignedCompanionIds: ['beta'] })
    for (let day = 100; day < 107; day++) system.ingest({ ...base, authority: 'quest', kind: 'daily_quest_claimed', eventId: `e${n++}`, claimId: `daily${day}`, utcDayBucket: day, occurredAt: day * 86_400_000 })
    for (let i = 0; i < 4; i++) {
      const period = 20 + Math.floor(i / 2)
      system.ingest({ ...base, authority: 'quest', kind: 'weekly_quest_claimed', eventId: `e${n++}`, claimId: `weekly${i}`, utcWeekBucket: period, occurredAt: (period * 7 + 4) * 86_400_000 })
    }
    expect(system.getAll().every((row) => row.ready)).toBe(true)
    const grants: string[] = []
    for (const row of ACHIEVEMENTS) {
      expect(system.claim(row.id, (award) => { grants.push(award.claimId); return true })).toBe('granted')
    }
    expect(new Set(grants).size).toBe(25)
    const reopened = new AchievementSystem(playerId, 0)
    expect(reopened.restore(JSON.parse(JSON.stringify(system.snapshot())))).toBe(true)
    for (const row of ACHIEVEMENTS) expect(reopened.claim(row.id, () => { throw new Error('repeat award') })).toBe('already-claimed')
  })
})
