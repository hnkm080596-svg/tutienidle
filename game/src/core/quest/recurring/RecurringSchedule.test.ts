import { describe, expect, it } from 'vitest'
import {
  RecurringSchedule,
  nextRecurringResetAt,
  recurringPeriodBucket,
  utcWeekBucket,
  type RecurringOffer,
} from './RecurringSchedule'

const monday = Date.UTC(2026, 9, 12)
const offers: RecurringOffer[] = ['d1', 'd2', 'd3', 'd4', 'd5'].map((templateId) => ({
  templateId,
  variantId: 'default',
}))

function assign(schedule: RecurringSchedule, nowMs = monday, pool = offers) {
  return schedule.reconcile({
    cadence: 'daily',
    nowMs,
    saveId: 'save-1',
    contentVersion: 'v2',
    realmBand: 'mortal',
    eligibleOffers: pool,
  })
}

describe('RecurringSchedule', () => {
  it('uses Monday at 00:00 UTC for weekly rollover and UTC midnight for daily rollover', () => {
    expect(utcWeekBucket(monday - 1)).toBe(utcWeekBucket(monday) - 1)
    expect(utcWeekBucket(monday + 6 * 86_400_000)).toBe(utcWeekBucket(monday))
    expect(nextRecurringResetAt('weekly', utcWeekBucket(monday))).toBe(monday + 7 * 86_400_000)
    expect(recurringPeriodBucket('daily', monday - 1)).toBe(recurringPeriodBucket('daily', monday) - 1)
    expect(nextRecurringResetAt('daily', recurringPeriodBucket('daily', monday))).toBe(monday + 86_400_000)
  })

  it('selects three offers once per period, independently of input order', () => {
    const left = new RecurringSchedule()
    const right = new RecurringSchedule()
    const first = assign(left)
    const second = assign(right, monday, [...offers].reverse())
    expect(first.kind).toBe('assigned')
    expect(second).toEqual(first)
    if (first.kind !== 'assigned') throw new Error('Missing board')
    expect(first.board.offers).toHaveLength(3)
    first.board.offers[0]!.templateId = 'forged'
    expect(left.getBoard('daily')?.offers.map((offer) => offer.templateId)).not.toContain('forged')

    const again = left.reconcile({
      cadence: 'daily',
      nowMs: monday,
      saveId: 'save-1',
      contentVersion: 'v3',
      realmBand: 'foundation_establishment',
      eligibleOffers: offers.slice(0, 3),
    })
    expect(again.kind).toBe('existing')
    if (again.kind !== 'existing') throw new Error('Missing board')
    expect(again.board.contentVersion).toBe('v2')
    expect(again.board.realmBand).toBe('mortal')
  })

  it('requires three distinct eligible offers, rejects invalid clocks and prevents rollback reroll', () => {
    const schedule = new RecurringSchedule()
    expect(assign(schedule, monday, offers.slice(0, 2))).toEqual({
      kind: 'insufficient_pool',
      eligibleCount: 2,
    })
    expect(assign(schedule, Number.NaN)).toEqual({ kind: 'invalid_time' })
    expect(assign(schedule, monday).kind).toBe('assigned')
    expect(assign(schedule, monday + 86_400_000).kind).toBe('assigned')
    expect(assign(schedule, monday)).toEqual({ kind: 'clock_rollback' })
    expect(schedule.getBoard('daily')?.period).toBe(recurringPeriodBucket('daily', monday + 86_400_000))
  })

  it('blocks incomplete, failed and duplicate claims and enforces two grants per day', () => {
    const schedule = new RecurringSchedule()
    assign(schedule)
    const selected = schedule.getBoard('daily')!.offers.map((offer) => offer.templateId)
    let grants = 0
    const claim = (templateId: string, completed: boolean, success: boolean) =>
      schedule.claim({
        cadence: 'daily',
        templateId,
        nowMs: monday,
        isObjectiveComplete: () => completed,
        grantAtomically: () => {
          if (success) grants++
          return success
        },
      })
    expect(claim(selected[0]!, false, true)).toEqual({ kind: 'objective_incomplete' })
    expect(claim(selected[0]!, true, false)).toEqual({ kind: 'reward_failed' })
    expect(claim(selected[0]!, true, true).kind).toBe('claimed')
    expect(claim(selected[0]!, true, true)).toEqual({ kind: 'already_claimed' })
    expect(claim(selected[1]!, true, true).kind).toBe('claimed')
    expect(claim(selected[2]!, true, true)).toEqual({ kind: 'quota_exhausted' })
    expect(grants).toBe(2)
    expect(schedule.getBoard('daily')!.claimedTemplateIds).toHaveLength(2)
    expect(schedule.claim({
      cadence: 'daily', templateId: selected[2]!, nowMs: monday + 86_400_000,
      isObjectiveComplete: () => true, grantAtomically: () => true,
    })).toEqual({ kind: 'expired' })
  })

  it('must reject a reentrant claim before a second reward can be settled', () => {
    const schedule = new RecurringSchedule()
    assign(schedule)
    const templateId = schedule.getBoard('daily')!.offers[0]!.templateId
    let nested: string | undefined
    const result = schedule.claim({
      cadence: 'daily', templateId, nowMs: monday,
      isObjectiveComplete: () => true,
      grantAtomically: () => {
        nested = schedule.claim({
          cadence: 'daily', templateId, nowMs: monday,
          isObjectiveComplete: () => true,
          grantAtomically: () => true,
        }).kind
        return true
      },
    })
    expect(result.kind).toBe('claimed')
    expect(nested).toBe('already_claimed')
  })

  it('restores detached state and refuses malformed identity or duplicate claimed rows', () => {
    const initial = new RecurringSchedule()
    assign(initial)
    const state = initial.getState()
    const restored = new RecurringSchedule()
    expect(restored.restore(state, 'save-1')).toBe(true)
    state.daily!.offers[0]!.templateId = 'mutated'
    expect(restored.getBoard('daily')!.offers[0]!.templateId).not.toBe('mutated')
    expect(restored.restore(initial.getState(), 'other-save')).toBe(false)
    const invalid = initial.getState()
    invalid.daily!.claimedTemplateIds = [invalid.daily!.offers[0]!.templateId, invalid.daily!.offers[0]!.templateId]
    expect(restored.restore(invalid, 'save-1')).toBe(false)
    expect(restored.getBoard('daily')).toEqual(initial.getBoard('daily'))
  })

  it('blocks competing claims and board replacement throughout both callbacks', () => {
    const schedule = new RecurringSchedule()
    assign(schedule)
    expect(schedule.reconcile({
      cadence: 'weekly', nowMs: monday, saveId: 'save-1', contentVersion: 'v2',
      realmBand: 'mortal', eligibleOffers: offers,
    }).kind).toBe('assigned')
    const first = schedule.getBoard('daily')!.offers[0]!.templateId
    const second = schedule.getBoard('daily')!.offers[1]!.templateId
    const weekly = schedule.getBoard('weekly')!.offers[0]!.templateId
    const stateBefore = schedule.getState()
    let grants = 0
    const nested = (cadence: 'daily' | 'weekly', templateId: string) =>
      schedule.claim({
        cadence, templateId, nowMs: monday, isObjectiveComplete: () => true,
        grantAtomically: () => { grants++; return true },
      }).kind
    const outer = schedule.claim({
      cadence: 'daily', templateId: first, nowMs: monday,
      isObjectiveComplete: () => {
        expect(schedule.getState().daily!.claimedTemplateIds).toEqual([])
        expect(nested('daily', second)).toBe('busy')
        expect(nested('daily', first)).toBe('already_claimed')
        expect(nested('weekly', weekly)).toBe('busy')
        expect(schedule.restore({ daily: null, weekly: null }, 'save-1')).toBe(false)
        expect(schedule.reconcile({
          cadence: 'daily', nowMs: monday + 86_400_000, saveId: 'save-1',
          contentVersion: 'v2', realmBand: 'qi_refining', eligibleOffers: offers,
        })).toEqual({ kind: 'busy' })
        return true
      },
      grantAtomically: () => {
        expect(schedule.getState().daily!.claimedTemplateIds).toEqual([])
        expect(nested('daily', second)).toBe('busy')
        expect(schedule.restore(stateBefore, 'save-1')).toBe(false)
        grants++
        return true
      },
    })
    expect(outer.kind).toBe('claimed')
    expect(grants).toBe(1)
    expect(schedule.getBoard('daily')!.claimedTemplateIds).toEqual([first])
    expect(schedule.getBoard('weekly')).toEqual(stateBefore.weekly)
    expect(nested('daily', second)).toBe('claimed')
    expect(grants).toBe(2)
  })

  it('rolls back reservations on callback false, throw, or non-boolean grant', () => {
    const schedule = new RecurringSchedule()
    assign(schedule)
    const id = schedule.getBoard('daily')!.offers[0]!.templateId
    let attempts = 0
    const fail = (objective: () => boolean, grant: () => boolean) =>
      schedule.claim({
        cadence: 'daily', templateId: id, nowMs: monday,
        isObjectiveComplete: objective, grantAtomically: grant,
      })
    expect(fail(() => { throw Error('objective failed') }, () => { attempts++; return true }).kind).toBe('reward_failed')
    expect(attempts).toBe(0)
    expect(fail(() => false, () => { attempts++; return true }).kind).toBe('objective_incomplete')
    expect(attempts).toBe(0)
    expect(fail(() => true, () => { attempts++; throw Error('grant failed') }).kind).toBe('reward_failed')
    expect(fail(() => true, () => { attempts++; return false }).kind).toBe('reward_failed')
    expect(fail(() => true, (() => Promise.resolve(true)) as unknown as () => boolean).kind).toBe('reward_failed')
    expect(schedule.getBoard('daily')!.claimedTemplateIds).toEqual([])
    expect(fail(() => true, () => { attempts++; return true }).kind).toBe('claimed')
    expect(attempts).toBe(3)
  })

  it('restores both boards by replacement, idempotently, and never partially restores', () => {
    const schedule = new RecurringSchedule()
    assign(schedule)
    const savedDaily = schedule.getBoard('daily')!
    const mondayWeek = schedule.reconcile({
      cadence: 'weekly', nowMs: monday, saveId: 'save-1',
      contentVersion: 'v2', realmBand: 'foundation_establishment', eligibleOffers: offers,
    })
    expect(mondayWeek.kind).toBe('assigned')
    const snapshot = schedule.getState()
    expect(schedule.restore(snapshot, 'save-1')).toBe(true)
    expect(schedule.restore(snapshot, 'save-1')).toBe(true)
    expect(schedule.getState()).toEqual(snapshot)
    expect(schedule.restore({ daily: null, weekly: null }, 'save-1')).toBe(true)
    expect(schedule.getState()).toEqual({ daily: null, weekly: null })
    expect(schedule.restore(snapshot, 'save-1')).toBe(true)
    const corrupted = structuredClone(snapshot)
    corrupted.weekly!.claimedTemplateIds = [corrupted.weekly!.offers[0]!.templateId, 'not-an-offer']
    expect(schedule.restore(corrupted, 'save-1')).toBe(false)
    expect(schedule.getState()).toEqual(snapshot)
    expect(schedule.getBoard('daily')).toEqual(savedDaily)
  })

  it('rejects malformed input, snapshot identity and invalid restored periods without mutation', () => {
    const schedule = new RecurringSchedule()
    const input = {
      cadence: 'daily' as const, nowMs: monday, saveId: 'save-1',
      contentVersion: 'v2', realmBand: 'mortal' as const, eligibleOffers: offers,
    }
    expect(schedule.reconcile({ ...input, saveId: '' })).toEqual({ kind: 'invalid_input' })
    expect(schedule.reconcile({ ...input, contentVersion: '' })).toEqual({ kind: 'invalid_input' })
    expect(schedule.reconcile({ ...input, realmBand: 'unknown' as 'mortal' })).toEqual({ kind: 'invalid_input' })
    expect(schedule.reconcile({ ...input, eligibleOffers: null as unknown as RecurringOffer[] })).toEqual({ kind: 'invalid_input' })
    expect(schedule.reconcile({ ...input, eligibleOffers: [null, ...offers] as RecurringOffer[] })).toEqual({ kind: 'invalid_input' })
    for (const nowMs of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      expect(schedule.reconcile({ ...input, nowMs })).toEqual({ kind: 'invalid_time' })
    }
    expect(schedule.getState()).toEqual({ daily: null, weekly: null })
    expect(schedule.reconcile(input).kind).toBe('assigned')
    const snapshot = schedule.getState()
    expect(schedule.restore(snapshot, '')).toBe(false)
    for (const badPeriod of [-1, Number.MAX_SAFE_INTEGER, 0.5, Infinity]) {
      const malformed = structuredClone(snapshot)
      malformed.daily!.period = badPeriod
      expect(schedule.restore(malformed, 'save-1')).toBe(false)
      expect(schedule.getState()).toEqual(snapshot)
    }
    expect(schedule.claim({
      cadence: 'invalid' as 'daily', templateId: 'd1', nowMs: monday,
      isObjectiveComplete: () => true, grantAtomically: () => true,
    })).toEqual({ kind: 'invalid_input' })
    expect(schedule.claim({
      cadence: 'daily', templateId: '', nowMs: monday,
      isObjectiveComplete: () => true, grantAtomically: () => true,
    })).toEqual({ kind: 'invalid_input' })
  })

  it('accepts finite fractional milliseconds from the authoritative monotonic clock', () => {
    const schedule = new RecurringSchedule()
    expect(assign(schedule, monday + 0.375).kind).toBe('assigned')
    const id = schedule.getBoard('daily')!.offers[0]!.templateId
    expect(schedule.claim({
      cadence: 'daily', templateId: id, nowMs: monday + 0.875,
      isObjectiveComplete: () => true, grantAtomically: () => true,
    }).kind).toBe('claimed')
    expect(schedule.reconcile({
      cadence: 'weekly', nowMs: monday + 0.375, saveId: 'save-1',
      contentVersion: 'v2', realmBand: 'mortal', eligibleOffers: offers,
    }).kind).toBe('assigned')
    expect(schedule.claim({
      cadence: 'daily', templateId: id, nowMs: monday + 86_400_000 + 0.02,
      isObjectiveComplete: () => true, grantAtomically: () => true,
    })).toEqual({ kind: 'expired' })
    expect(assign(schedule, monday + 86_400_000 + 0.01).kind).toBe('assigned')
    expect(schedule.getBoard('daily')?.period).toBe(recurringPeriodBucket('daily', monday) + 1)
  })

  it('keeps duplicate variant selection independent of pool ordering under deterministic shuffles', () => {
    const mixed = [...offers, { templateId: 'd1', variantId: 'z' }, { templateId: 'd1', variantId: 'a' }]
    const reference = new RecurringSchedule()
    expect(assign(reference, monday, mixed).kind).toBe('assigned')
    const expected = reference.getState()
    let seed = 1937
    for (let run = 0; run < 100; run++) {
      const shuffled = [...mixed]
      for (let index = shuffled.length - 1; index > 0; index--) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        const swap = seed % (index + 1)
        ;[shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!]
      }
      const current = new RecurringSchedule()
      expect(assign(current, monday, shuffled).kind).toBe('assigned')
      expect(current.getState()).toEqual(expected)
    }
  })

  it('freezes daily and weekly assignment across 15 days and restores quotas per period', () => {
    const schedule = new RecurringSchedule()
    const dayMs = 86_400_000
    let weeklyBoard: ReturnType<RecurringSchedule['getBoard']> = null
    for (let day = 0; day < 15; day++) {
      const nowMs = monday + day * dayMs
      const realmBand = day < 3 ? 'mortal' : day < 9 ? 'qi_refining' : 'foundation_establishment'
      const currentDaily = schedule.reconcile({
        cadence: 'daily', nowMs, saveId: 'save-1', contentVersion: `v${day}`,
        realmBand, eligibleOffers: offers,
      })
      const currentWeekly = schedule.reconcile({
        cadence: 'weekly', nowMs, saveId: 'save-1', contentVersion: `v${day}`,
        realmBand, eligibleOffers: offers,
      })
      expect(currentDaily.kind).toBe('assigned')
      expect(currentWeekly.kind).toBe(day === 0 || day === 7 || day === 14 ? 'assigned' : 'existing')
      const daily = schedule.getBoard('daily')!
      const weekly = schedule.getBoard('weekly')!
      expect(daily.realmBand).toBe(realmBand)
      expect(daily.contentVersion).toBe(`v${day}`)
      expect(weekly.realmBand).toBe(day < 7 ? 'mortal' : day < 14 ? 'qi_refining' : 'foundation_establishment')
      expect(weekly.contentVersion).toBe(day < 7 ? 'v0' : day < 14 ? 'v7' : 'v14')
      if (weeklyBoard && day % 7 !== 0) {
        expect(weekly.offers).toEqual(weeklyBoard.offers)
      }
      weeklyBoard = weekly
      const tryClaim = (cadence: 'daily' | 'weekly', templateId: string) =>
        schedule.claim({
          cadence, templateId, nowMs, isObjectiveComplete: () => true,
          grantAtomically: () => true,
        }).kind
      expect(tryClaim('daily', daily.offers[0]!.templateId)).toBe('claimed')
      expect(tryClaim('daily', daily.offers[1]!.templateId)).toBe('claimed')
      expect(tryClaim('daily', daily.offers[2]!.templateId)).toBe('quota_exhausted')
      if (day % 7 === 0) {
        expect(tryClaim('weekly', weekly.offers[0]!.templateId)).toBe('claimed')
        expect(tryClaim('weekly', weekly.offers[1]!.templateId)).toBe('claimed')
      }
      expect(tryClaim('weekly', weekly.offers[2]!.templateId)).toBe('quota_exhausted')
      expect(schedule.getBoard('daily')!.claimedTemplateIds).toHaveLength(2)
      expect(schedule.getBoard('weekly')!.claimedTemplateIds).toHaveLength(2)
      const snapshot = schedule.getState()
      expect(schedule.restore(snapshot, 'save-1')).toBe(true)
      expect(schedule.getState()).toEqual(snapshot)
      if (day < 14) {
        expect(schedule.claim({
          cadence: 'daily', templateId: daily.offers[0]!.templateId,
          nowMs: nowMs + dayMs,
          isObjectiveComplete: () => true, grantAtomically: () => true,
        })).toEqual({ kind: 'expired' })
      }
    }
  })

  it('rejects hostile restore payload mutations with atomic state preservation', () => {
    const schedule = new RecurringSchedule()
    assign(schedule)
    const baseline = schedule.getState()
    const mutate = (change: (record: Record<string, unknown>) => void) => {
      const snapshot = structuredClone(baseline) as unknown as Record<string, unknown>
      const board = snapshot.daily as Record<string, unknown>
      change(board)
      expect(schedule.restore(snapshot, 'save-1')).toBe(false)
      expect(schedule.getState()).toEqual(baseline)
    }
    mutate((board) => { board.cadence = 'weekly' })
    mutate((board) => { board.realmBand = null })
    mutate((board) => { board.contentVersion = ' ' })
    mutate((board) => { board.offers = [] })
    mutate((board) => { board.offers = [null, null, null] })
    mutate((board) => {
      const entries = board.offers as RecurringOffer[]
      entries[0]!.templateId = entries[1]!.templateId
    })
    mutate((board) => { board.claimedTemplateIds = ['forged'] })
    mutate((board) => { board.claimedTemplateIds = [2] })
    mutate((board) => { board.claimedTemplateIds = ['d1', 'd1'] })
    expect(schedule.restore(null, 'save-1')).toBe(false)
    expect(schedule.restore([], 'save-1')).toBe(false)
    expect(schedule.restore({ daily: null }, 'save-1')).toBe(false)
    expect(schedule.getState()).toEqual(baseline)
  })
})
