import { describe, expect, it } from 'vitest'
import type { AchievementReceipt } from './Achievement'
import { AchievementRegistry } from './AchievementRegistry'
import { AchievementSystem } from './AchievementSystem'
import { ACHIEVEMENTS } from '../../data/achievement/achievements'

const playerId = 'boundary-player'
const make = () => new AchievementSystem(playerId, 0)
const base = { playerId, committed: true, sourceId: 'fixture-owner', occurredAt: 0 } as const
const wood = (eventId: string, quantityDelivered: number): Extract<AchievementReceipt, { kind: 'material_delivered' }> => ({ ...base, kind: 'material_delivered', authority: 'inventory', eventId, materialId: 'material_spirit_wood_decade', quantityDelivered })
const stage = (system: AchievementSystem) => system.reconcile({ playerId, completedStageIds: ['mortal_dong_10'], completedOnceIds: [], reachedRealmIds: [], attainedElementIds: [] })

describe('achievement supported boundaries (owner-contract fixtures, no runtime wiring)', () => {
  it('requires explicit valid identity and activation baseline; excludes pre-enable receipts', () => {
    expect(() => new AchievementSystem('', 0)).toThrow()
    expect(() => new AchievementSystem(playerId, NaN)).toThrow()
    const system = new AchievementSystem(playerId, 100)
    expect(system.ingest(wood('old', 20))).toBe(false)
    expect(system.ingest({ ...wood('new', 20), occurredAt: 100 })).toBe(true)
    expect(system.restore(make().snapshot())).toBe(false)
  })

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid delivered quantity %s atomically', (quantity) => {
    const system = make()
    const before = system.snapshot()
    expect(system.ingest(wood('bad', quantity))).toBe(false)
    expect(system.snapshot()).toEqual(before)
  })

  it('rejects counter overflow without consuming receipt identity', () => {
    const system = make()
    expect(system.ingest(wood('large', Number.MAX_SAFE_INTEGER))).toBe(true)
    const before = system.snapshot()
    expect(system.ingest(wood('retry', 1))).toBe(false)
    expect(system.snapshot()).toEqual(before)
    expect(system.snapshot().receiptIds).not.toContain('retry')
  })

  it('does not accept forged authority tags, blank identities or foreign players', () => {
    const system = make()
    const initial = system.snapshot()
    for (const receipt of [{ ...wood('x', 20), authority: 'battle' }, { ...wood('x', 20), eventId: '' }, { ...wood('x', 20), sourceId: ' ' }, { ...wood('x', 20), playerId: 'foreign' }]) {
      expect(system.ingest(receipt as AchievementReceipt)).toBe(false)
      expect(system.snapshot()).toEqual(initial)
    }
  })

  it('dedupes operation aliases separately from envelope IDs across reopen', () => {
    const system = make()
    const receipts: AchievementReceipt[] = [
      { ...base, authority: 'production', kind: 'production_batch_claimed', eventId: 'batch', batchId: 'op', realmAtCommit: 'mortal' },
      { ...base, authority: 'alchemy', kind: 'alchemy_crafted', eventId: 'craft', craftId: 'op' },
      { ...base, authority: 'equipment', kind: 'equipment_enhanced', eventId: 'enhance', enhancementId: 'op' },
      { ...base, authority: 'battle', kind: 'battle_victory', eventId: 'battle', battleId: 'op', formationAtBattleStart: true },
    ]
    for (const receipt of receipts) expect(system.ingest(receipt)).toBe(true)
    const reopened = make()
    expect(reopened.restore(JSON.parse(JSON.stringify(system.snapshot())))).toBe(true)
    const before = reopened.snapshot()
    for (const receipt of receipts) expect(reopened.ingest({ ...receipt, eventId: `retry-${receipt.eventId}` })).toBe(false)
    expect(reopened.snapshot()).toEqual(before)
    expect(reopened.get('ach_m03_mach_san')?.current).toBe(1)
    expect(reopened.get('ach_q04_dan_su')?.current).toBe(1)
  })

  it('counts only mortal production and exact authored material/enemy selectors', () => {
    const system = make()
    system.ingest({ ...base, authority: 'production', kind: 'production_batch_claimed', eventId: 'qi-batch', batchId: 'qi-batch', realmAtCommit: 'qi_refining' })
    system.ingest({ ...wood('unknown', 100), materialId: 'constructor' })
    system.ingest({ ...base, authority: 'battle', kind: 'enemy_defeated', eventId: 'dummy', enemyId: 'debug_dummy' })
    expect(system.get('ach_m03_mach_san')?.current).toBe(0)
    expect(system.get('ach_m01_lam_thu')?.current).toBe(0)
    expect(system.get('ach_m02_tru_tich')?.current).toBe(0)
  })

  it('requires the same entitled companion to have been assigned, independent of witness order', () => {
    const system = make()
    system.reconcile({ playerId, completedStageIds: [], completedOnceIds: [], reachedRealmIds: ['foundation_establishment'], attainedElementIds: [] })
    expect(system.get('ach_f04_dong_hanh')?.available).toBe(false)
    system.ingest({ ...base, authority: 'formation', kind: 'formation_companion_assigned', eventId: 'assign-a', companionId: 'a' })
    system.ingest({ ...base, authority: 'companion', kind: 'companion_entitled', eventId: 'own-b', companionId: 'b' })
    expect(system.get('ach_f04_dong_hanh')?.available).toBe(true)
    expect(system.get('ach_f04_dong_hanh')?.ready).toBe(false)
    system.ingest({ ...base, authority: 'companion', kind: 'companion_entitled', eventId: 'own-a', companionId: 'a' })
    expect(system.get('ach_f04_dong_hanh')?.ready).toBe(true)
  })

  it('rejects failed/reentrant settlement, snapshots during reservation and preserves intrinsic band across realm transitions', () => {
    const system = make()
    stage(system)
    const before = system.snapshot()
    expect(system.claim('ach_m07_hung_tru', () => {
      expect(system.get('ach_m07_hung_tru')?.claimed).toBe(true)
      expect(() => system.snapshot()).toThrow()
      expect(system.restore(before)).toBe(false)
      expect(system.ingest(wood('during', 20))).toBe(false)
      expect(stage(system)).toBe(false)
      throw new Error('fixture atomic settlement failure')
    })).toBe('delivery-failed')
    expect(system.snapshot()).toEqual(before)
    system.reconcile({ playerId, completedStageIds: [], completedOnceIds: [], reachedRealmIds: ['foundation_establishment'], attainedElementIds: [] })
    expect(system.claim('ach_m07_hung_tru', (award) => {
      expect(award.band).toBe('mortal')
      expect(award.reward).toEqual({ spiritStone: 14, cultivation: 30 })
      return true
    })).toBe('granted')
    const reopened = make()
    expect(reopened.restore(system.snapshot())).toBe(true)
    expect(reopened.claim('ach_m07_hung_tru', () => { throw new Error('must not deliver twice') })).toBe('already-claimed')
  })

  it('rejects unknown/unready claims without invoking settlement; all projections are observational and detached', () => {
    const system = make()
    const before = system.snapshot()
    const settle = () => { throw new Error('should not invoke') }
    expect(system.claim('unknown', settle)).toBe('unknown-achievement')
    expect(system.claim('ach_m01_lam_thu', settle)).toBe('not-ready')
    system.getAll()
    const projection = system.get('ach_m01_lam_thu')!
    ;(projection.reward as { spiritStone: number }).spiritStone = 999
    expect(system.get('ach_m01_lam_thu')?.reward.spiritStone).toBe(5)
    expect(system.snapshot()).toEqual(before)
  })

  it('restores replacement into fresh owner, rejects equal-revision divergence and higher-revision rollback', () => {
    const system = make()
    system.ingest(wood('one', 20))
    system.claim('ach_m01_lam_thu', () => true)
    const saved = system.snapshot()
    const fresh = make()
    expect(fresh.restore(saved)).toBe(true)
    expect(fresh.restore(saved)).toBe(true)
    expect(fresh.restore({ ...saved, counters: { mortal_wood: 21 } })).toBe(false)
    expect(fresh.restore({ ...saved, revision: saved.revision + 1, claimedIds: [] })).toBe(false)
    expect(fresh.snapshot()).toEqual(saved)
    saved.counters.mortal_wood = 999
    saved.receiptIds.push('alias')
    expect(fresh.snapshot().counters.mortal_wood).toBe(20)
    expect(fresh.snapshot().receiptIds).not.toContain('alias')
  })

  it('accepts equivalent equal-revision saves with reordered sets and counter keys', () => {
    const system = make()
    system.ingest(wood('one', 20))
    system.ingest({ ...wood('two', 15), materialId: 'material_spirit_ore_decade' })
    const saved = system.snapshot()
    const reordered = { ...saved, receiptIds: [...saved.receiptIds].reverse(), counters: { spirit_ore: 15, mortal_wood: 20 } }
    expect(system.restore(reordered)).toBe(true)
    expect(system.get('ach_m01_lam_thu')?.current).toBe(20)
    expect(system.get('ach_m04_khoang_anh')?.current).toBe(15)
  })

  it.each([
    null, { version: 2 }, { revision: NaN }, { receiptIds: ['dup', 'dup'] },
    { claimedIds: ['unknown'] }, { claimedIds: ['ach_m01_lam_thu'] },
    { counters: { unknown: 1 } }, { counters: { mortal_wood: -1 } },
    { counters: { body_foundation: 2, body_all: 1 } }, { equipmentInstanceIds: ['unaccounted'] },
    { dailyClaimDays: [1.5] }, { weeklyClaims: [{ claimId: 'unbacked', period: 1 }] },
    { entitledCompanionIds: ['unbacked'] }, { facts: ['companion:assigned'] },
  ])('rejects malformed/contradictory state without mutation: %j', (patch) => {
    const system = make()
    const before = system.snapshot()
    expect(system.restore(patch === null ? null : { ...before, ...patch })).toBe(false)
    expect(system.snapshot()).toEqual(before)
  })

  it('period receipts require matching UTC day/Monday week; duplicate claims cannot extend streak', () => {
    const system = make()
    const daily = { ...base, authority: 'quest', kind: 'daily_quest_claimed', eventId: 'd', claimId: 'd', utcDayBucket: 100, occurredAt: 100 * 86_400_000 } as const
    expect(system.ingest({ ...daily, utcDayBucket: 101 })).toBe(false)
    expect(system.ingest(daily)).toBe(true)
    expect(system.ingest({ ...daily, eventId: 'd-again', utcDayBucket: 101, occurredAt: 101 * 86_400_000 })).toBe(false)
    const weekly = { ...base, authority: 'quest', kind: 'weekly_quest_claimed', eventId: 'w', claimId: 'w', utcWeekBucket: 10, occurredAt: 74 * 86_400_000 } as const
    expect(system.ingest(weekly)).toBe(true)
    expect(system.ingest({ ...weekly, eventId: 'w-again', utcWeekBucket: 11, occurredAt: 81 * 86_400_000 })).toBe(false)
    expect(system.get('ach_meta_day_7')?.current).toBe(1)
    expect(system.get('ach_meta_week_4')?.ready).toBe(false)
  })

  it('rejects nested unknown weekly save fields before they can retain aliases in snapshots', () => {
    const system = make()
    const before = system.snapshot()
    const extra = { hidden: ['mutable'] }
    expect(system.restore({ ...before, revision: 1, receiptIds: ['e'], operationIds: ['weekly:w'],
      weeklyClaims: [{ claimId: 'w', period: 10, extra }] })).toBe(false)
    extra.hidden.push('changed')
    expect(system.snapshot()).toEqual(before)
    expect(system.restore({ ...before, revision: 1, receiptIds: ['e'], operationIds: ['weekly:w'],
      weeklyClaims: [{ claimId: 'w', period: 10 }] })).toBe(true)
    const detached = system.snapshot()
    detached.weeklyClaims[0]!.period = 99
    expect(system.snapshot().weeklyClaims[0]!.period).toBe(10)
  })

  it('registry rejects duplicate/unsupported definitions and freezes detached nested contracts', () => {
    expect(() => new AchievementRegistry([ACHIEVEMENTS[0]!, ACHIEVEMENTS[0]!])).toThrow()
    expect(() => new AchievementRegistry([{ ...ACHIEVEMENTS[0]!, objective: { kind: 'counter', counter: 'mortal_wood', target: 0 } }])).toThrow()
    const input = { ...ACHIEVEMENTS[6]!, reward: { spiritStone: 14 }, objective: { kind: 'facts' as const, keys: ['stage:mortal_dong_10'] } }
    const registry = new AchievementRegistry([input])
    input.reward.spiritStone = 999
    input.objective.keys.push('fake')
    expect(registry.get(input.id)?.reward.spiritStone).toBe(14)
    expect(registry.get(input.id)?.objective).toEqual({ kind: 'facts', keys: ['stage:mortal_dong_10'] })
    expect(Object.isFrozen(registry.get(input.id)?.reward)).toBe(true)
  })

  it('rejects sparse owner witnesses without inventing entitlement or assignment IDs', () => {
    const system = make()
    const before = system.snapshot()
    expect(system.reconcile({ playerId, completedStageIds: [], completedOnceIds: [], reachedRealmIds: [],
      attainedElementIds: [], entitledCompanionIds: Array<string>(1), assignedCompanionIds: Array<string>(1) })).toBe(false)
    expect(system.get('ach_f04_dong_hanh')?.ready).toBe(false)
    expect(system.snapshot()).toEqual(before)
    expect(() => new AchievementRegistry([{ ...ACHIEVEMENTS[6]!, objective: { kind: 'facts', keys: Array<string>(1) } }])).toThrow()
  })

  it.each(['receiptIds', 'dailyClaimDays', 'weeklyClaims'] as const)('rejects sparse persisted %s atomically', (field) => {
    const system = make()
    const before = system.snapshot()
    expect(system.restore({ ...before, revision: 1, [field]: Array(1) })).toBe(false)
    expect(system.snapshot()).toEqual(before)
  })
})
