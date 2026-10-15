import { describe, expect, it, vi } from 'vitest'
import { ACHIEVEMENTS } from '../../data/achievement/achievements'
import { AchievementSystem } from './AchievementSystem'

const origins = {
  material_delivered: 'inventory', enemy_defeated: 'battle', production_batch_claimed: 'production',
  equipment_equipped: 'equipment', body_refinement_committed: 'body', alchemy_crafted: 'alchemy',
  equipment_enhanced: 'equipment', battle_victory: 'battle', technique_rank_reached: 'technique',
  companion_entitled: 'companion', formation_companion_assigned: 'formation',
  daily_quest_claimed: 'quest', weekly_quest_claimed: 'quest',
} as const
// These are owner-contract fixtures, not receipts from integrated gameplay.
const witness = (kind: keyof typeof origins) => ({ authority: origins[kind], sourceId: 'fixture-owner', occurredAt: 0 })
const playerId = 'player-a'
const create = () => new AchievementSystem(playerId, 0)

describe('achievement lifetime authority', () => {
  it('authors exactly 7+7+7+4 unique achievements with intrinsic rewards', () => {
    expect(ACHIEVEMENTS).toHaveLength(25)
    expect(new Set(ACHIEVEMENTS.map((row) => row.id)).size).toBe(25)
    expect(ACHIEVEMENTS.filter((row) => row.band === 'mortal')).toHaveLength(7)
    expect(ACHIEVEMENTS.filter((row) => row.band === 'qi_refining')).toHaveLength(7)
    expect(ACHIEVEMENTS.filter((row) => row.band === 'foundation_establishment')).toHaveLength(7)
    expect(ACHIEVEMENTS.filter((row) => row.band === 'fixed')).toHaveLength(4)
    expect(ACHIEVEMENTS.find((row) => row.id === 'ach_story_thanh_van_sealed')?.reward).toEqual({ spiritStone: 1000, skillInsight: 2000 })
  })

  it('counts newly delivered material, only once per committed receipt, never initial bag state', () => {
    const system = create()
    const deliver = (eventId: string, quantity: number) => system.ingest({
      ...witness('material_delivered'), kind: 'material_delivered', playerId, eventId, committed: true,
      materialId: 'material_spirit_wood_decade', quantityDelivered: quantity,
    })
    expect(system.get('ach_m01_lam_thu')?.current).toBe(0)
    expect(deliver('delivery-1', 11)).toBe(true)
    expect(deliver('delivery-1', 11)).toBe(false)
    expect(deliver('delivery-2', 9)).toBe(true)
    expect(system.get('ach_m01_lam_thu')?.current).toBe(20)
    expect(system.get('ach_m01_lam_thu')?.ready).toBe(true)
    expect(system.get('ach_m04_khoang_anh')?.current).toBe(0)
  })

  it('requires unique enemy-death and production batch receipts, not repetitions', () => {
    const system = create()
    for (let i = 0; i < 10; i++) {
      expect(system.ingest({ ...witness('enemy_defeated'), kind: 'enemy_defeated', playerId, eventId: `enemy-${i}`, committed: true, enemyId: 'mortal_wild_boar' })).toBe(true)
    }
    expect(system.ingest({ ...witness('enemy_defeated'), kind: 'enemy_defeated', playerId, eventId: 'enemy-0', committed: true, enemyId: 'mortal_wild_boar' })).toBe(false)
    for (let i = 0; i < 3; i++) {
      system.ingest({ ...witness('production_batch_claimed'), kind: 'production_batch_claimed', playerId, eventId: `batch-${i}`, committed: true, batchId: `batch-${i}`, realmAtCommit: 'mortal' })
    }
    expect(system.get('ach_m02_tru_tich')?.current).toBe(10)
    expect(system.get('ach_m03_mach_san')?.current).toBe(3)
  })

  it('dedupes equipment by instance through equip cycles and filters realm-stamped body refinement', () => {
    const system = create()
    system.ingest({ ...witness('equipment_equipped'), kind: 'equipment_equipped', playerId, eventId: 'equip-1', committed: true, instanceId: 'sword-1' })
    system.ingest({ ...witness('equipment_equipped'), kind: 'equipment_equipped', playerId, eventId: 'equip-2', committed: true, instanceId: 'sword-1' })
    system.ingest({ ...witness('equipment_equipped'), kind: 'equipment_equipped', playerId, eventId: 'equip-3', committed: true, instanceId: 'armor-2' })
    expect(system.get('ach_m05_khi_ho')?.current).toBe(2)
    for (let i = 0; i < 5; i++) {
      system.ingest({ ...witness('body_refinement_committed'), kind: 'body_refinement_committed', playerId, eventId: `body-m-${i}`, committed: true, realmAtCommit: 'mortal' })
    }
    expect(system.get('ach_m06_the_mach')?.current).toBe(5)
    expect(system.get('ach_f06_than_the')?.current).toBe(0)
    for (let i = 0; i < 5; i++) {
      system.ingest({ ...witness('body_refinement_committed'), kind: 'body_refinement_committed', playerId, eventId: `body-f-${i}`, committed: true, realmAtCommit: 'foundation_establishment' })
    }
    expect(system.get('ach_f06_than_the')?.current).toBe(5)
  })

  it('reconciles durable stage/quest/realm witnesses including early clears; requires both halves of milestones', () => {
    const system = create()
    system.reconcile({ playerId, completedStageIds: ['mortal_dong_10', 'qi_refining_abyssal_pool', 'foundation_floor_10'], completedOnceIds: Array.from({ length: 20 }, (_, i) => `tvdm2_main_${String(i + 1).padStart(2, '0')}`), reachedRealmIds: ['qi_refining', 'foundation_establishment'], attainedElementIds: [] })
    expect(system.get('ach_meta_three_boss')?.ready).toBe(true)
    expect(system.get('ach_story_thanh_van_sealed')?.current).toBe(20)
    expect(system.get('ach_q01_nhap_hoa')?.current).toBe(1)
    system.reconcile({ playerId, completedStageIds: [], completedOnceIds: ['tvdm2_main_21'], reachedRealmIds: [], attainedElementIds: ['fire'] })
    expect(system.get('ach_story_thanh_van_sealed')?.ready).toBe(true)
    expect(system.get('ach_q01_nhap_hoa')?.ready).toBe(true)
  })

  it('does not count boss kills as clears and requires a pre-battle formation for victories', () => {
    const system = create()
    system.ingest({ ...witness('enemy_defeated'), kind: 'enemy_defeated', playerId, eventId: 'boss', enemyId: 'foundation_spirit_wolf', committed: true })
    expect(system.get('ach_f07_lang_vuong')?.ready).toBe(false)
    for (let i = 0; i < 4; i++) {
      system.ingest({ ...witness('battle_victory'), kind: 'battle_victory', playerId, eventId: `battle-${i}`, committed: true, battleId: `battle-${i}`, formationAtBattleStart: i !== 0 })
    }
    expect(system.get('ach_f05_tran_phap')?.current).toBe(3)
  })

  it('enforces daily consecutive UTC buckets and weekly claims across two periods', () => {
    const system = create()
    for (const day of [100, 101, 103, 104, 105, 106, 107, 108, 109]) {
      system.ingest({ ...witness('daily_quest_claimed'), kind: 'daily_quest_claimed', playerId, eventId: `daily-${day}`, committed: true, claimId: `daily-${day}`, utcDayBucket: day, occurredAt: day * 86_400_000 })
    }
    expect(system.get('ach_meta_day_7')?.ready).toBe(true)
    for (let i = 0; i < 4; i++) {
      system.ingest({ ...witness('weekly_quest_claimed'), kind: 'weekly_quest_claimed', playerId, eventId: `weekly-${i}`, committed: true, claimId: `weekly-${i}`, utcWeekBucket: 10 + Math.floor(i / 2), occurredAt: ((10 + Math.floor(i / 2)) * 7 + 4) * 86_400_000 })
    }
    expect(system.get('ach_meta_week_4')?.ready).toBe(true)
  })

  it('rolls back an unsuccessful grant, commits once with a stable identity and rejects reentry', () => {
    const system = create()
    system.reconcile({ playerId, completedStageIds: ['mortal_dong_10'], completedOnceIds: [], reachedRealmIds: [], attainedElementIds: [] })
    const before = system.snapshot()
    const failure = vi.fn(() => false)
    expect(system.claim('ach_m07_hung_tru', failure)).toBe('delivery-failed')
    expect(system.snapshot()).toEqual(before)
    const grant = vi.fn((award: { claimId: string; band: string; reward: unknown }) => {
      expect(award).toEqual({ claimId: 'achievement:player-a:ach_m07_hung_tru', achievementId: 'ach_m07_hung_tru', playerId, band: 'mortal', reward: { spiritStone: 14, cultivation: 30 } })
      expect(system.claim('ach_m07_hung_tru', () => true)).toBe('already-claimed')
      return true
    })
    expect(system.claim('ach_m07_hung_tru', grant)).toBe('granted')
    expect(system.claim('ach_m07_hung_tru', grant)).toBe('already-claimed')
    expect(grant).toHaveBeenCalledTimes(1)
  })

  it('rejects bad and foreign receipts atomically; snapshots detach, restore replaces and rejects stale saves', () => {
    const system = create()
    const initial = system.snapshot()
    expect(system.ingest({ ...witness('material_delivered'), kind: 'material_delivered', playerId: 'other', eventId: 'wrong', committed: true, materialId: 'material_spirit_wood_decade', quantityDelivered: 20 })).toBe(false)
    expect(system.ingest({ ...witness('material_delivered'), kind: 'material_delivered', playerId, eventId: 'fake', committed: false, materialId: 'material_spirit_wood_decade', quantityDelivered: 20 })).toBe(false)
    expect(system.ingest({ ...witness('material_delivered'), kind: 'material_delivered', playerId, eventId: 'bad', committed: true, materialId: 'material_spirit_wood_decade', quantityDelivered: -1 })).toBe(false)
    expect(system.snapshot()).toEqual(initial)
    system.ingest({ ...witness('material_delivered'), kind: 'material_delivered', playerId, eventId: 'delivery', committed: true, materialId: 'material_spirit_wood_decade', quantityDelivered: 20 })
    const saved = system.snapshot()
    expect(system.restore(initial)).toBe(false)
    const fresh = create()
    expect(fresh.restore(saved)).toBe(true)
    expect(fresh.restore(saved)).toBe(true)
    expect(fresh.ingest({ ...witness('material_delivered'), kind: 'material_delivered', playerId, eventId: 'delivery', committed: true, materialId: 'material_spirit_wood_decade', quantityDelivered: 20 })).toBe(false)
    const out = fresh.snapshot()
    out.receiptIds.push('tampered')
    expect(fresh.snapshot().receiptIds).not.toContain('tampered')
    expect(fresh.restore({ ...saved, playerId: 'other' })).toBe(false)
  })
})
