import { afterEach, describe, expect, it, vi } from 'vitest'
import { EarlyGameSession } from '../simulation/earlygame/EarlyGameSession'
import { GameClock } from '../idle/GameClock'
import { settleIdleSkillInsightMint } from '../reward/SkillInsightBalance'
import { OnlineSessionController } from '../../services/session/OnlineSessionController'

const DAY_MS = 86_400_000
const T0 = Date.UTC(2026, 9, 11, 12)

afterEach(() => {
  vi.useRealTimers()
})

describe('Beta readiness audit: wall clock and idle reward authority', () => {
  it('does not reopen an exhausted day quota when the supplied wall clock rolls backward', () => {
    const player = {
      idleSkillInsightDaily: { dayBucket: Math.floor(T0 / DAY_MS), minted: 30_000 },
    }

    expect(settleIdleSkillInsightMint(player, 'qi_refining', 1, T0)).toBe(0)
    expect(settleIdleSkillInsightMint(player, 'qi_refining', 1, T0 - DAY_MS)).toBe(0)
  })

  it('does not pay a local one-day clock jump during one second of a healthy online lease', () => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    const session = new EarlyGameSession({
      seed: 20261011,
      nowMs: T0,
      profile: { name: 'Clock audit', talentIds: [] },
    })
    const { player, gameManager } = session
    // Fixture precondition: an existing eligible QI farmer, not a fresh player.
    const stageId = 'qi_refining_forest'
    player.realmId = 'qi_refining'
    player.realmLevel = 1
    player.completedStageIds.push(stageId)
    player.perfectClearStageIds.push(stageId)
    player.perfectClearSeconds[stageId] = 600
    player.idleSkillInsightDaily = { dayBucket: Math.floor(T0 / DAY_MS), minted: 30_000 }
    expect(gameManager.turnBattleOps.autoFarmOps.startAutoFarm(player, stageId)).toBe(true)

    let monotonicNow = 0
    const authority = new OnlineSessionController({
      probe: async () => ({ status: 'ok' }),
      monotonicNow: () => monotonicNow,
      scheduleInterval: () => 1,
      clearHandle: () => undefined,
    })
    authority.markReady()
    const clock = new GameClock()
    clock.start()
    const insightBefore = player.skillInsight

    // App uses a monotonic health lease but a Date.now world clock.
    // Drive their actual owners with the same gate/order used by App.tick.
    monotonicNow = 1_000
    vi.setSystemTime(T0 + DAY_MS)
    expect(authority.canMutate()).toBe(true)
    const { deltaSeconds } = clock.update()
    expect(deltaSeconds).toBe(86_400)
    if (deltaSeconds > 0) {
      gameManager.turnBattleOps.updateBattleFixedStep(deltaSeconds)
    }

    expect(player.skillInsight - insightBefore).toBe(0)
  })
})
