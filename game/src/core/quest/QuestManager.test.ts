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
})
