// Mission A3 defense-in-depth — restore normalizes malformed slices so a
// payload that somehow bypassed the shape validator cannot crash
// getActive()/incrementProgress() with a TypeError downstream.
import { describe, expect, it } from 'vitest'
import { QuestManager, type QuestManagerState } from './QuestManager'

describe('QuestManager.restore', () => {
  it('replaces state with a detached copy of a valid payload', () => {
    const manager = new QuestManager()
    const payload: QuestManagerState = {
      active: [{ questId: 'q1', progress: 2, claimed: false }],
      completedOnceIds: ['once_a'],
      lastDailyResetAtMs: 1_725_000_000_000,
    }

    manager.restore(payload)
    payload.active[0]!.progress = 999

    expect(manager.getState().active).toEqual([
      { questId: 'q1', progress: 2, claimed: false },
    ])
  })

  it('normalizes active: non-array -> [] instead of crashing consumers', () => {
    const manager = new QuestManager()

    expect(() =>
      manager.restore({
        active: 'x' as never,
        completedOnceIds: [],
        lastDailyResetAtMs: 0,
      }),
    ).not.toThrow()

    expect(manager.getState().active).toEqual([])
    expect(manager.getActive()).toEqual([])
  })

  it('normalizes completedOnceIds non-array and non-finite lastDailyResetAtMs', () => {
    const manager = new QuestManager()

    manager.restore({
      active: [],
      completedOnceIds: 'x' as never,
      lastDailyResetAtMs: Number.NaN,
    })

    expect(manager.getState().completedOnceIds).toEqual([])
    expect(manager.getState().lastDailyResetAtMs).toBe(0)
  })

  it('drops malformed entries inside otherwise-valid arrays', () => {
    const manager = new QuestManager()

    manager.restore({
      active: [
        { questId: 'q_ok', progress: 1, claimed: false },
        { questId: 5, progress: 1, claimed: false },
        'garbage',
        { questId: 'q_nan', progress: Number.NaN, claimed: false },
      ] as never,
      completedOnceIds: ['ok', 123, null] as never,
      lastDailyResetAtMs: 0,
    })

    expect(manager.getState().active).toEqual([
      { questId: 'q_ok', progress: 1, claimed: false },
    ])
    expect(manager.getState().completedOnceIds).toEqual(['ok'])
  })
})

describe('QuestManager.restore — canonicalization (Mission A review)', () => {
  it('drops foreign fields and negative values on a bypassed payload', () => {
    const manager = new QuestManager()

    manager.restore({
      active: [
        { questId: 'q_ok', progress: 1, claimed: false, __junk: { x: 1 } },
        { questId: 'q_neg', progress: -5, claimed: false },
      ] as never,
      completedOnceIds: ['ok'],
      lastDailyResetAtMs: -100,
    })

    const state = manager.getState()

    // Canonical shape only — no __junk to self-replicate into the next
    // buildGameSave() output.
    expect(state.active).toEqual([{ questId: 'q_ok', progress: 1, claimed: false }])
    expect(JSON.stringify(state.active)).not.toContain('__junk')
    expect(state.lastDailyResetAtMs).toBe(0)
  })
})
